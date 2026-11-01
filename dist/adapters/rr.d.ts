export type RrDiscoveryResult = {
    command: string;
    version: string;
    source: 'explicit' | 'environment' | 'path';
    searched: string[];
};
export type RrRecordOptions = {
    program: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    traceDir?: string;
    timeoutMs?: number;
    rrPath?: string;
};
export declare function discoverRr(options?: {
    explicitPath?: string;
    env?: NodeJS.ProcessEnv;
}): RrDiscoveryResult;
export declare function buildRrReplayPlan(options: {
    traceDir: string;
    port: number;
    rrPath?: string;
}): {
    rr: RrDiscoveryResult;
    traceDir: string;
    command: string;
    args: string[];
    gdbRemote: {
        host: string;
        port: number;
        target: string;
    };
    next: string;
    safety: string;
};
export declare function recordWithRr(options: RrRecordOptions): {
    rr: RrDiscoveryResult;
    program: string;
    cwd: string;
    requestedTraceDir: string | undefined;
    exitStatus: number | null;
    signal: NodeJS.Signals | null;
    success: boolean;
    stdout: string;
    stderr: string;
    commandIdentity: {
        command: string;
        args: string[];
        shell: boolean;
    };
    note: string;
};
