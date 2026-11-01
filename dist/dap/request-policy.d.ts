export type DapPolicyMode = 'standard' | 'inspect-only';
export type DapRequestPolicyContext = {
    command: string;
    args?: unknown;
};
export type DapRequestPolicyDecision = {
    allow: true;
} | {
    allow: false;
    reason: string;
};
export type DapRequestPolicyResult = DapRequestPolicyDecision | Promise<DapRequestPolicyDecision>;
export type DapRequestPolicy = (context: DapRequestPolicyContext) => DapRequestPolicyResult;
/**
 * Recognize only the dump/core attach shapes emitted by this project.
 * Generic attach remains denied because it can stop/control a live process.
 */
export declare function isInspectOnlyPostmortemAttach(args: unknown): boolean;
/**
 * Build a transport-level DAP request policy.
 *
 * `standard` preserves the normal debugger feature set. `inspect-only` is a
 * fail-closed mode intended for agents or policy engines that must only read
 * debugger state: commands that are not explicitly known to be inspection
 * operations are denied. In particular, DAP `evaluate` and live `launch` /
 * `attach` are denied because they can execute code or control a target.
 * A narrowly recognized core/minidump attach is permitted so postmortem reads
 * remain usable without granting live-process attach authority.
 */
export declare function createDapRequestPolicy(mode?: DapPolicyMode): DapRequestPolicy;
/** Resolve the built-in policy from QWEN_DAP_MCP_DAP_POLICY. */
export declare function resolveDapPolicyMode(value?: string | undefined): DapPolicyMode;
