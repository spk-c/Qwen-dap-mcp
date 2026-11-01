import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
test('MCP server constructs and closes without launching a debugger', async () => {
  const server = createServer();
  assert.equal(typeof server.close, 'function');
  await server.close();
});
