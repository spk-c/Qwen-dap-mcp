/**
 * Normalize debugger/source paths without erasing POSIX case semantics.
 *
 * Windows drive/UNC/backslash paths are separator- and case-insensitive for
 * comparison. POSIX paths preserve case because `/Project/a.cpp` and
 * `/project/a.cpp` can be different files on the same machine.
 */
export declare function normalizeDiagnosticPath(value: string | undefined): string | undefined;
export declare function diagnosticPathWithinRoot(candidate: string, root: string): boolean;
