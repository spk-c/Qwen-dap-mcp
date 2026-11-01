// @ts-nocheck
export class DapError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'DapError';
    }
}
export class DapRequestError extends DapError {
    command;
    responseBody;
    constructor(command, message, responseBody) {
        super(`DAP request '${command}' failed: ${message}`);
        this.name = 'DapRequestError';
        this.command = command;
        this.responseBody = responseBody;
    }
}
export class DapTimeoutError extends DapError {
    constructor(operation, timeoutMs) {
        super(`Timed out waiting for ${operation} after ${timeoutMs} ms`);
        this.name = 'DapTimeoutError';
    }
}
//# sourceMappingURL=errors.js.map