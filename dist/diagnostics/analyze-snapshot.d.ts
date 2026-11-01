import type { DebugProtocol } from '@vscode/debugprotocol';
import type { RuntimeSnapshot } from '../dap/session.js';
export type DiagnosisConfidence = 'high' | 'medium' | 'low';
export type DiagnosisCategory = 'access-violation' | 'segmentation-fault' | 'stack-overflow' | 'divide-by-zero' | 'illegal-instruction' | 'abort-or-assert' | 'heap-corruption' | 'exception' | 'signal' | 'breakpoint' | 'entry' | 'manual-stop' | 'step' | 'unknown';
export type SuspiciousValue = {
    scope: 'local' | 'register';
    name: string;
    value: string;
    type?: string;
    reason: 'null-like-pointer' | 'poison-pattern';
};
export type SourceDisassemblyCorrelation = {
    frame: {
        name: string;
        moduleId?: number | string;
    };
    source?: {
        name?: string;
        path?: string;
        line: number;
        column: number;
    };
    instructionPointerReference?: string;
    exactInstructionMatch: boolean;
    currentInstruction?: DebugProtocol.DisassembledInstruction;
    previousInstructions: DebugProtocol.DisassembledInstruction[];
    nextInstructions: DebugProtocol.DisassembledInstruction[];
};
export type DiagnosisHypothesis = {
    kind: string;
    title: string;
    confidence: DiagnosisConfidence;
    evidence: string[];
    suggestedChecks: string[];
};
export type CrashDiagnosis = {
    summary: string;
    classification: {
        category: DiagnosisCategory;
        crashLikely: boolean;
        confidence: DiagnosisConfidence;
    };
    stopReason?: string;
    exception?: DebugProtocol.ExceptionInfoResponse['body'];
    faultLocation: {
        function: string;
        moduleId?: number | string;
        sourcePath?: string;
        sourceName?: string;
        line: number;
        column: number;
        instructionPointerReference?: string;
    };
    sourceDisassembly: SourceDisassemblyCorrelation;
    suspiciousValues: SuspiciousValue[];
    hypotheses: DiagnosisHypothesis[];
    nextActions: string[];
};
export declare function correlateSourceDisassembly(snapshot: RuntimeSnapshot): SourceDisassemblyCorrelation;
export declare function analyzeRuntimeSnapshot(snapshot: RuntimeSnapshot): CrashDiagnosis;
