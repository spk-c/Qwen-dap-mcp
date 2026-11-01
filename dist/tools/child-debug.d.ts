import type { McpServer } from '@modelcontextprotocol/server';
import type { DapSessionRegistry } from '../dap/session-registry.js';
import type { GuardedDapSession } from '../dap/guarded-session.js';
export declare function sanitizeStartConfiguration(request: {
    arguments?: unknown;
}, overrides: {
    program?: string;
}): {
    readonly request: "attach" | "launch";
    readonly program?: string | undefined;
    readonly cwd?: string | undefined;
    readonly args?: string[] | undefined;
    readonly env?: Record<string, string> | undefined;
    readonly stopOnEntry: boolean;
    readonly pid?: number | undefined;
};
export declare function registerChildDebugTools(server: McpServer, parentSession: GuardedDapSession, registry: DapSessionRegistry): void;
