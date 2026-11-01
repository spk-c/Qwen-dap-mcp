import { type DapPolicyMode, type DapRequestPolicy } from './request-policy.js';
export type HolGuardExecutionContext = {
    cwd?: string;
    adapterCommand?: string;
    adapterArgs?: string[];
    adapterResolvedCommand?: string;
    adapterExecutableHash?: string;
    adapterIdentityHash?: string;
    envKeys?: string[];
    envHash?: string;
};
export type HolGuardAction = ({
    kind: 'dap-request';
    command: string;
    args?: unknown;
} & HolGuardExecutionContext) | ({
    kind: 'adapter-start';
    command: string;
    args: string[];
} & HolGuardExecutionContext);
export type HolGuardDecision = {
    allow: boolean;
    action: string;
    reason: string;
    source?: string;
    guardVersion?: string;
    approvalRequestId?: string;
    approvalCenterUrl?: string;
    reviewCommand?: string;
};
export type HolGuardEvaluator = {
    readonly enabled: boolean;
    evaluate(action: HolGuardAction): Promise<HolGuardDecision>;
};
export type HolGuardPolicyOptions = {
    enabled?: boolean;
    pythonCommand?: string;
    timeoutMs?: number;
    bridgePath?: string;
};
export declare function buildHolGuardBridgeEnvironment(source?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export declare function buildHolGuardEnvironmentFingerprint(overrides: Record<string, string> | undefined): Pick<HolGuardExecutionContext, 'envKeys' | 'envHash'>;
export declare function sanitizeAdapterArgsForHolGuard(args: readonly string[]): string[];
export declare function sanitizeDapArgumentsForHolGuard(args: unknown): unknown;
export declare function resolveAdapterExecutable(command: string, cwd: string | undefined, env: NodeJS.ProcessEnv): string | undefined;
export declare function createHolGuardEvaluator(options?: HolGuardPolicyOptions): HolGuardEvaluator;
export declare function shouldConsultHolGuard(command: string): boolean;
export declare function createGuardedDapRequestPolicy(evaluator: HolGuardEvaluator, policyMode?: DapPolicyMode, contextProvider?: () => HolGuardExecutionContext | undefined): DapRequestPolicy;
export declare function requireHolGuardAdapterStart(evaluator: HolGuardEvaluator, options: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
}): Promise<HolGuardExecutionContext>;
