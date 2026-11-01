import type { McpServer } from '@modelcontextprotocol/server';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { GuardedDapSession } from '../dap/guarded-session.js';
import type { RuntimeSnapshotOptions } from '../dap/session.js';
export type FindWriterOptions = {
    name: string;
    variablesReference?: number;
    frameId?: number;
    accessType?: 'read' | 'write' | 'readWrite';
    condition?: string;
    hitCondition?: string;
    threadId?: number;
    timeoutMs?: number;
    replaceExistingDataBreakpoints?: boolean;
    snapshot?: RuntimeSnapshotOptions;
};
type ResumeOutcome = {
    event: 'stopped' | 'exited' | 'terminated';
    body?: unknown;
};
export declare function findWriter(session: GuardedDapSession, options: FindWriterOptions): Promise<{
    query: {
        name: string;
        accessType: "read" | "readWrite" | "write";
        variablesReference?: number | undefined;
        frameId: number;
    };
    strategy: "dap-data-breakpoint" | "gdb-watch";
    resolution: unknown;
    priorDataBreakpointCount: number;
    replaceExistingDataBreakpoints: boolean;
    installed: unknown;
    outcome: ResumeOutcome;
    hitConfirmed: boolean;
    before: {
        thread: DebugProtocol.Thread;
        frame: DebugProtocol.StackFrame;
    };
    writerFrame?: DebugProtocol.StackFrame | undefined;
    writerCorrelation?: import("../diagnostics/analyze-snapshot.js").SourceDisassemblyCorrelation | undefined;
    snapshot?: import("../dap/session.js").RuntimeSnapshot | undefined;
    cleanupWarning?: string | undefined;
    guidance: string;
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
export declare function registerFindWriterTool(server: McpServer, session: GuardedDapSession): void;
export {};
