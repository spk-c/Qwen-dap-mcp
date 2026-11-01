import * as z from 'zod/v4';
import { buildLldbDapAttachConfiguration, buildLldbDapLaunchConfiguration, buildLldbDapRemoteAttachConfiguration, discoverLldbDap, resolveLldbDapRemoteEndpoint, } from '../adapters/lldb-dap.js';
import { REMOTE_DEBUG_HOSTS_ENV } from '../remote-endpoint.js';
import { DEBUG_SESSION_CONTROL_ANNOTATIONS, LOCAL_TARGET_EXECUTION_ANNOTATIONS, READ_ONLY_LOCAL_TOOL_ANNOTATIONS, } from './tool-annotations.js';
const breakpointGroupSchema = z.object({
    source: z.string().min(1),
    lines: z.array(z.number().int().positive()).min(1),
});
function result(value) {
    return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}
function errorResult(error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: message }], isError: true };
}
function wrap(handler) {
    return async (args) => {
        try {
            return result(await handler(args));
        }
        catch (error) {
            return errorResult(error);
        }
    };
}
export function registerLldbDapTools(server, session) {
    server.registerTool('debug_lldb_dap_info', {
        title: 'Locate lldb-dap',
        description: 'Locate the upstream LLVM lldb-dap adapter from an explicit path, LLDB_DAP_PATH, PATH (including common versioned binary names), or xcrun on macOS. This only discovers a local executable and does not start a debugger or target process.',
        annotations: READ_ONLY_LOCAL_TOOL_ANNOTATIONS,
        inputSchema: z.object({
            adapterPath: z.string().min(1).optional(),
        }),
    }, wrap(async ({ adapterPath }) => discoverLldbDap({
        ...(adapterPath ? { explicitPath: adapterPath } : {}),
    })));
    server.registerTool('debug_start_lldb_dap', {
        title: 'Start lldb-dap',
        description: 'Discover and initialize the upstream LLVM lldb-dap adapter over local stdio. This starts the debugger adapter only; it does not launch or attach a debuggee until a separate launch/attach operation is requested.',
        annotations: DEBUG_SESSION_CONTROL_ANNOTATIONS,
        inputSchema: z.object({
            adapterPath: z.string().min(1).optional(),
            cwd: z.string().optional(),
            requestTimeoutMs: z.number().int().min(1000).max(120000).optional(),
        }),
    }, wrap(async ({ adapterPath, cwd, requestTimeoutMs }) => {
        const adapter = discoverLldbDap({
            ...(adapterPath ? { explicitPath: adapterPath } : {}),
        });
        const capabilities = await session.start({
            command: adapter.command,
            adapterId: 'lldb-dap',
            ...(cwd ? { cwd: cwd } : {}),
            ...(requestTimeoutMs ? { requestTimeoutMs: requestTimeoutMs } : {}),
        });
        return { adapter, capabilities, status: session.snapshot() };
    }));
    server.registerTool('debug_launch_lldb_dap', {
        title: 'Launch with lldb-dap',
        description: 'Launch an authorized local native program through an initialized upstream LLVM lldb-dap session. The profile uses internalConsole so qwen-dap-mcp never needs to execute the adapter runInTerminal reverse request.',
        annotations: DEBUG_SESSION_CONTROL_ANNOTATIONS,
        inputSchema: z.object({
            program: z.string().min(1),
            args: z.array(z.string()).optional(),
            cwd: z.string().optional(),
            env: z.record(z.string(), z.string()).optional(),
            stopOnEntry: z.boolean().default(false),
            breakpoints: z.array(breakpointGroupSchema).optional(),
        }),
    }, wrap(async ({ program, args, cwd, env, stopOnEntry, breakpoints }) => session.launch(buildLldbDapLaunchConfiguration({
        program: program,
        ...(args ? { args: args } : {}),
        ...(cwd ? { cwd: cwd } : {}),
        ...(env ? { env: env } : {}),
        stopOnEntry: stopOnEntry,
    }), (breakpoints ?? []))));
    server.registerTool('debug_attach_lldb_dap', {
        title: 'Attach with lldb-dap',
        description: 'Attach an initialized upstream LLVM lldb-dap session to an authorized local native process by PID. This can change the target process state and should only be used when attaching is explicitly permitted.',
        annotations: DEBUG_SESSION_CONTROL_ANNOTATIONS,
        inputSchema: z.object({
            pid: z.number().int().positive(),
            program: z.string().min(1).optional(),
            stopOnEntry: z.boolean().default(true),
            breakpoints: z.array(breakpointGroupSchema).optional(),
        }),
    }, wrap(async ({ pid, program, stopOnEntry, breakpoints }) => session.attach(buildLldbDapAttachConfiguration({
        pid: pid,
        ...(program ? { program: program } : {}),
        stopOnEntry: stopOnEntry,
    }), (breakpoints ?? []))));
    server.registerTool('debug_attach_lldb_dap_remote', {
        title: 'Attach lldb-dap to lldb-server',
        description: `Use this to connect an initialized upstream lldb-dap session to an authorized lldb-server gdbserver TCP endpoint. qwen-dap-mcp validates the structured host/port first, then generates exactly one gdb-remote host:port attach command for compatibility with older lldb-dap releases such as version 18; user-supplied LLDB commands are never accepted. Loopback is allowed by default; a non-loopback host must be listed exactly in ${REMOTE_DEBUG_HOSTS_ENV}. Do not use this for lldb-server platform mode.`,
        annotations: LOCAL_TARGET_EXECUTION_ANNOTATIONS,
        inputSchema: z.object({
            host: z.string().min(1).describe(`Authorized lldb-server hostname/IP. Loopback is allowed automatically; other exact hosts require ${REMOTE_DEBUG_HOSTS_ENV}.`),
            port: z.number().int().min(1).max(65535).describe('lldb-server gdbserver TCP port from 1 through 65535.'),
            program: z.string().min(1).optional().describe('Optional local matching executable image for symbols and pre-attach breakpoint resolution.'),
            breakpoints: z.array(breakpointGroupSchema).optional().describe('Optional source breakpoints configured around remote attach setup.'),
        }),
    }, wrap(async ({ host, port, program, breakpoints }) => {
        const options = {
            host: host,
            port: port,
            ...(program ? { program: program } : {}),
        };
        const endpoint = resolveLldbDapRemoteEndpoint(options);
        const attach = await session.attach(buildLldbDapRemoteAttachConfiguration(options), (breakpoints ?? []));
        return { endpoint, attach, status: session.snapshot() };
    }));
}
//# sourceMappingURL=register-lldb-dap-tools.js.map