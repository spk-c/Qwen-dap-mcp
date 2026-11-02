export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type LogFields = Record<string, unknown>;
export type LoggerOptions = { level?: string; sink?: (line: string) => void };
const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: Number.POSITIVE_INFINITY,
};
function normalizeLogLevel(value: string | undefined): LogLevel {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error' || normalized === 'silent') {
        return normalized;
    }
    return 'info';
}
function redactLogText(value: string): string {
    return value
        .replace(/\b(Bearer\s+)[^\s"',;]+/gi, '$1[REDACTED]')
        .replace(/\b((?:password|passwd|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|authorization|cookie)\s*[:=]\s*)[^\s"',;]+/gi, '$1[REDACTED]');
}
function isSensitiveLogKey(key: string): boolean {
    const compact = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    return ['password', 'passwd', 'secret', 'token', 'apikey', 'authorization', 'credential', 'cookie', 'privatekey'].some((word) => compact.includes(word));
}
function normalizeLogValue(value: unknown, ancestors: Set<object>): unknown {
    if (typeof value === 'string') return redactLogText(value);
    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (typeof value !== 'object' || value === null) {
        return value;
    }
    if (ancestors.has(value)) {
        return '[Circular]';
    }
    ancestors.add(value);
    try {
        if (value instanceof Error) {
            return {
                name: value.name,
                message: redactLogText(value.message),
                ...(value.stack ? { stack: redactLogText(value.stack) } : {}),
                ...('cause' in value && value.cause !== undefined
                    ? { cause: normalizeLogValue(value.cause, ancestors) }
                    : {}),
            };
        }
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (Array.isArray(value)) {
            return value.map((item) => normalizeLogValue(item, ancestors));
        }
        const normalized: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value)) {
            normalized[key] = isSensitiveLogKey(key) ? '[REDACTED]' : normalizeLogValue(child, ancestors);
        }
        return normalized;
    }
    finally {
        ancestors.delete(value);
    }
}
function stringifyLogRecord(record: Record<string, unknown>): string {
    return JSON.stringify(normalizeLogValue(record, new Set<object>()));
}
export function createLogger(options: LoggerOptions = {}) {
    const configuredLevel = normalizeLogLevel(options.level ?? process.env.QWEN_DAP_LOG_LEVEL);
    const sink = options.sink ?? ((line: string) => process.stderr.write(`${line}\n`));
    const write = (level: Exclude<LogLevel, 'silent'>, message: string, fields?: LogFields) => {
        if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[configuredLevel])
            return;
        sink(stringifyLogRecord({
            timestamp: new Date().toISOString(),
            level,
            component: 'qwen-dap-mcp',
            message,
            ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
        }));
    };
    return {
        level: configuredLevel,
        debug: (message: string, fields?: LogFields) => write('debug', message, fields),
        info: (message: string, fields?: LogFields) => write('info', message, fields),
        warn: (message: string, fields?: LogFields) => write('warn', message, fields),
        error: (message: string, fields?: LogFields) => write('error', message, fields),
    };
}
export const logger = createLogger();
//# sourceMappingURL=logger.js.map