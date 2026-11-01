import type { RuntimeSnapshot } from './session.js';
/**
 * Add stable crash-family wording to frozen Windows dump evidence when the
 * adapter exposes only a raw SEH status code. The original DAP fields are kept
 * intact; the canonical wording merely lets debugger-agnostic diagnosis logic
 * classify the same failure consistently across adapters and versions.
 */
export declare function normalizePostmortemSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot;
