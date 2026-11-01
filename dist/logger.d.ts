export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type LogFields = Record<string, unknown>;
export type LogSink = (line: string) => void;
export type LoggerOptions = {
    level?: string;
    sink?: LogSink;
};
export declare function createLogger(options?: LoggerOptions): {
    level: LogLevel;
    debug: (message: string, fields?: LogFields) => void;
    info: (message: string, fields?: LogFields) => void;
    warn: (message: string, fields?: LogFields) => void;
    error: (message: string, fields?: LogFields) => void;
};
export declare const logger: {
    level: LogLevel;
    debug: (message: string, fields?: LogFields) => void;
    info: (message: string, fields?: LogFields) => void;
    warn: (message: string, fields?: LogFields) => void;
    error: (message: string, fields?: LogFields) => void;
};
