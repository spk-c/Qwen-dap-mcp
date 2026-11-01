// Synthetic, self-contained Windows crash for CodeLLDB minidump tests only.
#if !defined(_WIN32)
#error This test fixture is Windows-only
#endif
#include <windows.h>
#include <dbghelp.h>
#pragma comment(lib, "Dbghelp.lib")

static LONG WINAPI save_minidump(EXCEPTION_POINTERS* exception) {
    char path[MAX_PATH] = {};
    DWORD count = GetEnvironmentVariableA("NATIVE_TEST_DUMP_PATH", path, MAX_PATH);
    if (!count || count >= MAX_PATH) return EXCEPTION_EXECUTE_HANDLER;
    HANDLE file = CreateFileA(path, GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
        FILE_ATTRIBUTE_NORMAL, nullptr);
    if (file == INVALID_HANDLE_VALUE) return EXCEPTION_EXECUTE_HANDLER;
    MINIDUMP_EXCEPTION_INFORMATION info = {};
    info.ThreadId = GetCurrentThreadId();
    info.ExceptionPointers = exception;
    info.ClientPointers = FALSE;
    MiniDumpWriteDump(GetCurrentProcess(), GetCurrentProcessId(), file,
        MiniDumpWithDataSegs, &info, nullptr, nullptr);
    CloseHandle(file);
    return EXCEPTION_EXECUTE_HANDLER;
}

extern "C" __declspec(noinline) void crash_marker() {
    volatile int* null_pointer = nullptr;
    *null_pointer = 7;
}

int main() {
    SetUnhandledExceptionFilter(save_minidump);
    crash_marker();
    return 0;
}
