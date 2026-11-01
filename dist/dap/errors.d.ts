export declare class DapError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
export declare class DapRequestError extends DapError {
    readonly command: string;
    readonly responseBody: unknown;
    constructor(command: string, message: string, responseBody?: unknown);
}
export declare class DapTimeoutError extends DapError {
    constructor(operation: string, timeoutMs: number);
}
