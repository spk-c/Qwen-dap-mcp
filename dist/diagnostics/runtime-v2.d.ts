import type { DebugProtocol } from '@vscode/debugprotocol';
import type { RuntimeSnapshot } from '../dap/session.js';
export type EvidenceItem = {
    kind: string;
    weight: number;
    summary: string;
    source: string;
};
export type FailureHypothesis = {
    id: string;
    title: string;
    evidenceScore: number;
    supporting: EvidenceItem[];
    contradicting: EvidenceItem[];
    nextEvidence: string[];
};
export type ThreadTimelineObservation = {
    sample: number;
    threadId: number;
    threadName: string;
    topFrame?: string;
    source?: string;
    line?: number;
    instructionPointerReference?: string;
    waitKind: 'lock' | 'join' | 'condition' | 'io' | 'sleep' | 'runnable-or-unknown';
    resources: Array<{
        name: string;
        value: string;
        ownerThreadId?: number;
        ownerEvidence?: string;
    }>;
};
export declare function crashFingerprintsV2(snapshot: RuntimeSnapshot, outputLines?: readonly string[]): {
    version: number;
    exact: string;
    semantic: string;
    family: string;
    materials: {
        exact: {
            version: number;
            exception: string;
            frames: {
                function: string;
                source: string;
                line: number;
            }[];
            hazards: string[];
            sanitizers: string[];
        };
        semantic: {
            version: number;
            exceptionClass: string;
            frames: string[];
            hazards: string[];
            sanitizers: string[];
        };
        family: {
            version: number;
            exceptionClass: string;
            topFunctions: string[];
            memoryFamily: string[];
            sanitizerFamilies: string[];
        };
    };
    note: string;
};
export declare function moduleForAddress(modules: readonly DebugProtocol.Module[] | undefined, address: string | undefined): DebugProtocol.Module | undefined;
export declare function analyzeStackIntegrity(snapshot: RuntimeSnapshot, outputLines?: readonly string[]): {
    severity: string;
    findings: Record<string, unknown>[];
    limitations: string[];
};
export declare function analyzeKnownApiCall(snapshot: RuntimeSnapshot, abiArguments: Array<{
    index: number;
    register: string;
    value?: string;
}>): {
    recognized: boolean;
    function: string;
    note: string;
    arguments?: undefined;
    risks?: undefined;
} | {
    recognized: boolean;
    function: string;
    arguments: {
        parameter: string;
        index: number;
        register: string | undefined;
        value: string | undefined;
    }[];
    risks: {
        kind: string;
        parameter: string;
        value: string;
        confidence: string;
    }[];
    note: string;
};
export declare function buildFailureHypotheses(options: {
    snapshot: RuntimeSnapshot;
    outputLines?: readonly string[];
    memoryHazards?: Array<Record<string, unknown>>;
    apiAnalysis?: Record<string, unknown>;
    stackIntegrity?: ReturnType<typeof analyzeStackIntegrity>;
}): FailureHypothesis[];
export declare function buildBreakpointPlan(hypotheses: readonly FailureHypothesis[], snapshot: RuntimeSnapshot): {
    functionBreakpoints: {
        function: string;
        reason: string;
        hypothesis: string;
    }[];
    dataBreakpointCandidates: {
        name: string;
        value: string;
        reason: string;
    }[];
    note: string;
};
export declare function classifyThreadObservation(sample: number, thread: DebugProtocol.Thread, stack: readonly DebugProtocol.StackFrame[], variables: readonly DebugProtocol.Variable[]): ThreadTimelineObservation;
export declare function buildLockOwnerGraph(observations: readonly ThreadTimelineObservation[]): {
    edges: {
        from: number;
        to: number;
        resource: string;
        evidence: string;
    }[];
    cycleProven: boolean;
    cycle: {
        from: number;
        to: number;
        resource: string;
        evidence: string;
    }[];
    evidenceKind: string;
    limitations: string[];
};
export declare function compareCrashFamilies(reports: Array<{
    label?: string;
    fingerprintsV2?: {
        exact?: string;
        semantic?: string;
        family?: string;
        materials?: Record<string, unknown>;
    };
    fingerprint?: string;
    exceptionKey?: string;
    frameKey?: string;
}>): {
    totalReports: number;
    families: {
        family: string;
        count: number;
        semanticVariants: number;
        exactVariants: number;
        members: string[];
        representative: {
            label?: string;
            fingerprintsV2?: {
                exact?: string;
                semantic?: string;
                family?: string;
                materials?: Record<string, unknown>;
            };
            fingerprint?: string;
            exceptionKey?: string;
            frameKey?: string;
        } | undefined;
    }[];
    sharedFamilyCount: number;
    note: string;
};
