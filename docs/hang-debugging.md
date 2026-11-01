# Hang investigation

Use `debug_this_hang` for a local target with an authorized suspended debugger session. Capture stacks of **all threads** and compare waiting versus runnable frames. A blocked thread alone does not prove a deadlock.

Use `debug_progress_probe` if repeated bounded observations are necessary to distinguish a busy-loop from a blocked wait. Use `debug_thread_timeline` (forensics toolset) to compare thread progress and independently established lock ownership.

Check for external I/O and system waits. Avoid automated resume/step in processes whose side effects cannot be safely repeated. Save bounded evidence and confirm a recovered program makes forward progress before calling a fix verified.
