// @ts-nocheck
import { DapError } from './errors.js';
import { resolveSecurityProfile, securityProfileDefaults } from '../security-profile.js';
const INSPECT_ONLY_ALLOWED_COMMANDS = new Set([
    'initialize',
    'cancel',
    'configurationDone',
    'threads',
    'stackTrace',
    'scopes',
    'variables',
    'modules',
    'disassemble',
    'readMemory',
    'exceptionInfo',
    'source',
    'loadedSources',
    'breakpointLocations',
]);
const ALLOW = { allow: true };
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * Recognize only the dump/core attach shapes emitted by this project.
 * Generic attach remains denied because it can stop/control a live process.
 */
const CORE_ATTACH_KEYS = new Set(['coreFile', 'program', 'type', 'request', 'name', 'sourceMap']);
const CODELLDB_DUMP_KEYS = new Set(['type', 'request', 'name', 'targetCreateCommands', 'processCreateCommands', 'sourceMap']);
const CODELLDB_DUMP_COMMAND = /^target create -c "(?:[^"\\\r\n]|\\["\\])*"(?: "(?:[^"\\\r\n]|\\["\\])*")?$/;
function hasOnlyKeys(value, keys) {
    return Object.keys(value).every((key) => keys.has(key));
}
function safePath(value) {
    return typeof value === 'string' && value.trim().length > 0 && !/[\0\r\n]/.test(value);
}
function safeSourceMap(value) {
    if (value === undefined)
        return true;
    if (Array.isArray(value))
        return value.every((entry) => Array.isArray(entry) && entry.length === 2 && entry.every(safePath));
    return isRecord(value) && Object.entries(value).every(([key, path]) => safePath(key) && safePath(path));
}
/**
 * Narrowly permit only internally generated postmortem attach shapes.
 * Unknown keys are rejected to prevent live attach or arbitrary debugger
 * commands being smuggled alongside a legitimate-looking coreFile.
 */
export function isInspectOnlyPostmortemAttach(args) {
    if (!isRecord(args))
        return false;
    if (Object.hasOwn(args, 'coreFile')) {
        return hasOnlyKeys(args, CORE_ATTACH_KEYS)
            && safePath(args.coreFile)
            && (args.program === undefined || safePath(args.program))
            && (args.type === undefined || args.type === 'lldb-dap')
            && (args.request === undefined || args.request === 'attach')
            && (args.name === undefined || typeof args.name === 'string')
            && safeSourceMap(args.sourceMap);
    }
    if (!hasOnlyKeys(args, CODELLDB_DUMP_KEYS)
        || args.type !== 'lldb'
        || args.request !== 'attach'
        || (args.name !== undefined && typeof args.name !== 'string')
        || !Array.isArray(args.targetCreateCommands)
        || args.targetCreateCommands.length !== 1
        || !Array.isArray(args.processCreateCommands)
        || args.processCreateCommands.length !== 0
        || !safeSourceMap(args.sourceMap))
        return false;
    return typeof args.targetCreateCommands[0] === 'string'
        && CODELLDB_DUMP_COMMAND.test(args.targetCreateCommands[0]);
}
/**
 * Build a transport-level DAP request policy.
 *
 * `standard` preserves the normal debugger feature set. `inspect-only` is a
 * fail-closed mode intended for agents or policy engines that must only read
 * debugger state: commands that are not explicitly known to be inspection
 * operations are denied. In particular, DAP `evaluate` and live `launch` /
 * `attach` are denied because they can execute code or control a target.
 * A narrowly recognized core/minidump attach is permitted so postmortem reads
 * remain usable without granting live-process attach authority.
 */
export function createDapRequestPolicy(mode = 'standard') {
    if (mode === 'standard')
        return () => ALLOW;
    return ({ command, args }) => {
        if (INSPECT_ONLY_ALLOWED_COMMANDS.has(command))
            return ALLOW;
        if (command === 'attach' && isInspectOnlyPostmortemAttach(args))
            return ALLOW;
        return {
            allow: false,
            reason: `DAP policy '${mode}' only permits explicit inspection requests; '${command}' may change or execute target state`,
        };
    };
}
/** Resolve the built-in policy from QWEN_DAP_MCP_DAP_POLICY. */
export function resolveDapPolicyMode(value = process.env.QWEN_DAP_MCP_DAP_POLICY) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized)
        return securityProfileDefaults(resolveSecurityProfile()).dapPolicy;
    if (normalized === 'standard')
        return 'standard';
    if (normalized === 'inspect-only' || normalized === 'readonly' || normalized === 'read-only') {
        return 'inspect-only';
    }
    throw new DapError(`Unsupported QWEN_DAP_MCP_DAP_POLICY '${value}'. Expected 'standard' or 'inspect-only' (alias: 'read-only').`);
}
//# sourceMappingURL=request-policy.js.map