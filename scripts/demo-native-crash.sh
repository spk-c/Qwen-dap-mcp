#!/usr/bin/env bash
# Safe, reproducible local C++ crash -> debugger evidence -> verification demo.
# Compiles ONLY the repository-owned fixture, runs it in a temporary folder,
# and never attaches to arbitrary processes.
set -euo pipefail

for bin in g++ gdb grep sed mktemp; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Missing dependency: $bin" >&2; exit 2; }
done
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$repo_root/integration/fixture/native-debug.cpp"
[[ -f "$fixture" ]] || { echo "Missing repository fixture: $fixture" >&2; exit 2; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
ulimit -c 0 || true
printf '%s\n' 'STEP 1 — Compile and run a repository-owned C++ fixture'
g++ -g -O0 -fno-omit-frame-pointer -std=c++17 "$fixture" -o "$tmp/native-demo"
"$tmp/native-demo" | grep -F 'NATIVE_FIXTURE_OK'
printf '%s\n' 'STEP 2 — Reproduce the deliberate crash under a local GDB process'
gdb --quiet --batch --nx \
  -ex 'set pagination off' \
  -ex 'set confirm off' \
  -ex 'run crash' \
  -ex 'bt 8' \
  --args "$tmp/native-demo" crash > "$tmp/gdb-evidence.txt" 2>&1 || true
if ! grep -Eq 'SIGSEGV|Segmentation fault' "$tmp/gdb-evidence.txt"; then
  echo 'Expected signal was not observed. Debugger output:' >&2
  cat "$tmp/gdb-evidence.txt" >&2
  exit 3
fi
if ! grep -q 'crash_marker' "$tmp/gdb-evidence.txt"; then
  echo 'Crash stack did not identify the fixture marker; no verified evidence.' >&2
  cat "$tmp/gdb-evidence.txt" >&2
  exit 3
fi
grep -E -m 2 'SIGSEGV|Segmentation fault|crash_marker' "$tmp/gdb-evidence.txt" || true
printf '%s\n' 'STEP 3 — Apply an illustrative null-pointer guard ONLY to a temp copy'
sed 's/\*invalid = 1; \/\/ NATIVE_CRASH/if (invalid != nullptr) { *invalid = 1; } \/\/ NATIVE_CRASH/' "$fixture" > "$tmp/fixed.cpp"
grep -Fq 'if (invalid != nullptr)' "$tmp/fixed.cpp" || { echo 'Demo fix was not applied' >&2; exit 4; }
g++ -g -O0 -fno-omit-frame-pointer -std=c++17 "$tmp/fixed.cpp" -o "$tmp/native-demo-fixed"
printf '%s\n' 'STEP 4 — Rerun EXACTLY the crash argument against the modified build'
"$tmp/native-demo-fixed" crash | grep -F 'NATIVE_FIXTURE_OK'
printf '%s\n' 'PASS: observed deliberate SIGSEGV, crash_marker stack and successful rebuilt reproduction.'
printf '%s\n' 'Note: this is real GDB evidence + a demonstrative manual guard, not a model-driven MCP tool call.'
