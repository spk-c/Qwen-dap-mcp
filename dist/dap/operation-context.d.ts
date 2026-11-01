export type DapOperationContextOptions = {
    label?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
};
export declare class DapOperationContext {
    readonly id: number;
    readonly label: string;
    readonly signal: AbortSignal;
    readonly deadlineAt?: number;
    private readonly controller;
    private readonly timeout?;
    private readonly detachParent?;
    constructor(options?: DapOperationContextOptions, parent?: DapOperationContext);
    remainingMs(requestedMs: number): number;
    throwIfAborted(): void;
    abort(reason?: string): void;
    dispose(): void;
}
export declare function currentDapOperationContext(): DapOperationContext | undefined;
export declare function runWithDapOperationContext<T>(options: DapOperationContextOptions, action: (context: DapOperationContext) => Promise<T> | T): Promise<T>;
