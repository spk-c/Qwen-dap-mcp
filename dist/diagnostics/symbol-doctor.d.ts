import type { DebugProtocol } from '@vscode/debugprotocol';
type ToolProbe = {
    command?: string;
    output?: string;
    error?: string;
};
export type BinaryIdentity = {
    path: string;
    format: 'elf' | 'pe' | 'macho' | 'unknown';
    buildId?: string;
    uuid?: string;
    pdb?: {
        path?: string;
        guid?: string;
        age?: string;
    };
    probes: ToolProbe[];
};
export declare function resolveSymbolInspectionTool(name: string, envName: string): string | undefined;
export declare function inspectBinaryIdentity(input: string): BinaryIdentity;
export declare function inspectPdbIdentity(input: string): {
    path: string;
    guid: string | undefined;
    age: string | undefined;
    probe: ToolProbe;
};
export declare function compareBinaryAndPdb(binary: BinaryIdentity, pdb: ReturnType<typeof inspectPdbIdentity>): {
    comparable: boolean;
    match: undefined;
    reason: string;
    guidMatch?: undefined;
    ageMatch?: undefined;
    binary?: undefined;
    pdb?: undefined;
    strength?: undefined;
} | {
    reason?: undefined;
    comparable: boolean;
    match: boolean;
    guidMatch: boolean;
    ageMatch: boolean;
    binary: {
        path?: string;
        guid?: string;
        age?: string;
    };
    pdb: {
        guid: string | undefined;
        age: string | undefined;
    };
    strength: string;
};
export declare function findLocalSymbolCandidates(modules: readonly DebugProtocol.Module[], searchPaths: readonly string[], options?: {
    maxEntries?: number;
    maxDepth?: number;
}): {
    searchPaths: string[];
    visitedEntries: number;
    truncated: boolean;
    matches: {
        module: string;
        candidate: string;
        reason: string;
    }[];
    unresolvedModules: {
        module: string;
        stem: string;
        symbolStatus: string | undefined;
        currentSymbolFilePath: string | undefined;
    }[];
};
export declare function configuredSymbolResolvers(identity: BinaryIdentity | undefined, value?: string | undefined): {
    configured: boolean;
    servers: string[];
    candidates: {
        server: string;
        url?: string;
        kind: string;
    }[];
    networkFetchPerformed: boolean;
    note: string;
};
export declare function symbolMismatchSummary(options: {
    modules: readonly DebugProtocol.Module[];
    binaryIdentity?: BinaryIdentity;
    pdbIdentity?: ReturnType<typeof inspectPdbIdentity>;
    localSearch?: ReturnType<typeof findLocalSymbolCandidates>;
}): {
    status: string;
    issues: Record<string, unknown>[];
    binaryPdbComparison: {
        comparable: boolean;
        match: undefined;
        reason: string;
        guidMatch?: undefined;
        ageMatch?: undefined;
        binary?: undefined;
        pdb?: undefined;
        strength?: undefined;
    } | {
        reason?: undefined;
        comparable: boolean;
        match: boolean;
        guidMatch: boolean;
        ageMatch: boolean;
        binary: {
            path?: string;
            guid?: string;
            age?: string;
        };
        pdb: {
            guid: string | undefined;
            age: string | undefined;
        };
        strength: string;
    } | undefined;
    localCandidates: {
        module: string;
        candidate: string;
        reason: string;
    }[];
    limitations: string[];
};
export {};
