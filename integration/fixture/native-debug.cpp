// Dedicated native-debugging fixture. It only touches its own memory/process.
#include <cstring>
#include <cstdio>
#if defined(_MSC_VER)
#define NOINLINE __declspec(noinline)
#else
#define NOINLINE __attribute__((noinline))
#endif

extern "C" NOINLINE int debug_probe(volatile int* value) {
    volatile int observed = *value; // NATIVE_BREAKPOINT
    return observed + 7;
}

extern "C" NOINLINE void crash_marker() {
    volatile int* invalid = nullptr;
    *invalid = 1; // NATIVE_CRASH
}

int main(int argc, char** argv) {
    volatile int number = 41;
    const int result = debug_probe(&number);
    if (result != 48) return 2;
    if (argc > 1 && std::strcmp(argv[1], "crash") == 0) {
        crash_marker();
    }
    std::puts("NATIVE_FIXTURE_OK");
    return 0;
}
