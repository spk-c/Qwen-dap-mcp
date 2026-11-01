export declare function normalizeEnvironmentOverrides(overrides: Record<string, string> | undefined, base?: NodeJS.ProcessEnv, platform?: NodeJS.Platform): Record<string, string>;
export declare function mergeEnvironment(base?: NodeJS.ProcessEnv, overrides?: Record<string, string>, platform?: NodeJS.Platform): NodeJS.ProcessEnv;
