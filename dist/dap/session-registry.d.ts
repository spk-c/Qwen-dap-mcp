import { GuardedDapSession } from './guarded-session.js';
export declare const DEFAULT_DAP_SESSION_ID = "default";
export declare const DEFAULT_MAX_DAP_SESSIONS = 8;
export type DapSessionRegistryEntry = {
    sessionId: string;
    isDefault: boolean;
    activeRequests: number;
    snapshot: ReturnType<GuardedDapSession['snapshot']>;
};
export type DapSessionRegistryOptions = {
    defaultSessionId?: string;
    maxSessions?: number;
    sessionFactory?: () => GuardedDapSession;
};
/**
 * Owns independent guarded DAP sessions and binds one session ID to the
 * lifetime of a single async MCP request.
 *
 * The AsyncLocalStorage context is deliberately request-local: there is no
 * process-global "selected session" that concurrent MCP calls can race.
 * Existing callers that omit sessionId continue to use the default session.
 */
export declare class DapSessionRegistry {
    readonly defaultSessionId: string;
    readonly maxSessions: number;
    private readonly sessions;
    private readonly activeRequestCounts;
    private readonly closingSessionIds;
    private readonly sessionContext;
    private readonly sessionFactory;
    private generatedSessionCounter;
    constructor(options?: DapSessionRegistryOptions);
    create(requestedSessionId?: string): {
        sessionId: string;
        session: GuardedDapSession;
    };
    has(sessionId: string): boolean;
    get(sessionId?: string): GuardedDapSession;
    currentSessionId(): string;
    activeRequests(sessionId: string): number;
    runWithSession<T>(sessionId: string | undefined, action: () => T): T;
    list(): DapSessionRegistryEntry[];
    close(sessionId: string, terminateDebuggee?: boolean): Promise<{
        sessionId: string;
        removed: boolean;
    }>;
    /**
     * Best-effort server-shutdown cleanup. This intentionally bypasses the
     * user-facing busy-session close guard because shutdown must not leave
     * adapter processes owned by this MCP server behind. By default the bridge
     * detaches/stops adapters without asking debuggers to terminate debuggees.
     */
    closeAll(terminateDebuggees?: boolean): Promise<void>;
    /**
     * Return a stable object that dynamically delegates every property/method to
     * the session bound to the current async request. Methods are bound to the
     * real GuardedDapSession instance so private fields and lifecycle guards keep
     * their normal semantics.
     */
    createRoutedSession(): GuardedDapSession;
    private incrementActiveRequests;
    private decrementActiveRequests;
    private nextGeneratedSessionId;
    private assertSessionId;
}
