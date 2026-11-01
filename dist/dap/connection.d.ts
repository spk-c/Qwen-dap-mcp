import { EventEmitter } from 'node:events';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { type DapPolicyMode, type DapRequestPolicy } from './request-policy.js';
export type DapAdapterStartOptions = {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
};
export type DapConnectionOptions = {
    requestPolicy?: DapRequestPolicy;
    policyMode?: DapPolicyMode;
};
export type DapEventRecord = {
    receivedAt: string;
    event: string;
    body?: unknown;
};
export declare class DapConnection extends EventEmitter {
    private child?;
    private buffer;
    private nextSeq;
    private transportGeneration;
    private readonly pending;
    private readonly eventHistory;
    private readonly reverseRequestHistory;
    private readonly stderrLines;
    private requestPolicy;
    constructor(options?: DapConnectionOptions);
    /** Replace the transport policy used for future outgoing DAP requests. */
    setRequestPolicy(policy: DapRequestPolicy): void;
    get isRunning(): boolean;
    get pid(): number | undefined;
    get generation(): number;
    get recentReverseRequests(): readonly {
        receivedAt: string;
        command: string;
        arguments?: unknown;
    }[];
    get recentEvents(): readonly DapEventRecord[];
    get recentStderr(): readonly string[];
    start(options: DapAdapterStartOptions): Promise<void>;
    stop(): Promise<void>;
    sendRequest(command: string, args?: unknown, timeoutMs?: number): Promise<DebugProtocol.Response>;
    waitForEvent(eventName: string, timeoutMs?: number, predicate?: (event: DebugProtocol.Event) => boolean, includeRecent?: boolean): Promise<DebugProtocol.Event>;
    private writeMessage;
    private onStdout;
    private handleMessage;
    private sendUnsupportedReverseRequest;
    private captureStderr;
    private failProtocol;
    private rejectAll;
}
