// Deterministic real-process DAP fault injection. No debuggee is launched or attached.
const mode = process.env.QWEN_TEST_DAP_MODE ?? 'healthy';
const identity = process.env.QWEN_TEST_DAP_ID ?? 'anonymous';
let buffer = Buffer.alloc(0);
let nextSeq = 1;
const send = (message) => {
  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  process.stdout.write(Buffer.concat([
    Buffer.from('Content-Length: ' + payload.length + '\r\n\r\n', 'ascii'),
    payload,
  ]));
};
const reply = (request, success = true, body = {}, message) => send({
  seq: nextSeq++, type: 'response', request_seq: request.seq,
  command: request.command, success, body, ...(message ? {message} : {}),
});
function handle(request) {
  if (request.command === 'initialize') {
    reply(request, true, {supportsConfigurationDoneRequest: true});
    return;
  }
  if (request.command === 'disconnect') {
    reply(request);
    setTimeout(() => process.exit(0), 10);
    return;
  }
  if (request.command !== 'threads') {
    reply(request);
    return;
  }
  switch (mode) {
    case 'crash':
      process.exit(37);
      break;
    case 'timeout':
      // Intentionally never reply; request deadlines belong to the client.
      break;
    case 'degraded':
      reply(request, false, {}, 'simulated adapter failure');
      break;
    case 'malformed':
      process.stdout.write('Content-Length: invalid\r\n\r\n');
      break;
    case 'healthy': {
      // Deliver some responses out of order to test correlation by request_seq.
      const delay = (request.seq * 17 % 13) * 3;
      setTimeout(() => reply(request, true, {
        threads: [{id: 1, name: 'adapter-' + identity}],
        marker: request.arguments?.marker,
      }), delay);
      break;
    }
    default:
      process.exitCode = 2;
      process.stderr.write('Unknown QWEN_TEST_DAP_MODE\n');
      process.stdin.pause();
  }
}
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  if (buffer.length > 1024 * 1024) process.exit(3);
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd < 0) return;
    const header = buffer.subarray(0, headerEnd).toString('ascii');
    const match = /(?:^|\r\n)Content-Length:\s*(\d+)/i.exec(header);
    if (!match) process.exit(4);
    const size = Number(match[1]);
    if (!Number.isSafeInteger(size) || size > 1024 * 1024) process.exit(5);
    const end = headerEnd + 4 + size;
    if (buffer.length < end) return;
    const request = JSON.parse(buffer.subarray(headerEnd + 4, end).toString('utf8'));
    buffer = buffer.subarray(end);
    handle(request);
  }
});
