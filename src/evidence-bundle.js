import { closeSync, constants, existsSync, fstatSync, linkSync, lstatSync, openSync, readSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { DapError } from './dap/errors.js';
import { resolveExistingDirectory, resolveExistingFile } from './local-path.js';
const MAX_EVIDENCE_FILE_BYTES = 8 * 1024 * 1024;
function jsonSize(value) {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
}
function assertBounded(value) {
    const size = jsonSize(value);
    if (size > MAX_EVIDENCE_FILE_BYTES) {
        throw new DapError('Evidence bundle is ' + size + ' bytes; maximum is ' + MAX_EVIDENCE_FILE_BYTES + ' bytes.');
    }
}
function writableTarget(input, overwrite, format) {
    if (!input.trim())
        throw new DapError('Evidence output path must not be empty.');
    const target = resolve(input);
    const lowered = target.toLowerCase();
    const validSuffix = format === 'json'
        ? lowered.endsWith('.qwen-dap.json')
        : format === 'markdown'
            ? lowered.endsWith('.qwen-dap.md') || lowered.endsWith('.qwen-dap.markdown')
            : lowered.endsWith('.qwen-dap.sarif') || lowered.endsWith('.qwen-dap.sarif.json');
    if (!validSuffix) {
        throw new DapError('Evidence exports must use a dedicated .qwen-dap.json, .qwen-dap.md, or .qwen-dap.sarif filename so this feature cannot act as a general-purpose file writer.');
    }
    resolveExistingDirectory(dirname(target), 'Evidence output directory');
    const stat = lstatSync(target, { throwIfNoEntry: false });
    if (stat) {
        if (stat.isSymbolicLink())
            throw new DapError('Evidence output path must not be a symbolic link.');
        if (!stat.isFile())
            throw new DapError('Evidence output path exists and is not a regular file.');
        if (!overwrite)
            throw new DapError("Evidence output already exists at '" + target + "'. Set overwrite=true only when replacement is intentional.");
    }
    return target;
}
export function buildSarif(evidence) {
    const hypotheses = Array.isArray(evidence?.hypotheses) ? evidence.hypotheses : [];
    const frame = evidence?.snapshot?.frame ?? evidence?.report?.snapshot?.frame;
    const results = hypotheses.slice(0, 20).map((hypothesis) => ({
        ruleId: String(hypothesis.id ?? 'native-runtime-failure'),
        level: Number(hypothesis.evidenceScore ?? 0) >= 70 ? 'error'
            : Number(hypothesis.evidenceScore ?? 0) >= 40 ? 'warning'
                : 'note',
        message: {
            text: String(hypothesis.title ?? hypothesis.id ?? 'Native runtime hypothesis') + ' (evidence score ' + String(hypothesis.evidenceScore ?? 'n/a') + '/100)',
        },
        ...(frame?.source?.path
            ? {
                locations: [{
                        physicalLocation: {
                            artifactLocation: { uri: frame.source.path },
                            region: { startLine: Math.max(1, Number(frame.line ?? 1)) },
                        },
                    }],
            }
            : {}),
        properties: {
            supporting: hypothesis.supporting ?? [],
            contradicting: hypothesis.contradicting ?? [],
            nextEvidence: hypothesis.nextEvidence ?? [],
        },
    }));
    return {
        version: '2.1.0',
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        runs: [{
                tool: {
                    driver: {
                        name: 'qwen-dap-mcp',
                        informationUri: 'https://github.com/SLP-DEV1/qwen-dap-mcp',
                        rules: [...new Set(results.map((result) => result.ruleId))].map((id) => ({
                            id,
                            shortDescription: { text: id },
                        })),
                    },
                },
                results,
            }],
    };
}
export function renderEvidenceMarkdown(evidence) {
    const fingerprint = evidence?.fingerprintsV2?.semantic ?? evidence?.fingerprint ?? evidence?.report?.fingerprint;
    const hypotheses = Array.isArray(evidence?.hypotheses) ? evidence.hypotheses : [];
    const lines = [
        '# Native runtime evidence',
        '',
        fingerprint ? 'Fingerprint: `' + fingerprint + '`' : 'Fingerprint: unavailable',
        '',
        '## Hypotheses',
        '',
    ];
    if (!hypotheses.length)
        lines.push('No structured hypotheses were included in this bundle.');
    for (const hypothesis of hypotheses.slice(0, 20)) {
        lines.push('### ' + String(hypothesis.title ?? hypothesis.id ?? 'Hypothesis'), '', 'Evidence score: **' + String(hypothesis.evidenceScore ?? 'n/a') + '/100**', '');
        const supporting = Array.isArray(hypothesis.supporting) ? hypothesis.supporting : [];
        for (const item of supporting.slice(0, 12)) {
            lines.push('- ' + String(item.summary ?? item.kind ?? item));
        }
        lines.push('');
    }
    lines.push('## Structured evidence', '', '```json', JSON.stringify(evidence, null, 2), '```', '');
    return lines.join('\n');
}
export function exportEvidenceBundle(options) {
    assertBounded(options.evidence);
    const format = options.format ?? 'json';
    const target = writableTarget(options.path, options.overwrite ?? false, format);
    const content = format === 'markdown'
        ? renderEvidenceMarkdown(options.evidence)
        : JSON.stringify(format === 'sarif' ? buildSarif(options.evidence) : options.evidence, null, 2);
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_EVIDENCE_FILE_BYTES) {
        throw new DapError('Rendered evidence output is ' + bytes + ' bytes; maximum is ' + MAX_EVIDENCE_FILE_BYTES + ' bytes.');
    }
    // Never open the validated destination directly; a symlink swap between
    // check and write would otherwise redirect the file contents.
    const temporary = join(dirname(target), '.' + basename(target) + '.' + randomBytes(12).toString('hex') + '.tmp');
    try {
        writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        if (options.overwrite) {
            const current = lstatSync(target, { throwIfNoEntry: false });
            if (current && (!current.isFile() || current.isSymbolicLink()))
                throw new DapError('Evidence output path changed to a non-regular file during export.');
            renameSync(temporary, target);
        }
        else {
            // Atomic creation: fails if another process created target.
            linkSync(temporary, target);
        }
    }
    finally {
        if (existsSync(temporary))
            unlinkSync(temporary);
    }
    return {
        action: 'export',
        path: target,
        format,
        bytes,
        overwritten: Boolean(options.overwrite),
    };
}
export function importEvidenceBundle(pathInput) {
    const path = resolveExistingFile(pathInput, 'Evidence bundle');
    const lowered = path.toLowerCase();
    const isSarif = lowered.endsWith('.qwen-dap.sarif') || lowered.endsWith('.qwen-dap.sarif.json');
    if (!lowered.endsWith('.qwen-dap.json') && !isSarif) {
        throw new DapError('Evidence import is restricted to .qwen-dap.json, .qwen-dap.sarif or .qwen-dap.sarif.json files.');
    }
    const initial = lstatSync(path);
    if (!initial.isFile() || initial.isSymbolicLink())
        throw new DapError('Evidence import requires a regular file, not a symlink.');
    if (initial.size > MAX_EVIDENCE_FILE_BYTES)
        throw new DapError('Evidence bundle exceeds the 8 MiB safety limit.');
    // Open the file once, without following a final symlink on platforms that
    // support O_NOFOLLOW. fstat confirms we did not race the initial path check.
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let content;
    let bytes;
    try {
        const stat = fstatSync(fd);
        if (!stat.isFile() || stat.ino !== initial.ino || stat.dev !== initial.dev)
            throw new DapError('Evidence file identity changed while opening; refusing import.');
        const buffer = Buffer.allocUnsafe(MAX_EVIDENCE_FILE_BYTES + 1);
        let offset = 0;
        while (offset < buffer.length) {
            const count = readSync(fd, buffer, offset, buffer.length - offset, null);
            if (count === 0)
                break;
            offset += count;
        }
        if (offset > MAX_EVIDENCE_FILE_BYTES)
            throw new DapError('Evidence import exceeded the 8 MiB read limit.');
        bytes = offset;
        content = buffer.toString('utf8', 0, offset);
    }
    finally {
        closeSync(fd);
    }
    let evidence;
    try {
        evidence = JSON.parse(content);
    }
    catch (cause) {
        throw new DapError('Evidence import requires valid structured JSON/SARIF; Markdown is not an import format.', {
            cause: cause instanceof Error ? cause : undefined,
        });
    }
    if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence))
        throw new DapError('Evidence import requires a structured JSON object.');
    if (isSarif && (evidence.version !== '2.1.0' || !Array.isArray(evidence.runs)))
        throw new DapError('SARIF evidence import requires a SARIF 2.1.0 object with runs.');
    return {
        action: 'import',
        path,
        bytes,
        evidence,
        offline: true,
        note: 'Imported evidence is read-only offline context; it cannot resume or mutate the original debug target.',
    };
}
//# sourceMappingURL=evidence-bundle.js.map