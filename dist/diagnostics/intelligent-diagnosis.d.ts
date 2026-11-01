import type { DebugProtocol } from '@vscode/debugprotocol';
import type { RuntimeSnapshot } from '../dap/session.js';
import type { CrashDiagnosis, DiagnosisCategory, DiagnosisConfidence, DiagnosisHypothesis } from './analyze-snapshot.js';
export type IntelligentDiagnosisOptions = {
    projectRoots?: string[];
    projectModules?: string[];
    program?: string;
    cwd?: string;
    callerDepth?: number;
};
export type FrameAssessment = {
    index: number;
    frame: DebugProtocol.StackFrame;
    score: number;
    projectControlled: boolean;
    runtimeLikely: boolean;
    confidence: DiagnosisConfidence;
    reasons: string[];
};
export type ProjectFrameSelection = {
    selected: FrameAssessment;
    assessments: FrameAssessment[];
    skippedRuntimeFrames: number;
    usedExplicitProjectHint: boolean;
};
export type FrameEvidence = {
    index: number;
    frame: DebugProtocol.StackFrame;
    locals: DebugProtocol.Variable[];
    registers: DebugProtocol.Variable[];
    disassembly?: DebugProtocol.DisassembledInstruction[];
    collectionErrors?: string[];
};
export type MemoryRegisterRole = 'base' | 'index' | 'offset' | 'unknown';
export type RegisterBinding = {
    register: string;
    canonicalRegister: string;
    value?: string;
    referencedByMemoryOperand: boolean;
    memoryRole?: MemoryRegisterRole;
    suspicious?: 'null-like' | 'poison-pattern';
};
export type VariableRegisterBinding = {
    variable: string;
    variableType?: string;
    variableValue: string;
    register: string;
    registerValue: string;
    confidence: DiagnosisConfidence;
    reason: string;
};
export type OperandAnalysis = {
    frameIndex?: number;
    instruction?: DebugProtocol.DisassembledInstruction;
    mnemonic?: string;
    rawInstruction?: string;
    referencedRegisters: RegisterBinding[];
    memoryOperand?: string;
    variableBindings: VariableRegisterBinding[];
    likelyFaultOperand?: {
        register: string;
        value?: string;
        reason: string;
        confidence: DiagnosisConfidence;
        faultingFrame: boolean;
    };
};
export type CallChainFrame = {
    index: number;
    function: string;
    moduleId?: number | string;
    sourcePath?: string;
    line: number;
    role: 'fault' | 'project-fault' | 'project-caller' | 'runtime-boundary' | 'other';
    projectControlled: boolean;
    runtimeLikely: boolean;
    score: number;
};
export type CallChainAnalysis = {
    frames: CallChainFrame[];
    firstProjectFrame: CallChainFrame;
    runtimeBoundaryDepth: number;
    projectCallerFrames: CallChainFrame[];
    repeatedFunctions: Array<{
        function: string;
        count: number;
    }>;
    provenance: Array<{
        value: string;
        frames: Array<{
            index: number;
            function: string;
            variables: string[];
        }>;
        confidence: DiagnosisConfidence;
    }>;
    rootCauseCandidate: {
        frame: CallChainFrame;
        confidence: DiagnosisConfidence;
        rationale: string[];
    };
};
export type FixWorkflow = {
    status: 'proposal-only' | 'evidence-required';
    candidateLocation: {
        function: string;
        sourcePath?: string;
        line: number;
    };
    hypothesis?: DiagnosisHypothesis;
    suggestedChanges: string[];
    phases: Array<{
        phase: 'diagnose' | 'fix' | 'rebuild' | 'reproduce' | 'verify';
        state: 'complete' | 'agent-action-required' | 'ready-after-rebuild' | 'not-applicable';
        instruction: string;
    }>;
};
export type VerificationBaseline = {
    classification: DiagnosisCategory;
    crashLikely: boolean;
    faultFunction: string;
    projectFunction: string;
    projectSourcePath?: string;
    projectLine: number;
    hypothesisKinds: string[];
    suspiciousNames: string[];
};
export type VerificationResult = {
    verdict: 'fixed' | 'not-fixed' | 'changed-failure' | 'inconclusive';
    confidence: DiagnosisConfidence;
    evidence: string[];
};
export type IntelligentCrashDiagnosis = CrashDiagnosis & {
    projectFrame: {
        index: number;
        function: string;
        moduleId?: number | string;
        sourcePath?: string;
        sourceName?: string;
        line: number;
        column: number;
        instructionPointerReference?: string;
        confidence: DiagnosisConfidence;
        reasons: string[];
    };
    frameSelection: ProjectFrameSelection;
    operandAnalysis: OperandAnalysis;
    callChain: CallChainAnalysis;
    fixWorkflow: FixWorkflow;
    verificationBaseline: VerificationBaseline;
};
export declare function assessProjectFrames(stack: DebugProtocol.StackFrame[], options?: IntelligentDiagnosisOptions): FrameAssessment[];
export declare function selectProjectFrame(stack: DebugProtocol.StackFrame[], options?: IntelligentDiagnosisOptions): ProjectFrameSelection;
export declare function analyzeInstructionOperands(evidence: FrameEvidence): OperandAnalysis;
export declare function analyzeCallChain(selection: ProjectFrameSelection, evidence: FrameEvidence[]): CallChainAnalysis;
type BaselineInput = Pick<IntelligentCrashDiagnosis, 'classification' | 'faultLocation' | 'projectFrame' | 'hypotheses' | 'suspiciousValues'>;
export declare function createVerificationBaseline(diagnosis: BaselineInput): VerificationBaseline;
export declare function compareVerificationBaseline(baseline: VerificationBaseline, current: IntelligentCrashDiagnosis | undefined, terminal?: {
    event: 'exited' | 'terminated';
    exitCode?: number;
}): VerificationResult;
export declare function buildIntelligentDiagnosis(snapshot: RuntimeSnapshot, base: CrashDiagnosis, selection: ProjectFrameSelection, evidence: FrameEvidence[]): IntelligentCrashDiagnosis;
export {};
