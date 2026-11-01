import { type RrDiscoveryResult } from './rr.js';
export type ManagedRrReplayStatus = {
    running: boolean;
    pid?: number;
    traceDir?: string;
    port?: number;
    rr?: RrDiscoveryResult;
    stderrTail: string[];
    startedAt?: string;
};
export declare class ManagedRrReplay {
    private child?;
    private stderrLines;
    private traceDir?;
    private port?;
    private rr?;
    private startedAt?;
    status(): ManagedRrReplayStatus;
    start(options: {
        traceDir: string;
        port: number;
        rrPath?: string;
        readyTimeoutMs?: number;
    }): Promise<ManagedRrReplayStatus>;
    stop(): Promise<ManagedRrReplayStatus>;
}
