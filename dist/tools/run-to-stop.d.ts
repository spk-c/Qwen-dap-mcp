import type { McpServer } from '@modelcontextprotocol/server';
import type { RuntimeSnapshot, RuntimeSnapshotOptions, SourceBreakpointGroup } from '../dap/session.js';
export type RunToStopRequest = 'launch' | 'attach';
export type RunToStopSession = {
    connection: {
        on(eventName: string | symbol, listener: (...args: any[]) => void): unknown;
        off(eventName: string | symbol, listener: (...args: any[]) => void): unknown;
    };
    runExclusiveLifecycle<T>(operation: string, action: () => Promise<T>): Promise<T>;
    isPostmortem(): boolean;
    launch(configuration: Record<string, unknown>, breakpoints?: SourceBreakpointGroup[]): Promise<unknown>;
    attach(configuration: Record<string, unknown>, breakpoints?: SourceBreakpointGroup[]): Promise<unknown>;
    runtimeSnapshot(options?: RuntimeSnapshotOptions): Promise<RuntimeSnapshot>;
    snapshot(): unknown;
};
export type RunToStopOptions = {
    request?: RunToStopRequest;
    configuration: Record<string, unknown>;
    breakpoints?: SourceBreakpointGroup[];
    timeoutMs?: number;
    snapshot?: RuntimeSnapshotOptions;
};
export type RunToStopResult = {
    request: RunToStopRequest;
    requestResult: unknown;
    outcome: {
        event: 'stopped' | 'exited' | 'terminated';
        body?: unknown;
    };
    snapshot?: RuntimeSnapshot;
    status: unknown;
};
export declare function runToStop(session: RunToStopSession, options: RunToStopOptions): Promise<RunToStopResult>;
export declare function registerRunToStopTool(server: McpServer, session: RunToStopSession): void;
