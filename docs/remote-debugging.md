# Remote debugging

A native debugger has extensive control over its target. **Do not expose unauthenticated gdbserver/remote debug ports to public networks.** Prefer a local loopback endpoint through an SSH or VPN tunnel.

The bridge accepts loopback hosts by default and other hosts only through `QWEN_DAP_MCP_REMOTE_DEBUG_HOSTS`. Remote TCP targets must have a valid host and port; ambiguous `target` versus `host+port` configurations are rejected.

For controlled integration, compile `integration/fixture/native-debug.cpp`, start a test-only `gdbserver` on a local loopback port and use the GDB remote attach configuration. Avoid using real customer programs or privileged system processes.

Test networking, unexpected disconnections, port collisions and session cleanup before using remote debugging operationally. The current native CI covers local launch; remote E2E coverage should be treated as distinct until its job passes.
