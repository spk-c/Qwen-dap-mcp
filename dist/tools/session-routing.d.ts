import type { DapSessionRegistry } from '../dap/session-registry.js';
type ToolRegistrar = {
    registerTool: (...args: any[]) => any;
};
/**
 * Add an optional sessionId to existing debug tool schemas and bind each tool
 * invocation to that session for the lifetime of the async handler.
 *
 * debug_sessions itself is excluded because its sessionId field identifies the
 * session being managed rather than the session that should receive a routed
 * debugger operation. debug_compare_runs is also excluded because it explicitly
 * owns two independent session IDs in one read-only comparison request.
 */
export declare function routeSessionToolRegistrar<T extends ToolRegistrar>(registrar: T, registry: DapSessionRegistry): T;
export {};
