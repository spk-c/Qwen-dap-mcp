import { DapError } from './dap/errors.js';
export type SecurityProfile = 'inspect' | 'local-debug' | 'advanced';
const PROFILES: Record<SecurityProfile, { toolset: string; dapPolicy: string; description: string }> = {
    inspect: {
        toolset: 'agent',
        dapPolicy: 'inspect-only',
        description: 'Read-oriented debugger inspection. Live execution/control requests remain transport-blocked.',
    },
    'local-debug': {
        toolset: 'agent',
        dapPolicy: 'standard',
        description: 'Compact agent surface with normal authorized local debugger execution/control.',
    },
    advanced: {
        toolset: 'forensics',
        dapPolicy: 'standard',
        description: 'High-level forensic workflows without exposing the raw manual DAP surface. Set QWEN_DAP_MCP_TOOLSET=full explicitly for low-level commands.',
    },
};
export function resolveSecurityProfile(value: string | undefined = process.env.QWEN_DAP_MCP_PROFILE): SecurityProfile {
    const normalized = value?.trim().toLowerCase();
    if (!normalized)
        return 'local-debug';
    if (normalized === 'inspect' || normalized === 'readonly' || normalized === 'read-only')
        return 'inspect';
    if (normalized === 'local-debug' || normalized === 'local' || normalized === 'agent')
        return 'local-debug';
    if (normalized === 'advanced' || normalized === 'full')
        return 'advanced';
    throw new DapError(`Unsupported QWEN_DAP_MCP_PROFILE '${value}'. Expected 'inspect', 'local-debug', or 'advanced'.`);
}
export function securityProfileDefaults(profile: SecurityProfile = resolveSecurityProfile()) {
    return PROFILES[profile];
}
export function securityProfileSnapshot(env = process.env) {
    const profile = resolveSecurityProfile(env.QWEN_DAP_MCP_PROFILE);
    const defaults = securityProfileDefaults(profile);
    return {
        profile,
        defaults,
        overrides: {
            toolset: env.QWEN_DAP_MCP_TOOLSET?.trim() || undefined,
            dapPolicy: env.QWEN_DAP_MCP_DAP_POLICY?.trim() || undefined,
            remoteHostsConfigured: Boolean(env.QWEN_DAP_MCP_REMOTE_DEBUG_HOSTS?.trim()),
            holGuardEnabled: /^(?:1|true|yes|on)$/i.test(env.QWEN_DAP_MCP_HOL_GUARD?.trim() ?? ''),
            symbolServersConfigured: Boolean(env.QWEN_DAP_MCP_SYMBOL_SERVERS?.trim()),
        },
        note: 'Profiles provide defaults only. Explicit toolset/DAP-policy settings override their corresponding profile defaults; remote allowlisting and HOL Guard remain independent safety gates.',
    };
}
//# sourceMappingURL=security-profile.js.map