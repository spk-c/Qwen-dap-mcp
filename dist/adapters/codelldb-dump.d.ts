export type CodeLldbDumpOptions = {
    dumpPath: string;
    program?: string;
    sourceMap?: Record<string, string>;
};
export declare function buildCodeLldbDumpConfiguration(options: CodeLldbDumpOptions): Record<string, unknown>;
