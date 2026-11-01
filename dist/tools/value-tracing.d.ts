import type { McpServer } from '@modelcontextprotocol/server';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { GuardedDapSession } from '../dap/guarded-session.js';
import type { RuntimeSnapshot, RuntimeSnapshotOptions } from '../dap/session.js';
export type TraceValueOptions = {
    name: string;
    accessType?: 'write' | 'readWrite';
    threadId?: number;
    maxStops?: number;
    timeoutMs?: number;
    perStopTimeoutMs?: number;
    snapshot?: RuntimeSnapshotOptions;
};
export type ObservedTraceValue = {
    name: string;
    value: string;
    type?: string;
    evaluateName?: string;
};
export declare function findObservedValue(snapshot: RuntimeSnapshot, expression: string): ObservedTraceValue | undefined;
export declare function traceValue(session: GuardedDapSession, options: TraceValueOptions): Promise<{
    query: {
        name: string;
        accessType: "readWrite" | "write";
        maxStops: number;
        timeoutMs: number;
        perStopTimeoutMs: number;
    };
    events: Record<string, unknown>[];
    stopReason: "error" | "max-stops" | "no-writer-snapshot" | "target-exited" | "target-terminated" | "unrelated-stop";
    terminalError?: string | undefined;
    finalSnapshot: RuntimeSnapshot;
    guidance: string[];
    status: {
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
}>;
export declare function registerValueTracingTool(server: McpServer, session: GuardedDapSession): void;
