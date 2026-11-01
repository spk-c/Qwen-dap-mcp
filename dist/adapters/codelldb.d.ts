export type CodeLldbDiscoverySource = 'explicit' | 'environment' | 'extension' | 'path';
export type CodeLldbDiscoveryResult = {
    command: string;
    source: CodeLldbDiscoverySource;
    extensionDirectory?: string;
    searched: string[];
};
export type DiscoverCodeLldbOptions = {
    explicitPath?: string;
    extensionRoots?: string[];
    env?: NodeJS.ProcessEnv;
    homeDirectory?: string;
    allowPathFallback?: boolean;
};
export type CodeLldbLaunchOptions = {
    program: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stopOnEntry?: boolean;
};
export type CodeLldbAttachOptions = {
    pid: number;
    program?: string;
    stopOnEntry?: boolean;
};
export declare function discoverCodeLldb(options?: DiscoverCodeLldbOptions): CodeLldbDiscoveryResult;
export declare function buildCodeLldbLaunchConfiguration(options: CodeLldbLaunchOptions): Record<string, unknown>;
export declare function buildCodeLldbAttachConfiguration(options: CodeLldbAttachOptions): Record<string, unknown>;
