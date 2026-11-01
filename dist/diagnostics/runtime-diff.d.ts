import type { RuntimeSnapshot } from '../dap/session.js';
export type SemanticDiffStatus = 'same' | 'changed' | 'added' | 'removed' | 'unavailable' | 'unstable';
export type RuntimeValueDiff = {
    key: string;
    name: string;
    status: SemanticDiffStatus;
    baseline?: string;
    candidate?: string;
    type?: string;
    reason?: string;
};
export type RuntimeFrameDiff = {
    index: number;
    status: SemanticDiffStatus;
    baseline?: RuntimeFrameIdentity;
    candidate?: RuntimeFrameIdentity;
};
export type RuntimeFrameIdentity = {
    function: string;
    sourcePath?: string;
    line?: number;
    moduleId?: string;
};
export type RuntimeSnapshotDiff = {
    summary: {
        meaningfulDifferences: number;
        changedLocals: number;
        changedRegisters: number;
        unstableValues: number;
        stackChanges: number;
        addedModules: number;
        removedModules: number;
    };
    stack: {
        status: SemanticDiffStatus;
        frames: RuntimeFrameDiff[];
    };
    locals: RuntimeValueDiff[];
    registers: RuntimeValueDiff[];
    exception: {
        status: SemanticDiffStatus;
        baseline?: unknown;
        candidate?: unknown;
    };
    symbolHealth: {
        status: SemanticDiffStatus;
        baseline: RuntimeSnapshot['symbolHealth'];
        candidate: RuntimeSnapshot['symbolHealth'];
    };
    modules: {
        status: SemanticDiffStatus;
        added: string[];
        removed: string[];
    };
    firstMeaningfulDifference?: {
        category: 'local' | 'register' | 'exception' | 'stack' | 'symbol-health' | 'module';
        key?: string;
        status: SemanticDiffStatus;
        baseline?: unknown;
        candidate?: unknown;
        reason?: string;
    };
    limitations: string[];
};
export declare function compareRuntimeSnapshots(baseline: RuntimeSnapshot, candidate: RuntimeSnapshot): RuntimeSnapshotDiff;
