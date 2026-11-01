import type { DebugProtocol } from '@vscode/debugprotocol';
export type SymbolHealthStatus = 'good' | 'partial' | 'poor' | 'unknown';
export type SymbolHealth = {
    status: SymbolHealthStatus;
    summary: string;
    stack: {
        totalFrames: number;
        namedFrames: number;
        sourceMappedFrames: number;
        topFrameNamed: boolean;
        topFrameSourceMapped: boolean;
    };
    modules: {
        collected: boolean;
        totalModules: number;
        withExplicitStatus: number;
        symbolsAvailable: number;
        symbolsMissing: number;
        symbolsUnknown: number;
    };
    limitations: string[];
};
export declare function assessSymbolHealth(stack: readonly DebugProtocol.StackFrame[], modules?: readonly DebugProtocol.Module[]): SymbolHealth;
