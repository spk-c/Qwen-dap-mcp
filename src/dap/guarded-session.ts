import { AsyncLocalStorage } from 'node:async_hooks';
import { DapError } from './errors.js';
import { normalizeEnvironmentOverrides } from './environment.js';
import { createGuardedDapRequestPolicy, createHolGuardEvaluator, requireHolGuardAdapterStart, } from './hol-guard-policy.js';
import { normalizePostmortemSnapshot } from './postmortem-normalization.js';
import { DapSession, } from './session.js';
import type { DapAdapterStartOptions, DapBreakpointGroup, RuntimeSnapshotOptions } from './session.js';
import type { DebugProtocol } from '@vscode/debugprotocol';
/**
 * DapSession with an explicit frozen postmortem mode, serialized lifecycle,
 * and optional HOL Guard enforcement at the process/code-execution choke
 * points: outgoing protected DAP requests and adapter process start.
 *
 * CodeLLDB exposes core/minidump inspection through its normal DAP attach
 * surface, so the base session cannot infer that no live process exists.
 * This subclass records that semantic distinction and rejects operations that
 * only make sense for a resumable process.
 *
 * Lifecycle mutations are serialized across independent MCP requests. The
 * AsyncLocalStorage owner makes the gate reentrant so compound operations such
 * as open-dump -> start -> reset -> attach can safely call guarded methods.
 */
