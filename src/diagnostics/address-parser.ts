/**
 * Shared DAP address-string parser for the diagnostic surfaces.
 *
 * The surfaces intentionally differ in strictness, so every call site must
 * pass its mode explicitly:
 *
 * | mode       | normalization              | hex match    | signed decimal | used by              |
 * |------------|----------------------------|--------------|----------------|----------------------|
 * | 'lenient'  | trim + strip ` ' _ and ws  | anywhere     | yes            | intelligent-diagnosis|
 * | 'hex-only' | strip backticks only       | anywhere     | no             | runtime-v2           |
 * | 'exact'    | trim + strip ` ' _ and ws  | full match   | no             | analyze-snapshot     |
 *
 * 'lenient' powers heuristic register/local correlation, where a decimal
 * such as "4096" may still be worth correlating. 'hex-only' keeps pointer
 * provenance conservative (only 0x-prefixed hex counts as an address).
 * 'exact' is used where values must be well-formed addresses (disassembly
 * IP / instruction matching). Keep all modes in sync via the shared table
 * in test/address-parser-regression.test.mjs.
 */
export type AddressParseMode = 'lenient' | 'hex-only' | 'exact';
export function parseAddress(value: string | undefined, mode: AddressParseMode): bigint | undefined {
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
