import { createHash, createHmac, randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DapError } from './errors.js';
import { mergeEnvironment } from './environment.js';
import { createDapRequestPolicy, resolveDapPolicyMode, } from './request-policy.js';
const HOL_GUARD_COMMANDS = new Set([
    'attach',
    'configurationDone',
    'continue',
    'disconnect',
    'evaluate',
    'goto',
    'launch',
    'next',
    'pause',
    'restart',
    'restartFrame',
    'reverseContinue',
    'setBreakpoints',
    'setDataBreakpoints',
    'setExceptionBreakpoints',
    'setExpression',
    'setFunctionBreakpoints',
    'setInstructionBreakpoints',
    'setVariable',
    'stepBack',
    'stepIn',
    'stepOut',
    'terminate',
    'terminateThreads',
    'writeMemory',
]);
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;
const ADAPTER_IDENTITY_VERSION = 'qwen-dap-mcp-adapter-v1';
const REDACTED_MARKER = '__qwenDapMcpRedacted';
const REDACTION_HMAC_KEY = randomBytes(32);
const BRIDGE_ENV_KEYS = new Set([
    'APPDATA',
    'COMSPEC',
    'HOME',
    'HOMEDRIVE',
    'HOMEPATH',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'LOCALAPPDATA',
    'PATH',
    'PATHEXT',
    'PROGRAMDATA',
    'PYTHONIOENCODING',
    'PYTHONUTF8',
    'REQUESTS_CA_BUNDLE',
    'SSL_CERT_DIR',
    'SSL_CERT_FILE',
    'SYSTEMDRIVE',
    'SYSTEMROOT',
    'TEMP',
    'TMP',
    'TMPDIR',
    'USER',
    'USERPROFILE',
    'VIRTUAL_ENV',
    'WINDIR',
    'XDG_CACHE_HOME',
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'XDG_RUNTIME_DIR',
]);
const SENSITIVE_ARGUMENT_KEYS = new Set([
    'accesstoken',
    'apikey',
    'auth',
    'authorization',
    'bearer',
    'clientsecret',
    'cookie',
    'cookies',
    'credential',
    'credentials',
    'password',
    'passwd',
    'privatekey',
    'refreshtoken',
    'secret',
    'secretkey',
    'sessiontoken',
    'token',
]);
const ENVIRONMENT_ARGUMENT_KEYS = new Set(['env', 'environment', 'environmentvariables']);
const CLI_ARGUMENT_KEYS = new Set(['args', 'arguments', 'argv', 'commandlineargs', 'programargs']);
function parseEnabled(value) {
    if (value === undefined || value.trim() === '')
        return false;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enforce'].includes(normalized))
        return true;
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized))
        return false;
    throw new DapError(`Unsupported QWEN_DAP_MCP_HOL_GUARD value '${value}'. Expected on/off, true/false, or 1/0.`);
}
function parseTimeout(value) {
    if (!value || value.trim() === '')
        return DEFAULT_TIMEOUT_MS;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 100 || parsed > MAX_TIMEOUT_MS) {
        throw new DapError(`Invalid QWEN_DAP_MCP_HOL_GUARD_TIMEOUT_MS '${value}'. Expected 100-${MAX_TIMEOUT_MS}.`);
    }
    return parsed;
}
function firstExecutableOnPath(name) {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(finder, [name], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 2_000,
    });
    if (result.status !== 0 || !result.stdout)
        return undefined;
    return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
}
function pythonBesideHolGuard() {
    const executable = firstExecutableOnPath('hol-guard');
    if (!executable)
        return undefined;
    let resolvedExecutable = executable;
    try {
        resolvedExecutable = realpathSync(executable);
    }
    catch {
        // Keep the PATH result. On Windows it is usually already the pipx venv executable.
    }
    const candidate = join(dirname(resolvedExecutable), process.platform === 'win32' ? 'python.exe' : 'python');
    return existsSync(candidate) ? candidate : undefined;
}
function resolvePythonCommand(explicit) {
    const configured = explicit?.trim() || process.env.QWEN_DAP_MCP_HOL_GUARD_PYTHON?.trim();
    const candidate = configured || pythonBesideHolGuard() || (process.platform === 'win32' ? 'python' : 'python3');
    const resolved = resolveAdapterExecutable(candidate, undefined, process.env);
    if (!resolved) {
        throw new DapError(`HOL Guard Python interpreter '${candidate}' could not be resolved to an executable file.`);
    }
    return resolved;
}
function defaultBridgePath() {
    const candidates = [
        fileURLToPath(new URL('../../scripts/hol-guard-dap-policy.py', import.meta.url)),
        fileURLToPath(new URL('../scripts/hol-guard-dap-policy.py', import.meta.url)),
    ];
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}
function resolveBridgePath(path) {
    try {
        if (!statSync(path).isFile())
            throw new DapError(`HOL Guard bridge is not a regular file: ${path}`);
        return realpathSync(path);
    }
    catch (error) {
        if (error instanceof DapError)
            throw error;
        throw new DapError(`HOL Guard bridge script not found or unreadable: ${path}`, {
            cause: error instanceof Error ? error : undefined,
        });
    }
}
function truncate(value, max = 500) {
    const compact = value.trim().replace(/\s+/g, ' ');
    return compact.length <= max ? compact : `${compact.slice(0, max)}…`;
}
function optionalString(record, key) {
    const value = record[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
}
function parseDecision(stdout) {
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch (error) {
        throw new DapError('HOL Guard bridge returned invalid JSON', {
            cause: error instanceof Error ? error : undefined,
        });
    }
    if (!parsed || typeof parsed !== 'object') {
        throw new DapError('HOL Guard bridge returned an invalid decision object');
    }
    const record = parsed;
    if (typeof record.allow !== 'boolean' || typeof record.action !== 'string' || typeof record.reason !== 'string') {
        throw new DapError('HOL Guard bridge decision is missing allow/action/reason');
    }
    return {
        allow: record.allow,
        action: record.action,
        reason: record.reason,
        ...(optionalString(record, 'source') ? { source: optionalString(record, 'source') } : {}),
        ...(optionalString(record, 'guardVersion') ? { guardVersion: optionalString(record, 'guardVersion') } : {}),
        ...(optionalString(record, 'approvalRequestId') ? { approvalRequestId: optionalString(record, 'approvalRequestId') } : {}),
        ...(optionalString(record, 'approvalCenterUrl') ? { approvalCenterUrl: optionalString(record, 'approvalCenterUrl') } : {}),
        ...(optionalString(record, 'reviewCommand') ? { reviewCommand: optionalString(record, 'reviewCommand') } : {}),
    };
}
export function buildHolGuardBridgeEnvironment(source = process.env) {
    const output = {};
    for (const [key, value] of Object.entries(source)) {
        if (value === undefined)
            continue;
        const normalized = key.toUpperCase();
        if (normalized === 'PYTHONPATH' || normalized === 'PYTHONHOME')
            continue;
        if (BRIDGE_ENV_KEYS.has(normalized) || normalized.startsWith('HOL_GUARD_'))
            output[key] = value;
    }
    return output;
}
function runBridge(pythonCommand, bridgePath, timeoutMs, action) {
    return new Promise((resolvePromise, reject) => {
        const child = spawn(pythonCommand, ['-I', bridgePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true,
            env: buildHolGuardBridgeEnvironment(),
        });
        let stdout = '';
        let stderr = '';
        let outputBytes = 0;
        let settled = false;
        const finish = (error, decision) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (error)
                reject(error);
            else
                resolvePromise(decision);
        };
        const append = (current, chunk) => {
            const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
            outputBytes += Buffer.byteLength(text, 'utf8');
            if (outputBytes > MAX_OUTPUT_BYTES) {
                child.kill('SIGKILL');
                finish(new DapError(`HOL Guard bridge output exceeded ${MAX_OUTPUT_BYTES} bytes`));
                return current;
            }
            return current + text;
        };
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            finish(new DapError(`HOL Guard policy process timed out after ${timeoutMs} ms`));
        }, timeoutMs);
        child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
        child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
        child.on('error', (error) => {
            finish(new DapError(`HOL Guard policy process failed: ${error.message}`, { cause: error }));
        });
        child.on('close', (code, signal) => {
            if (settled)
                return;
            if (code !== 0) {
                const detail = truncate(stderr || stdout || (signal ? `signal ${signal}` : `exit code ${String(code)}`));
                finish(new DapError(`HOL Guard policy process failed closed: ${detail}`));
                return;
            }
            try {
                finish(undefined, parseDecision(stdout));
            }
            catch (error) {
                finish(error instanceof Error ? error : new DapError(String(error)));
            }
        });
        child.stdin.on('error', (error) => {
            finish(new DapError(`HOL Guard bridge stdin failed: ${error.message}`, { cause: error }));
        });
        child.stdin.end(`${JSON.stringify(action)}\n`);
    });
}
export function buildHolGuardEnvironmentFingerprint(overrides) {
    const merged = {};
    for (const [key, value] of Object.entries(mergeEnvironment(process.env, overrides))) {
        if (typeof value === 'string')
            merged[key] = value;
    }
    const entries = Object.entries(merged).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    const hash = createHash('sha256');
    for (const [key, value] of entries) {
        hash.update(key, 'utf8');
        hash.update('\0');
        hash.update(value, 'utf8');
        hash.update('\0');
    }
    return {
        envKeys: entries.map(([key]) => key),
        envHash: `sha256:${hash.digest('hex')}`,
    };
}
function normalizedArgumentKey(key) {
    return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}
