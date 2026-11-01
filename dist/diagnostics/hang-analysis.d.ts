import type { DebugProtocol } from '@vscode/debugprotocol';
import type { DiagnosisConfidence } from './analyze-snapshot.js';
import { type IntelligentDiagnosisOptions } from './intelligent-diagnosis.js';
export type HangWaitKind = 'mutex' | 'rwlock' | 'condition-variable' | 'semaphore' | 'event' | 'thread-join' | 'futex' | 'io' | 'sleep-timer' | 'scheduler-park' | 'running-user-code' | 'unknown';
export type HangFrameVariables = {
    frameIndex: number;
    frame: DebugProtocol.StackFrame;
    variables: DebugProtocol.Variable[];
    collectionErrors?: string[];
};
export type HangThreadEvidence = {
    thread: DebugProtocol.Thread;
    stack: DebugProtocol.StackFrame[];
    variableFrames: HangFrameVariables[];
    collectionErrors?: string[];
};
export type HangWaitState = {
    kind: HangWaitKind;
    blocked: boolean;
    confidence: DiagnosisConfidence;
    matchedFrameIndex?: number;
    matchedFunction?: string;
    rationale: string[];
};
export type HangThreadTriage = {
    threadId: number;
    threadName: string;
    topFunction?: string;
    projectFunction?: string;
    projectFrameIndex?: number;
    projectControlled: boolean;
    wait: HangWaitState;
    collectionErrors?: string[];
};
export type PointerRole = 'synchronization' | 'owner-or-thread' | 'buffer-or-object' | 'generic-pointer';
export type PointerObservation = {
    address: string;
    source: 'memoryReference' | 'value';
    threadId: number;
    threadName: string;
    frameIndex: number;
    frameName: string;
    variableName: string;
    variableType?: string;
    variableValue: string;
    role: PointerRole;
};
export type PointerProvenanceGroup = {
    address: string;
    observations: PointerObservation[];
    aliases: string[];
    threadIds: number[];
    sharedAcrossThreads: boolean;
    synchronizationRelevant: boolean;
    confidence: DiagnosisConfidence;
    rationale: string[];
};
export type PointerProvenanceV2 = {
    version: 2;
    groups: PointerProvenanceGroup[];
    nullLike: Array<Omit<PointerObservation, 'address'> & {
        address: '0x0';
    }>;
    limitations: string[];
};
export type DeadlockHeuristic = {
    classification: 'deadlock-candidate' | 'lock-contention' | 'global-wait' | 'io-wait' | 'mixed-wait' | 'no-deadlock-signal' | 'unknown';
    likelihood: DiagnosisConfidence;
    blockedThreadIds: number[];
    runnableProjectThreadIds: number[];
    sharedSynchronizationAddresses: string[];
    cycleProven: false;
    ownershipGraphAvailable: false;
    evidence: string[];
    limitations: string[];
};
export type HangDiagnosis = {
    summary: string;
    classification: DeadlockHeuristic['classification'];
    confidence: DiagnosisConfidence;
    allThreadTriage: HangThreadTriage[];
    deadlock: DeadlockHeuristic;
    pointerProvenance: PointerProvenanceV2;
    nextActions: string[];
    limitations: string[];
};
export declare function classifyThreadWait(evidence: HangThreadEvidence, analysisOptions?: IntelligentDiagnosisOptions): HangWaitState;
export declare function analyzeHang(evidence: HangThreadEvidence[], analysisOptions?: IntelligentDiagnosisOptions): HangDiagnosis;
