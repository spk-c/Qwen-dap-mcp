import type { DebugProtocol } from '@vscode/debugprotocol';
import { type HolGuardEvaluator } from './hol-guard-policy.js';
import type { DapPolicyMode } from './request-policy.js';
import { DapSession, type RuntimeSnapshot, type RuntimeSnapshotOptions, type SourceBreakpointGroup, type StartSessionOptions } from './session.js';
export type GuardedDapSessionOptions = {
    holGuardEvaluator?: HolGuardEvaluator;
    dapPolicyMode?: DapPolicyMode;
};
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
export declare class GuardedDapSession extends DapSession {
    private postmortem;
    private readonly lifecycleContext;
    private activeLifecycleOperation?;
    private readonly holGuardEvaluator;
    private holGuardExecutionContext?;
    constructor(options?: GuardedDapSessionOptions);
    start(options: StartSessionOptions): Promise<DebugProtocol.Capabilities>;
    launch(configuration: Record<string, unknown>, breakpoints?: SourceBreakpointGroup[]): Promise<unknown>;
    attach(configuration: Record<string, unknown>, breakpoints?: SourceBreakpointGroup[]): Promise<unknown>;
    disconnect(terminateDebuggee?: boolean): Promise<void>;
    reset(): Promise<void>;
    /**
     * Run one lifecycle transaction exclusively.
     *
     * Nested lifecycle calls from the same async transaction are allowed. A
     * competing MCP request receives a deterministic error instead of racing the
     * shared DAP connection and session state.
     */
    runExclusiveLifecycle<T>(operation: string, action: () => Promise<T>): Promise<T>;
    markPostmortem(): void;
    isPostmortem(): boolean;
    runtimeSnapshot(options?: RuntimeSnapshotOptions): Promise<RuntimeSnapshot>;
    snapshot(): {
        adapterRunning: boolean;
        adapterPid?: number;
        initialized: boolean;
        configured: boolean;
        stateUncertain: boolean;
        activeRequest?: 'launch' | 'attach';
        adapterId?: string;
        capabilities?: DebugProtocol.Capabilities;
        recentEvents: readonly unknown[];
        recentAdapterStderr: readonly string[];
        postmortem: boolean;
        lifecycleOperation?: string | undefined;
    };
    pause(threadId: number, waitForStop?: boolean, timeoutMs?: number): Promise<unknown>;
    continueExecution(threadId: number, waitForStop?: boolean, timeoutMs?: number): Promise<unknown>;
    step(action: 'next' | 'stepIn' | 'stepOut', threadId: number, waitForStop?: boolean, timeoutMs?: number): Promise<unknown>;
    reverseContinue(threadId: number, waitForStop?: boolean, timeoutMs?: number): Promise<unknown>;
    stepBack(threadId: number, waitForStop?: boolean, timeoutMs?: number): Promise<unknown>;
    dataBreakpointInfo(name: string, variablesReference?: number, frameId?: number): Promise<NonNullable<DebugProtocol.DataBreakpointInfoResponse['body']>>;
    setDataBreakpoints(breakpoints: DebugProtocol.DataBreakpoint[]): Promise<DebugProtocol.Breakpoint[]>;
    private assertLiveOperation;
}
