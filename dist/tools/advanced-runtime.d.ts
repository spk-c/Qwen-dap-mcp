import type { McpServer } from '@modelcontextprotocol/server';
import type { RuntimeSnapshot } from '../dap/session.js';
import { GuardedDapSession } from '../dap/guarded-session.js';
import { analyzeKnownApiCall, analyzeStackIntegrity, buildBreakpointPlan, buildFailureHypotheses, crashFingerprintsV2 } from '../diagnostics/runtime-v2.js';
type AbiKind = 'auto' | 'windows-x64' | 'sysv-amd64' | 'aarch64';
type CrashReport = {
    fingerprint: string;
    frameKey: string;
    exceptionKey: string;
    symbolStatus: string;
    sanitizer: Array<Record<string, unknown>>;
    memoryHazards: Array<Record<string, unknown>>;
    abi: Record<string, unknown>;
    symbolDoctor: Record<string, unknown>;
    fingerprintsV2: ReturnType<typeof crashFingerprintsV2>;
    apiAnalysis: ReturnType<typeof analyzeKnownApiCall>;
    stackIntegrity: ReturnType<typeof analyzeStackIntegrity>;
    hypotheses: ReturnType<typeof buildFailureHypotheses>;
    breakpointPlan: ReturnType<typeof buildBreakpointPlan>;
    outputTail: string[];
    snapshot: RuntimeSnapshot;
    limitations: string[];
};
export declare function analyzeAbiArguments(snapshot: RuntimeSnapshot, requested?: AbiKind): {
    abi: "aarch64" | "sysv-amd64" | "unknown" | "windows-x64";
    frame: string;
    arguments: {
        index: number;
        register: string;
        value: string | undefined;
    }[];
    note: string;
};
export declare function detectMemoryHazards(snapshot: RuntimeSnapshot): Record<string, unknown>[];
export declare function parseSanitizerEvidence(lines: readonly string[]): Record<string, unknown>[];
export declare function buildCrashReport(snapshot: RuntimeSnapshot, status: ReturnType<GuardedDapSession['snapshot']>, options?: {
    redactPaths?: boolean;
    includeOutputTail?: boolean;
    abi?: AbiKind;
}): CrashReport;
declare function sampleSignature(snapshot: RuntimeSnapshot): {
    threadId: number;
    frame: string;
    source: string | undefined;
    line: number;
    instruction: string | undefined;
};
export declare function progressProbe(session: GuardedDapSession, options: {
    samples?: number;
    intervalMs?: number;
    threadId?: number;
}): Promise<{
    classification: string;
    samples: number;
    intervalMs: number;
    captures: {
        index: number;
        signature: ReturnType<typeof sampleSignature>;
        topFrames: Array<{
            name: string;
            source?: string;
            line: number;
        }>;
    }[];
    evidence: {
        uniqueSampleSignatures: number;
        sameSourceFrameAcrossSamples: boolean;
        uniqueInstructionPointers: number;
    };
    limitations: string[];
    status: {
        adapterRunning: boolean;
        adapterPid?: number;
        initialized: boolean;
        configured: boolean;
        stateUncertain: boolean;
        activeRequest?: 'launch' | 'attach';
        adapterId?: string;
        capabilities?: import("@vscode/debugprotocol").DebugProtocol.Capabilities;
        recentEvents: readonly unknown[];
        recentAdapterStderr: readonly string[];
        postmortem: boolean;
        lifecycleOperation?: string | undefined;
    };
}>;
export declare function causalTrace(session: GuardedDapSession, options: {
    name: string;
    maxDepth?: number;
    maxStops?: number;
    timeoutMs?: number;
}): Promise<{
    query: {
        name: string;
        maxDepth: number;
    };
    consumer: {
        frame: import("@vscode/debugprotocol").DebugProtocol.StackFrame;
        observedValue: import("./value-tracing.js").ObservedTraceValue | undefined;
        disassembly: import("@vscode/debugprotocol").DebugProtocol.DisassembledInstruction[] | undefined;
    };
    producerChain: {
        depth: number;
        writerFrame: unknown;
        beforeValue: unknown;
        afterValue: unknown;
        valueChanged: unknown;
        evidence: unknown;
    }[];
    trace: {
        query: {
            name: string;
            accessType: "readWrite" | "write";
            maxStops: number;
            timeoutMs: number;
            perStopTimeoutMs: number;
        };
        events: Record<string, unknown>[];
        stopReason: "error" | "max-stops" | "no-writer-snapshot" | "target-exited" | "target-terminated" | "unrelated-stop";
        terminalError?: string | undefined;
        finalSnapshot: RuntimeSnapshot;
        guidance: string[];
        status: {
            adapterRunning: boolean;
            adapterPid?: number;
            initialized: boolean;
            configured: boolean;
            stateUncertain: boolean;
            activeRequest?: 'launch' | 'attach';
            adapterId?: string;
            capabilities?: import("@vscode/debugprotocol").DebugProtocol.Capabilities;
            recentEvents: readonly unknown[];
            recentAdapterStderr: readonly string[];
            postmortem: boolean;
            lifecycleOperation?: string | undefined;
        };
    };
    conclusion: string;
    limitations: string[];
}>;
export declare function clusterCrashReports(reports: Array<{
    fingerprint: string;
    frameKey?: string;
    exceptionKey?: string;
}>): {
    totalReports: number;
    clusters: {
        fingerprint: string;
        count: number;
        representative: {
            fingerprint: string;
            frameKey?: string;
            exceptionKey?: string;
        } | undefined;
    }[];
    note: string;
};
export declare function regressionOracle(currentFingerprint: string, baselineFingerprint: string, terminal?: boolean): {
    verdict: string;
    baselineFingerprint: string;
    currentFingerprint: string;
    terminal: boolean;
    suitableForBisect: boolean;
    note: string;
};
export declare function registerAdvancedRuntimeTools(server: McpServer, session: GuardedDapSession): void;
export {};
