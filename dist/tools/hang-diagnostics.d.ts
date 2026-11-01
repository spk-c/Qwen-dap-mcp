import type { McpServer } from '@modelcontextprotocol/server';
import { GuardedDapSession } from '../dap/guarded-session.js';
import { type HangThreadEvidence } from '../diagnostics/hang-analysis.js';
import { type IntelligentDiagnosisOptions } from '../diagnostics/intelligent-diagnosis.js';
export type HangCaptureOptions = {
    maxThreads?: number;
    stackLevels?: number;
    maxVariablesPerFrame?: number;
    framesWithVariables?: number;
    captureTimeoutMs?: number;
};
export declare function captureAllThreadHangEvidence(session: GuardedDapSession, captureOptions?: HangCaptureOptions, analysisOptions?: IntelligentDiagnosisOptions): Promise<HangThreadEvidence[]>;
export declare function registerHangDiagnosticTool(server: McpServer, session: GuardedDapSession): void;
