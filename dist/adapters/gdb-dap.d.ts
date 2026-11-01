import { type RemoteTcpEndpoint } from '../remote-endpoint.js';
export declare const MIN_GDB_DAP_MAJOR = 14;
export type GdbDapDiscoverySource = 'explicit' | 'environment' | 'home' | 'path';
export type GdbDapVersion = {
    major: number;
    minor?: number;
    raw: string;
};
export type GdbDapDiscoveryResult = {
    command: string;
    args: string[];
    source: GdbDapDiscoverySource;
    searched: string[];
    version: GdbDapVersion;
};
export type DiscoverGdbDapOptions = {
    explicitPath?: string;
    env?: NodeJS.ProcessEnv;
    allowPathFallback?: boolean;
};
export type GdbDapLaunchOptions = {
    program: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stopOnEntry?: boolean;
    stopAtBeginningOfMainSubprogram?: boolean;
};
export type GdbDapPidAttachOptions = {
    pid: number;
    program?: string;
};
export type GdbDapRemoteAttachOptions = {
    /** Backward-compatible TCP host:port form. Non-TCP GDB target strings are rejected. */
    target?: string;
    host?: string;
    port?: number;
    program?: string;
    policyEnv?: NodeJS.ProcessEnv;
};
export type GdbDapCoreOptions = {
    coreFile: string;
    program?: string;
};
export declare function parseGdbVersion(output: string): GdbDapVersion | undefined;
export declare function discoverGdbDap(options?: DiscoverGdbDapOptions): GdbDapDiscoveryResult;
export declare function buildGdbDapLaunchConfiguration(options: GdbDapLaunchOptions): Record<string, unknown>;
export declare function buildGdbDapPidAttachConfiguration(options: GdbDapPidAttachOptions): Record<string, unknown>;
export declare function resolveGdbDapRemoteEndpoint(options: GdbDapRemoteAttachOptions): RemoteTcpEndpoint;
export declare function buildGdbDapRemoteAttachConfiguration(options: GdbDapRemoteAttachOptions): Record<string, unknown>;
export declare function buildGdbDapCoreConfiguration(options: GdbDapCoreOptions): Record<string, unknown>;
