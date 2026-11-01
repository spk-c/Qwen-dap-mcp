export declare const READ_ONLY_LOCAL_TOOL_ANNOTATIONS: {
    readonly readOnlyHint: true;
    readonly destructiveHint: false;
    readonly idempotentHint: true;
    readonly openWorldHint: false;
};
export declare const DEBUG_SESSION_CONTROL_ANNOTATIONS: {
    readonly readOnlyHint: false;
    readonly destructiveHint: true;
    readonly idempotentHint: false;
    readonly openWorldHint: true;
};
export declare const LOCAL_TARGET_EXECUTION_ANNOTATIONS: {
    readonly readOnlyHint: false;
    readonly destructiveHint: true;
    readonly idempotentHint: false;
    readonly openWorldHint: true;
};
export declare const SESSION_TEARDOWN_ANNOTATIONS: {
    readonly readOnlyHint: false;
    readonly destructiveHint: true;
    readonly idempotentHint: false;
    readonly openWorldHint: false;
};
