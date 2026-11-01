import type { McpServer } from '@modelcontextprotocol/server';
import { GuardedDapSession } from '../dap/guarded-session.js';
export type DumpAdapterKind = 'codelldb' | 'lldb-dap' | 'gdb';
export type OpenDumpOptions = {
    dumpPath: string;
    program?: string;
    sourceMap?: Record<string, string>;
    adapter?: DumpAdapterKind;
    adapterPath?: string;
    cwd?: string;
    requestTimeoutMs?: number;
    threadId?: number;
    stackLevels?: number;
    maxVariablesPerScope?: number;
    includeDisassembly?: boolean;
    includeModules?: boolean;
    moduleCount?: number;
};
export declare function openDump(session: GuardedDapSession, options: OpenDumpOptions): Promise<{
    mode: 'postmortem';
    readOnlyTarget: boolean;
    adapterKind: DumpAdapterKind;
    dumpPath: string;
    program?: string | undefined;
    adapter: import("../adapters/codelldb.js").CodeLldbDiscoveryResult | import("../adapters/gdb-dap.js").GdbDapDiscoveryResult | import("../adapters/lldb-dap.js").LldbDapDiscoveryResult;
    capabilities: import("@vscode/debugprotocol").DebugProtocol.Capabilities;
    attach: unknown;
    snapshot: import("../dap/session.js").RuntimeSnapshot;
    guidance: {
        canInspect: string[];
        blockedOperations: string[];
        cannotResume: boolean;
        note: string;
    };
}>;
export declare function registerDumpTools(server: McpServer, session: GuardedDapSession): void;
