import { type RemoteTcpEndpoint } from '../remote-endpoint.js';
export type LldbDapDiscoverySource = 'explicit' | 'environment' | 'path' | 'toolchain' | 'xcrun';
export type LldbDapDiscoveryResult = {
    command: string;
    source: LldbDapDiscoverySource;
    searched: string[];
};
export type DiscoverLldbDapOptions = {
    explicitPath?: string;
    env?: NodeJS.ProcessEnv;
    toolchainCandidates?: string[];
    allowPathFallback?: boolean;
    allowToolchainFallback?: boolean;
    allowXcrunFallback?: boolean;
};
export type LldbDapLaunchOptions = {
    program: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stopOnEntry?: boolean;
};
export type LldbDapAttachOptions = {
    pid: number;
    program?: string;
    stopOnEntry?: boolean;
};
export type LldbDapRemoteAttachOptions = {
    host: string;
    port: number;
    program?: string;
    policyEnv?: NodeJS.ProcessEnv;
};
export type LldbDapCoreOptions = {
    coreFile: string;
    program: string;
    sourceMap?: Record<string, string>;
};
export declare function discoverLldbDap(options?: DiscoverLldbDapOptions): LldbDapDiscoveryResult;
export declare function buildLldbDapLaunchConfiguration(options: LldbDapLaunchOptions): Record<string, unknown>;
export declare function buildLldbDapAttachConfiguration(options: LldbDapAttachOptions): Record<string, unknown>;
export declare function resolveLldbDapRemoteEndpoint(options: LldbDapRemoteAttachOptions): RemoteTcpEndpoint;
/**
 * lldb-dap only gained native gdb-remote host/port attach fields in newer
 * releases. Ubuntu 24.04 still ships lldb-dap 18, which ignores those fields
 * and falls back to process-name attach. Generate one fixed attach command from
 * the already validated TCP endpoint so old and new adapters work without
 * exposing user-supplied LLDB command strings.
 */
export declare function buildLldbDapRemoteAttachConfiguration(options: LldbDapRemoteAttachOptions): Record<string, unknown>;
export declare function buildLldbDapCoreConfiguration(options: LldbDapCoreOptions): Record<string, unknown>;
