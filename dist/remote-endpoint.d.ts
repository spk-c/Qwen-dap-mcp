export declare const REMOTE_DEBUG_HOSTS_ENV = "QWEN_DAP_MCP_REMOTE_DEBUG_HOSTS";
export type RemoteTcpEndpoint = {
    host: string;
    port: number;
    target: string;
    loopback: boolean;
};
export declare function normalizeRemoteDebugHost(value: string): string;
export declare function isLoopbackRemoteDebugHost(host: string): boolean;
export declare function assertRemoteDebugHostAllowed(host: string, env?: NodeJS.ProcessEnv): string;
export declare function buildRemoteTcpEndpoint(host: string, port: number, env?: NodeJS.ProcessEnv): RemoteTcpEndpoint;
export declare function parseRemoteTcpTarget(target: string, env?: NodeJS.ProcessEnv): RemoteTcpEndpoint;