function canonicalJson(value, seen = new Set()) {
    if (value === null || typeof value !== 'object') {
        const serialized = JSON.stringify(value);
        return serialized === undefined ? String(value) : serialized;
    }
    if (seen.has(value))
        throw new DapError('DAP arguments contain a cycle and cannot be evaluated safely');
    seen.add(value);
    try {
        if (Array.isArray(value))
            return `[${value.map((item) => canonicalJson(item, seen)).join(',')}]`;
        const record = value;
        const entries = Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`);
        return `{${entries.join(',')}}`;
    }
    finally {
        seen.delete(value);
    }
}
function privacyDigest(value) {
    return createHmac('sha256', REDACTION_HMAC_KEY).update(value, 'utf8').digest('hex');
}
function redactedValue(value) {
    return {
        [REDACTED_MARKER]: true,
        sha256: `sha256:${privacyDigest(canonicalJson(value))}`,
        valueType: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
    };
}
function redactedArgText(value) {
    return `<redacted:sha256:${privacyDigest(value)}>`;
}
function adapterFlagName(value) {
    return normalizedArgumentKey(value.replace(/^--?/, '').split('=', 1)[0] ?? '');
}
export function sanitizeAdapterArgsForHolGuard(args) {
    const output = [];
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        const equals = arg.indexOf('=');
        if (equals > 0) {
            const left = arg.slice(0, equals);
            const right = arg.slice(equals + 1);
            if (SENSITIVE_ARGUMENT_KEYS.has(adapterFlagName(left))) {
                output.push(`${left}=${redactedArgText(right)}`);
                continue;
            }
        }
        const flag = adapterFlagName(arg);
        if (SENSITIVE_ARGUMENT_KEYS.has(flag) && index + 1 < args.length) {
            output.push(arg, redactedArgText(args[index + 1]));
            index += 1;
            continue;
        }
        output.push(arg);
    }
    return output;
}
function sanitizeEnvironmentContainer(value) {
    if (Array.isArray(value)) {
        return value.map((item) => {
            if (typeof item === 'string') {
                const separator = item.indexOf('=');
                if (separator > 0) {
                    return `${item.slice(0, separator)}=${redactedArgText(item.slice(separator + 1))}`;
                }
                return redactedValue(item);
            }
            if (item && typeof item === 'object') {
                const output = {};
                for (const [key, nested] of Object.entries(item)) {
                    output[key] = normalizedArgumentKey(key) === 'value'
                        ? redactedValue(nested)
                        : sanitizeValue(nested, key);
                }
                return output;
            }
            return redactedValue(item);
        });
    }
    if (value && typeof value === 'object') {
        const environment = {};
        for (const [envKey, envValue] of Object.entries(value)) {
            environment[envKey] = redactedValue(envValue);
        }
        return environment;
    }
    return redactedValue(value);
}
function sanitizeValue(value, keyHint) {
    const normalizedKey = keyHint === undefined ? undefined : normalizedArgumentKey(keyHint);
    if (normalizedKey && SENSITIVE_ARGUMENT_KEYS.has(normalizedKey))
        return redactedValue(value);
    if (normalizedKey && ENVIRONMENT_ARGUMENT_KEYS.has(normalizedKey))
        return sanitizeEnvironmentContainer(value);
    if (normalizedKey
        && CLI_ARGUMENT_KEYS.has(normalizedKey)
        && Array.isArray(value)
        && value.every((item) => typeof item === 'string')) {
        return sanitizeAdapterArgsForHolGuard(value);
    }
    if (Array.isArray(value))
        return value.map((item) => sanitizeValue(item));
    if (!value || typeof value !== 'object')
        return value;
    const record = value;
    const output = {};
    for (const [key, item] of Object.entries(record)) {
        output[key] = sanitizeValue(item, key);
    }
    return output;
}
export function sanitizeDapArgumentsForHolGuard(args) {
    return sanitizeValue(args);
}
function envValue(env, name) {
    if (process.platform !== 'win32')
        return env[name];
    const target = name.toUpperCase();
    const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === target);
    return key === undefined ? undefined : env[key];
}
function executableNames(command, env) {
    if (process.platform !== 'win32' || extname(command))
        return [command];
    const extensions = (envValue(env, 'PATHEXT') || '.COM;.EXE;.BAT;.CMD')
        .split(';').map((value) => value.trim()).filter(Boolean);
    return [command, ...extensions.map((extension) => `${command}${extension}`)];
}
function executableFile(path) {
    try {
        if (!statSync(path).isFile())
            return false;
        if (process.platform !== 'win32')
            accessSync(path, constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function realExecutable(path) {
    if (!executableFile(path))
        return undefined;
    try {
        return realpathSync(path);
    }
    catch {
        return path;
    }
}
export function resolveAdapterExecutable(command, cwd, env) {
    const baseCwd = cwd ? resolve(cwd) : process.cwd();
    const pathLike = isAbsolute(command) || command.includes('/') || command.includes('\\');
    if (pathLike) {
        const base = isAbsolute(command) ? command : resolve(baseCwd, command);
        for (const candidate of executableNames(base, env)) {
            const found = realExecutable(candidate);
            if (found)
                return found;
        }
        return undefined;
    }
    const pathValue = envValue(env, 'PATH') ?? '';
    for (const pathEntry of pathValue.split(delimiter)) {
        const directory = pathEntry ? (isAbsolute(pathEntry) ? pathEntry : resolve(baseCwd, pathEntry)) : baseCwd;
        for (const name of executableNames(command, env)) {
            const found = realExecutable(resolve(directory, name));
            if (found)
                return found;
        }
    }
    return undefined;
}
function hashExecutable(path) {
    const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
    return `sha256:${digest}`;
}
function hashFile(path) {
    return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}
function buildAdapterIdentityHash(context, rawArgs) {
    const material = {
        version: ADAPTER_IDENTITY_VERSION,
        command: context.adapterCommand ?? null,
        args: rawArgs,
        resolvedCommand: context.adapterResolvedCommand ?? null,
        executableHash: context.adapterExecutableHash ?? null,
        cwd: context.cwd ?? null,
        envHash: context.envHash ?? null,
        envKeys: context.envKeys ?? [],
    };
    const digest = createHash('sha256').update(JSON.stringify(material), 'utf8').digest('hex');
    return `sha256:${digest}`;
}
function decisionReason(decision) {
    const approvalHint = decision.reviewCommand
        ? `; approval: ${decision.reviewCommand}`
        : decision.approvalRequestId
            ? `; approval request: ${decision.approvalRequestId}`
            : '';
    return `HOL Guard '${decision.action}': ${decision.reason}${approvalHint}`;
}
function isPolicyPromise(value) {
    return typeof value.then === 'function';
}
export function createHolGuardEvaluator(options = {}) {
    const enabled = options.enabled ?? parseEnabled(process.env.QWEN_DAP_MCP_HOL_GUARD);
    if (!enabled) {
        return { enabled: false, evaluate: async () => ({ allow: true, action: 'allow', reason: 'HOL Guard integration disabled' }) };
    }
    const pythonCommand = resolvePythonCommand(options.pythonCommand);
    const pythonExecutableHash = hashExecutable(pythonCommand);
    const bridgePath = resolveBridgePath(options.bridgePath ?? defaultBridgePath());
    const bridgeHash = hashFile(bridgePath);
    const timeoutMs = options.timeoutMs ?? parseTimeout(process.env.QWEN_DAP_MCP_HOL_GUARD_TIMEOUT_MS);
    return {
        enabled: true,
        async evaluate(action) {
            if (hashExecutable(pythonCommand) !== pythonExecutableHash) {
                throw new DapError('HOL Guard Python interpreter changed after evaluator initialization; refusing policy execution.');
            }
            if (hashFile(bridgePath) !== bridgeHash) {
                throw new DapError('HOL Guard bridge script changed after evaluator initialization; refusing policy execution.');
            }
            return runBridge(pythonCommand, bridgePath, timeoutMs, action);
        },
    };
}
export function shouldConsultHolGuard(command) {
    return HOL_GUARD_COMMANDS.has(command);
}
export function createGuardedDapRequestPolicy(evaluator, policyMode = resolveDapPolicyMode(), contextProvider) {
    const builtIn = createDapRequestPolicy(policyMode);
    const applyHolGuard = (context, localDecision) => {
        if (!localDecision.allow)
            return localDecision;
        if (!evaluator.enabled || !shouldConsultHolGuard(context.command))
            return localDecision;
        const executionContext = contextProvider?.();
        const actionContext = executionContext ?? {};
        return evaluator.evaluate({
            kind: 'dap-request',
            command: context.command,
            ...(context.args === undefined ? {} : { args: sanitizeDapArgumentsForHolGuard(context.args) }),
            ...actionContext,
        }).then((decision) => {
            if (contextProvider && contextProvider() !== executionContext) {
                return {
                    allow: false,
                    reason: 'HOL Guard decision invalidated because the DAP session changed while policy evaluation was pending',
                };
            }
            return decision.allow
                ? { allow: true }
                : { allow: false, reason: decisionReason(decision) };
        });
    };
    return (context) => {
        const localResult = builtIn(context);
        return isPolicyPromise(localResult)
            ? localResult.then((decision) => applyHolGuard(context, decision))
            : applyHolGuard(context, localResult);
    };
}
export async function requireHolGuardAdapterStart(evaluator, options) {
    const rawArgs = options.args ?? [];
    const environment = buildHolGuardEnvironmentFingerprint(options.env);
    const baseContext = {
        ...(options.cwd ? { cwd: options.cwd } : {}),
        adapterCommand: options.command,
        adapterArgs: sanitizeAdapterArgsForHolGuard(rawArgs),
        ...environment,
    };
    if (!evaluator.enabled)
        return baseContext;
    const effectiveEnv = mergeEnvironment(process.env, options.env);
    const resolvedCommand = resolveAdapterExecutable(options.command, options.cwd, effectiveEnv);
    const executableHash = resolvedCommand ? hashExecutable(resolvedCommand) : undefined;
    const context = {
        ...baseContext,
        ...(resolvedCommand ? { adapterResolvedCommand: resolvedCommand } : {}),
        ...(executableHash ? { adapterExecutableHash: executableHash } : {}),
    };
    context.adapterIdentityHash = buildAdapterIdentityHash(context, rawArgs);
    let decision;
    try {
        decision = await evaluator.evaluate({
            kind: 'adapter-start',
            command: options.command,
            args: sanitizeAdapterArgsForHolGuard(rawArgs),
            ...context,
        });
    }
    catch (error) {
        throw new DapError('HOL Guard adapter-start policy failed closed', {
            cause: error instanceof Error ? error : undefined,
        });
    }
    if (!decision.allow)
        throw new DapError(`HOL Guard blocked DAP adapter start: ${decisionReason(decision)}`);
    if (!resolvedCommand || !executableHash) {
        throw new DapError(`HOL Guard allowed adapter start but executable identity could not be resolved for '${options.command}'`);
    }
    const currentHash = hashExecutable(resolvedCommand);
    if (currentHash !== executableHash) {
        throw new DapError('HOL Guard adapter executable changed after policy approval; refusing to spawn it');
    }
    return context;
}