export class GuardedDapSession extends DapSession {
    postmortem = false;
    lifecycleContext = new AsyncLocalStorage<symbol>();
    activeLifecycleOperation?: { owner: symbol; name: string };
    holGuardEvaluator: ReturnType<typeof createHolGuardEvaluator>;
    holGuardExecutionContext?: Awaited<ReturnType<typeof requireHolGuardAdapterStart>>;
    constructor(options: {
        holGuardEvaluator?: ReturnType<typeof createHolGuardEvaluator>;
        dapPolicyMode?: string;
    } = {}) {
        super();
        this.holGuardEvaluator = options.holGuardEvaluator ?? createHolGuardEvaluator();
        this.connection.setRequestPolicy(createGuardedDapRequestPolicy(this.holGuardEvaluator, options.dapPolicyMode, () => this.holGuardExecutionContext));
    }
    async start(options: DapAdapterStartOptions) {
        return this.runExclusiveLifecycle('start', async () => {
            // DapConnection.start() directly spawns the adapter and intentionally sits
            // outside sendRequest(). Gate it before reset/spawn can create a side
            // effect. HOL Guard sees a fingerprint of the effective adapter environment
            // and the exact resolved executable identity, not raw adapter env values.
            const executionContext = await requireHolGuardAdapterStart(this.holGuardEvaluator, {
                command: options.command,
                ...(options.args ? { args: options.args } : {}),
                ...(options.cwd ? { cwd: options.cwd } : {}),
                ...(options.env ? { env: options.env } : {}),
            });
            this.holGuardExecutionContext = undefined;
            this.postmortem = false;
            try {
                // Normalize environment override key casing before spawn so Windows
                // `Path`/`PATH` semantics exactly match the identity evaluated above.
                // When Guard is enabled, also spawn the canonical executable path that
                // was hashed and approved instead of resolving PATH a second time.
                const guardedOptions = {
                    ...options,
                    ...(options.env ? { env: normalizeEnvironmentOverrides(options.env) } : {}),
                    ...('adapterResolvedCommand' in executionContext
                        && typeof executionContext.adapterResolvedCommand === 'string'
                        && executionContext.adapterResolvedCommand.length > 0
                        ? { command: executionContext.adapterResolvedCommand }
                        : {}),
                };
                const capabilities = await super.start(guardedOptions);
                // Bind every later protected DAP request to the exact adapter/cwd/env
                // that successfully initialized. Sanitized per-request arguments are
                // included separately in the HOL Guard approval identity.
                this.holGuardExecutionContext = executionContext;
                return capabilities;
            }
            catch (error) {
                this.holGuardExecutionContext = undefined;
                throw error;
            }
        });
    }
    async launch(configuration: Record<string, unknown>, breakpoints: DapBreakpointGroup[] = []) {
        return this.runExclusiveLifecycle('launch', () => super.launch(configuration, breakpoints));
    }
    async attach(configuration: Record<string, unknown>, breakpoints: DapBreakpointGroup[] = []) {
        return this.runExclusiveLifecycle('attach', () => super.attach(configuration, breakpoints));
    }
    async disconnect(terminateDebuggee = true) {
        return this.runExclusiveLifecycle('disconnect', async () => {
            await super.disconnect(terminateDebuggee);
            this.postmortem = false;
            this.holGuardExecutionContext = undefined;
        });
    }
    async reset() {
        return this.runExclusiveLifecycle('reset', async () => {
            await super.reset();
            this.postmortem = false;
            this.holGuardExecutionContext = undefined;
        });
    }
    /**
     * Run one lifecycle transaction exclusively.
     *
     * Nested lifecycle calls from the same async transaction are allowed. A
     * competing MCP request receives a deterministic error instead of racing the
     * shared DAP connection and session state.
     */
    async runExclusiveLifecycle<T>(operation: string, action: () => T | Promise<T>): Promise<T> {
        const currentOwner = this.lifecycleContext.getStore();
        const active = this.activeLifecycleOperation;
        if (active) {
            if (currentOwner === active.owner) {
                return action();
            }
            throw new DapError(`Cannot ${operation} while lifecycle operation '${active.name}' is already in progress. Wait for it to finish before changing the shared DAP session.`);
        }
        const owner = Symbol(operation);
        this.activeLifecycleOperation = { owner, name: operation };
        return this.lifecycleContext.run(owner, async () => {
            try {
                return await action();
            }
            finally {
                if (this.activeLifecycleOperation?.owner === owner) {
                    this.activeLifecycleOperation = undefined;
                }
            }
        });
    }
    markPostmortem(): void {
        this.postmortem = true;
    }
    isPostmortem(): boolean {
        return this.postmortem;
    }
    async runtimeSnapshot(options: RuntimeSnapshotOptions = {}) {
        const snapshot = await super.runtimeSnapshot(options);
        return this.postmortem ? normalizePostmortemSnapshot(snapshot) : snapshot;
    }
    snapshot() {
        return {
            ...super.snapshot(),
            postmortem: this.postmortem,
            ...(this.activeLifecycleOperation === undefined
                ? {}
                : { lifecycleOperation: this.activeLifecycleOperation.name }),
        };
    }
    async pause(threadId: number, waitForStop = true, timeoutMs = 15_000) {
        this.assertLiveOperation('pause');
        return super.pause(threadId, waitForStop, timeoutMs);
    }
    async continueExecution(threadId: number, waitForStop = true, timeoutMs = 15_000) {
        this.assertLiveOperation('continue');
        return super.continueExecution(threadId, waitForStop, timeoutMs);
    }
    async step(action: string, threadId: number, waitForStop = true, timeoutMs = 15_000) {
        this.assertLiveOperation(action);
        return super.step(action, threadId, waitForStop, timeoutMs);
    }
    async reverseContinue(threadId: number, waitForStop = true, timeoutMs = 15_000) {
        this.assertLiveOperation('reverseContinue');
        return super.reverseContinue(threadId, waitForStop, timeoutMs);
    }
    async stepBack(threadId: number, waitForStop = true, timeoutMs = 15_000) {
        this.assertLiveOperation('stepBack');
        return super.stepBack(threadId, waitForStop, timeoutMs);
    }
    async dataBreakpointInfo(name: string, variablesReference?: number, frameId?: number) {
        this.assertLiveOperation('dataBreakpointInfo');
        return super.dataBreakpointInfo(name, variablesReference, frameId);
    }
    async setDataBreakpoints(breakpoints: DebugProtocol.DataBreakpoint[]) {
        this.assertLiveOperation('setDataBreakpoints');
        return super.setDataBreakpoints(breakpoints);
    }
    assertLiveOperation(operation: string): void {
        if (this.postmortem) {
            throw new DapError(`Cannot ${operation} in a postmortem crash-dump session. The dump is frozen state; inspect it with debug_snapshot, stack, variables, registers, modules, memory, or disassembly instead.`);
        }
    }
}
//# sourceMappingURL=guarded-session.js.map