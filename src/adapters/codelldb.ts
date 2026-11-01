// @ts-nocheck
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DapError } from '../dap/errors.js';
import { resolveExistingDirectory, resolveExistingFile } from '../local-path.js';
const MIN_CODELLDB_EXTENSION_VERSION = [1, 11, 0];
function isFile(path) {
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
function executableName() {
    return process.platform === 'win32' ? 'codelldb.exe' : 'codelldb';
}
function defaultExtensionRoots(env, homeDirectory) {
    const roots = [
        env.VSCODE_EXTENSIONS,
        join(homeDirectory, '.vscode', 'extensions'),
        join(homeDirectory, '.vscode-insiders', 'extensions'),
        join(homeDirectory, '.cursor', 'extensions'),
        join(homeDirectory, '.windsurf', 'extensions'),
        join(homeDirectory, '.vscode-oss', 'extensions'),
    ].filter((value) => Boolean(value));
    return [...new Set(roots.map((root) => resolve(root)))];
}
function extensionVersion(entry) {
    const match = /^vadimcn\.vscode-lldb-(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/i.exec(entry);
    if (!match)
        return undefined;
    const version = [Number(match[1]), Number(match[2]), Number(match[3])];
    return version.every((value) => Number.isSafeInteger(value) && value >= 0) ? version : undefined;
}
function versionAtLeast(version, minimum) {
    for (let index = 0; index < Math.max(version.length, minimum.length); index += 1) {
        const current = version[index] ?? 0;
        const required = minimum[index] ?? 0;
        if (current > required)
            return true;
        if (current < required)
            return false;
    }
    return true;
}
function findExtensionAdapter(root, searched) {
    if (!existsSync(root)) {
        searched.push(root);
        return undefined;
    }
    let entries;
    try {
        entries = readdirSync(root)
            .filter((entry) => entry.startsWith('vadimcn.vscode-lldb-'))
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
    }
    catch {
        searched.push(root);
        return undefined;
    }
    for (const entry of entries) {
        const extensionDirectory = join(root, entry);
        const candidate = join(extensionDirectory, 'adapter', executableName());
        searched.push(candidate);
        const version = extensionVersion(entry);
        if (!version || !versionAtLeast(version, MIN_CODELLDB_EXTENSION_VERSION))
            continue;
        if (isFile(candidate)) {
            return {
                command: candidate,
                source: 'extension',
                extensionDirectory,
                searched,
            };
        }
    }
    return undefined;
}
function findOnPath(command) {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    const result = spawnSync(locator, [command], {
        encoding: 'utf8',
        windowsHide: true,
        shell: false,
        timeout: 5_000,
        maxBuffer: 64 * 1024,
    });
    if (result.error || result.status !== 0 || !result.stdout) {
        return undefined;
    }
    const first = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
    return first && isFile(first) ? first : undefined;
}
export function discoverCodeLldb(options = {}) {
    const env = options.env ?? process.env;
    const searched = [];
    if (options.explicitPath) {
        const candidate = resolveExistingFile(options.explicitPath, 'CodeLLDB adapter');
        searched.push(candidate);
        return { command: candidate, source: 'explicit', searched };
    }
    if (env.CODELLDB_PATH) {
        const candidate = resolve(env.CODELLDB_PATH);
        searched.push(candidate);
        if (isFile(candidate)) {
            return { command: candidate, source: 'environment', searched };
        }
    }
    const roots = options.extensionRoots ?? defaultExtensionRoots(env, options.homeDirectory ?? homedir());
    for (const root of roots) {
        const found = findExtensionAdapter(resolve(root), searched);
        if (found) {
            return found;
        }
    }
    if (options.allowPathFallback !== false) {
        const onPath = findOnPath(executableName());
        searched.push(executableName());
        if (onPath) {
            return { command: onPath, source: 'path', searched };
        }
    }
    throw new Error(`CodeLLDB was not found. Install vadimcn.vscode-lldb >= 1.11.0, set CODELLDB_PATH, or pass adapterPath. Extension discovery rejects versions older than 1.11.0. Searched: ${searched.join(', ')}`);
}
export function buildCodeLldbLaunchConfiguration(options) {
    const program = resolveExistingFile(options.program, 'Program executable');
    const cwd = options.cwd
        ? resolveExistingDirectory(options.cwd, 'Working directory')
        : dirname(program);
    return {
        type: 'lldb',
        request: 'launch',
        name: 'qwen-dap-mcp CodeLLDB launch',
        program,
        args: options.args ?? [],
        cwd,
        ...(options.env ? { env: options.env } : {}),
        stopOnEntry: options.stopOnEntry ?? false,
        // Keep debuggee I/O inside DAP so the bridge never needs to honor runInTerminal.
        terminal: 'console',
    };
}
export function buildCodeLldbAttachConfiguration(options) {
    if (!Number.isSafeInteger(options.pid) || options.pid <= 0) {
        throw new DapError(`CodeLLDB attach PID must be a positive safe integer; received ${String(options.pid)}`);
    }
    const program = options.program
        ? resolveExistingFile(options.program, 'Program image')
        : undefined;
    return {
        type: 'lldb',
        request: 'attach',
        name: 'qwen-dap-mcp CodeLLDB attach',
        pid: options.pid,
        ...(program ? { program } : {}),
        stopOnEntry: options.stopOnEntry ?? true,
    };
}
//# sourceMappingURL=codelldb.js.map