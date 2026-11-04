export function parseAddress(value, mode) {
    if (!value)
        return undefined;
    const normalized = mode === 'hex-only'
        ? value.replace(/\`/g, '')
        : value.trim().replace(/[`'_\s]/g, '');
    const hex = mode === 'exact'
        ? /^0x([0-9a-f]+)$/i.exec(normalized)?.[1]
        : /0x([0-9a-f]+)/i.exec(normalized)?.[1];
    if (hex !== undefined) {
        try {
            return BigInt(`0x${hex}`);
        }
        catch {
            return undefined;
        }
    }
    if (mode === 'lenient' && /^-?\d+$/.test(normalized)) {
        try {
            return BigInt(normalized);
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
