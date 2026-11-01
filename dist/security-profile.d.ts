export type SecurityProfile = 'inspect' | 'local-debug' | 'advanced';
export type SecurityProfileDefaults = {
    toolset: 'agent' | 'forensics' | 'full';
    dapPolicy: 'standard' | 'inspect-only';
    description: string;
};
export declare function resolveSecurityProfile(value?: string | undefined): SecurityProfile;
export declare function securityProfileDefaults(profile?: SecurityProfile): SecurityProfileDefaults;
export declare function securityProfileSnapshot(env?: NodeJS.ProcessEnv): {
    profile: SecurityProfile;
    defaults: SecurityProfileDefaults;
    overrides: {
        toolset: string | undefined;
        dapPolicy: string | undefined;
        remoteHostsConfigured: boolean;
        holGuardEnabled: boolean;
        symbolServersConfigured: boolean;
    };
    note: string;
};
