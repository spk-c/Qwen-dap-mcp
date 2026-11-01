const LEVEL_PRIORITY = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: Number.POSITIVE_INFINITY,
};
function normalizeLogLevel(value) {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error' || normalized === 'silent') {
        return normalized;
    }
    return 'info';
}
function normalizeLogValue(value, ancestors) {
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
                message: value.message,
                ...(value.stack ? { stack: value.stack } : {}),
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
        const normalized = {};
        for (const [key, child] of Object.entries(value)) {
            normalized[key] = normalizeLogValue(child, ancestors);
        }
        return normalized;
    }
    finally {
        ancestors.delete(value);
    }
}
function stringifyLogRecord(record) {
    return JSON.stringify(normalizeLogValue(record, new Set()));
}
export function createLogger(options = {}) {
    const configuredLevel = normalizeLogLevel(options.level ?? process.env.QWEN_DAP_LOG_LEVEL);
    const sink = options.sink ?? ((line) => process.stderr.write(`${line}\n`));
    const write = (level, message, fields) => {
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
        debug: (message, fields) => write('debug', message, fields),
        info: (message, fields) => write('info', message, fields),
        warn: (message, fields) => write('warn', message, fields),
        error: (message, fields) => write('error', message, fields),
    };
}
export const logger = createLogger();
//# sourceMappingURL=logger.js.map