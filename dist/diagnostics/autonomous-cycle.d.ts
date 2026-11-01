import type { IntelligentCrashDiagnosis, VerificationBaseline, VerificationResult } from './intelligent-diagnosis.js';
export type AutonomousAgentStatus = 'needs-evidence' | 'needs-fix' | 'retry-fix' | 'needs-reproduction' | 'changed-failure' | 'fixed' | 'budget-exhausted' | 'blocked';
export type AutonomousAgentActionType = 'collect-evidence' | 'inspect-source' | 'propose-fix' | 'apply-fix' | 'build' | 'reproduce' | 'verify' | 'broaden-diagnosis' | 'stop-and-report';
export type AutonomousAgentActionStatus = 'pending' | 'satisfied' | 'blocked' | 'skipped';
export type AutonomousAgentAction = {
    id: string;
    type: AutonomousAgentActionType;
    owner: 'coding-agent' | 'debugger';
    status: AutonomousAgentActionStatus;
    instruction: string;
    requires: string[];
    input: Record<string, unknown>;
    expectedResult: {
        description: string;
        successCriteria: string[];
    };
    evidence?: string[];
};
export type AutonomousAgentHistoryEntry = {
    iteration: number;
    phase: 'diagnosis' | 'verification';
    fingerprint: string;
    verdict?: VerificationResult['verdict'];
    confidence?: VerificationResult['confidence'];
    projectFunction?: string;
    projectSourcePath?: string;
    projectLine?: number;
    summary: string;
};
export type AutonomousAgentState = {
    schemaVersion: 1;
    iteration: number;
    maxIterations: number;
    status: AutonomousAgentStatus;
    rootBaseline: VerificationBaseline;
    activeBaseline: VerificationBaseline;
    rootFingerprint: string;
    activeFingerprint: string;
    history: AutonomousAgentHistoryEntry[];
};
export type RootCauseBacktrack = {
    target: {
        register?: string;
        variable?: string;
        value?: string;
        instruction?: string;
    };
    runtimeTrail: Array<{
        frameIndex: number;
        function: string;
        variables: string[];
        value?: string;
        role: 'consumer' | 'propagated' | 'producer-candidate';
    }>;
    producerCandidates: Array<{
        frameIndex: number;
        function: string;
        sourcePath?: string;
        line: number;
        reason: string;
    }>;
    confidence: 'low' | 'medium' | 'high';
    limitation: string;
};
export type VerificationQuality = {
    score: number;
    grade: 'weak' | 'moderate' | 'strong';
    checks: {
        reproduction: 'complete' | 'incomplete';
        rootCrash: 'gone' | 'reproduced' | 'changed' | 'unknown';
        newCrash: 'none-observed' | 'present' | 'unknown';
        build: 'external-unverified';
        tests: 'external-unverified';
        sameInputs: 'external-unverified';
    };
    evidence: string[];
    note: string;
};
export type AutonomousAgentDecision = {
    protocolVersion: 2;
    state: AutonomousAgentState;
    shouldContinue: boolean;
    nextActions: AutonomousAgentAction[];
    rootCauseBacktrack?: RootCauseBacktrack;
    verificationQuality?: VerificationQuality;
    stopReason?: string;
};
export declare function baselineFingerprint(baseline: VerificationBaseline): string;
export declare function validateAutonomousAgentState(state: AutonomousAgentState): void;
export declare function evidenceReady(diagnosis: IntelligentCrashDiagnosis): boolean;
export declare function buildRootCauseBacktrack(diagnosis: IntelligentCrashDiagnosis): RootCauseBacktrack;
export declare function verificationQuality(verification: VerificationResult): VerificationQuality;
export declare function startAutonomousCycle(diagnosis: IntelligentCrashDiagnosis, maxIterations?: number): AutonomousAgentDecision;
export declare function refreshAutonomousEvidence(previous: AutonomousAgentState, diagnosis: IntelligentCrashDiagnosis): AutonomousAgentDecision;
export declare function advanceAutonomousCycle(previous: AutonomousAgentState, verification: VerificationResult, currentDiagnosis?: IntelligentCrashDiagnosis): AutonomousAgentDecision;
