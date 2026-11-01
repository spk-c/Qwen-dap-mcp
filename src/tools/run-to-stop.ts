import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/server';
import type { GuardedDapSession } from '../dap/guarded-session.js';
import type { RuntimeSnapshotOptions } from '../dap/session.js';
import { DapError, DapTimeoutError } from '../dap/errors.js';
import { LOCAL_TARGET_EXECUTION_ANNOTATIONS } from './tool-annotations.js';
import { debugRunToStopOutputSchema, structuredResult } from './agent-output.js';
const OUTCOME_EVENTS = new Set(['stopped', 'exited', 'terminated']);
type DapOutcomeEvent = { event: string; body?: { threadId?: number } };
type RunToStopOptions = {
    request?: 'launch' | 'attach';
    configuration: Record<string, unknown>;
    breakpoints?: Array<{ source: string; lines: number[] }>;
    timeoutMs?: number;
    snapshot?: RuntimeSnapshotOptions;
};
function createOutcomeWait(session: GuardedDapSession, timeoutMs: number) {
    let active = true;
    let resolvePromise!: (value: DapOutcomeEvent | undefined) => void;
    let handler!: (event: DapOutcomeEvent) => void;
    let onAdapterExit!: (detail: unknown) => void;
    let onAdapterError!: (error: unknown) => void;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
        if (!active)
            return;
        active = false;
        clearTimeout(timer);
        session.connection.off('event', handler);
        session.connection.off('adapterExit', onAdapterExit);
        session.connection.off('adapterError', onAdapterError);
    };
    const promise = new Promise<DapOutcomeEvent | undefined>((resolve, reject) => {
        resolvePromise = resolve;
        handler = (event) => {
            if (!OUTCOME_EVENTS.has(event.event))
                return;
            cleanup();
            resolve(event);
        };
        onAdapterExit = (detail) => {
            cleanup();
            reject(new DapError(`DAP adapter exited before stopped/exited/terminated was observed: ${JSON.stringify(detail ?? {})}`));
        };
        onAdapterError = (error) => {
            cleanup();
            reject(error instanceof Error ? error : new DapError('DAP adapter failed while waiting for stopped/exited/terminated.'));
        };
        timer = setTimeout(() => {
            cleanup();
            reject(new DapTimeoutError('DAP stopped/exited/terminated event', timeoutMs));
        }, timeoutMs);
        session.connection.on('event', handler);
        session.connection.on('adapterExit', onAdapterExit);
        session.connection.on('adapterError', onAdapterError);
    });
    return {
        promise,
        cancel: () => {
            if (!active)
                return;
            cleanup();
            resolvePromise(undefined);
        },
    };
}
export async function runToStop(session: GuardedDapSession, options: RunToStopOptions) {
    const request = options.request ?? 'launch';
    const breakpoints = options.breakpoints ?? [];
    const timeoutMs = options.timeoutMs ?? 30_000;
    return session.runExclusiveLifecycle('run to stop', async () => {
        if (session.isPostmortem()) {
            throw new DapError('Cannot run to stop in a postmortem crash-dump session. Start a live debug session first.');
        }
        // Arm the event listener before launch/attach so an immediate stop or fast
        // process exit cannot race past the composite tool between DAP requests.
        const outcomeWait = createOutcomeWait(session, timeoutMs);
        // launch/attach may itself take longer than the outcome timer. Observe a
        // possible early rejection immediately so Node never reports it as an
        // unhandled rejection; the original promise is still awaited below.
        void outcomeWait.promise.catch(() => undefined);
        let requestResult;
        try {
            requestResult = request === 'attach'
                ? await session.attach(options.configuration, breakpoints)
                : await session.launch(options.configuration, breakpoints);
        }
        catch (error) {
            outcomeWait.cancel();
            // A stale outcome timeout/adapter-exit error must never mask the more
            // specific launch/attach error that brought us here.
            await outcomeWait.promise.catch(() => undefined);
            throw error;
        }
        const event = await outcomeWait.promise;
        if (!event) {
            throw new DapError('The run-to-stop event wait was cancelled unexpectedly.');
        }
        const outcome = {
            event: event.event,
            ...(event.body === undefined ? {} : { body: event.body }),
        };
        if (event.event !== 'stopped') {
            return {
                request,
                requestResult,
                outcome,
                status: session.snapshot(),
            };
        }
        const stopped = event.body;
        const snapshotOptions = {
            ...(options.snapshot ?? {}),
            ...(options.snapshot?.threadId === undefined && stopped?.threadId !== undefined
                ? { threadId: stopped.threadId }
                : {}),
        };
        const snapshot = await session.runtimeSnapshot(snapshotOptions);
        return {
            request,
            requestResult,
            outcome,
            snapshot,
            status: session.snapshot(),
        };
    });
}
const jsonRecord = z.record(z.string(), z.unknown()).describe('Adapter-specific DAP launch or attach configuration.');
const breakpointGroupSchema = z.object({
    source: z.string().min(1).describe('Absolute or adapter-resolvable source file path.'),
    lines: z.array(z.number().int().positive()).min(1).describe('One or more 1-based source line numbers to replace as breakpoints for this source file.'),
}).describe('Source file and line breakpoints applied before configuration completes.');
const snapshotSchema = z.object({
    threadId: z.number().int().positive().optional().describe('Stopped thread to snapshot; omit to use the thread from the stopped event.'),
    stackLevels: z.number().int().positive().max(100).optional().describe('Maximum stack frames to collect after a stop.'),
    maxVariablesPerScope: z.number().int().positive().max(500).optional().describe('Maximum variables to return per inspected scope.'),
    includeDisassembly: z.boolean().optional().describe('Whether to include best-effort disassembly near the selected frame.'),
    disassembleBefore: z.number().int().nonnegative().max(100).optional().describe('Instructions before the selected instruction to request.'),
    disassembleAfter: z.number().int().nonnegative().max(100).optional().describe('Instructions after the selected instruction to request.'),
    includeModules: z.boolean().optional().describe('Whether to include a bounded loaded-module list.'),
    moduleCount: z.number().int().positive().max(500).optional().describe('Maximum loaded modules to include.'),
    includeExceptionInfo: z.boolean().optional().describe('Whether to request structured exception information after a stop.'),
}).describe('Optional bounds and evidence categories for the snapshot captured only when execution stops.');
function result(value: unknown) {
    return structuredResult(value);
}
function errorResult(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text' as const, text: message }], isError: true };
}
export function registerRunToStopTool(server: McpServer, session: GuardedDapSession): void {
    server.registerTool('debug_run_to_stop', {
        title: 'Run Until Debug Stop or Exit',
        description: 'Run one live launch or attach through an already initialized DAP adapter until the first stopped, exited, or terminated event. Use this when you need deterministic runtime evidence from a reproduction; do not use it for a postmortem dump or when executing/attaching to the local target is not authorized. Launch mode executes application code and attach mode changes debugger control of an existing process, so normal target side effects may occur before the stop. Returns the request result, terminal/stopped outcome, session status, and a bounded snapshot only when a stopped event is captured.',
        annotations: LOCAL_TARGET_EXECUTION_ANNOTATIONS,
        outputSchema: debugRunToStopOutputSchema,
        inputSchema: z.object({
            request: z.enum(['launch', 'attach']).default('launch').describe('Choose launch to start a new target from configuration, or attach to connect to an existing authorized local target.'),
            configuration: jsonRecord,
            breakpoints: z.array(breakpointGroupSchema).optional().describe('Optional source breakpoint groups configured before the debugger completes launch/attach setup.'),
            timeoutMs: z.number().int().min(1000).max(120000).default(30000).describe('Maximum milliseconds to wait for the first stopped, exited, or terminated event.'),
            snapshot: snapshotSchema.optional(),
        }),
    }, async ({ request, configuration, breakpoints, timeoutMs, snapshot }) => {
        try {
            return result(await runToStop(session, {
                request,
                configuration,
                ...(breakpoints ? { breakpoints } : {}),
                timeoutMs,
                ...(snapshot ? { snapshot } : {}),
            }));
        }
        catch (error) {
            return errorResult(error);
        }
    });
}
//# sourceMappingURL=run-to-stop.js.map