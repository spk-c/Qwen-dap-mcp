import type { McpServer } from '@modelcontextprotocol/server';
import { DapSession } from '../dap/session.js';
export declare function formatMemoryResult(memory: Record<string, unknown> & {
    data?: string;
}, requestedCount: number): Record<string, unknown>;
export declare function registerDebugTools(server: McpServer, session: DapSession): void;
