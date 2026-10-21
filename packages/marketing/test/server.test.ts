import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createMarketingServer } from '../src/server.js';

test('server startup requires credentials except explicit local development', () => {
  assert.throws(() => createMarketingServer({ NODE_ENV: 'production' }), /MARKETING_API_KEY/);
  assert.throws(() => createMarketingServer({}), /MARKETING_API_KEY/);
  assert.throws(() => createMarketingServer({ NODE_ENV: 'production', MARKETING_ALLOW_LOCAL_NO_AUTH: 'true' }), /MARKETING_API_KEY/);
  const local = createMarketingServer({ MARKETING_ALLOW_LOCAL_NO_AUTH: 'true' });
  assert.equal(local.host, '127.0.0.1');
  local.server.close();
});

test('actual HTTP ingress rejects unauthenticated, invalid and oversized jobs while exposing health', async () => {
  const { server } = createMarketingServer({ MARKETING_API_KEY: 'test-secret' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(url + '/health')).status, 200);
    for (const auth of ['', 'Bearer wrong']) {
      assert.equal((await fetch(url + '/api/generate', { method: 'POST', headers: { authorization: auth }, body: '{}' })).status, 401);
    }
    for (const body of ['{', 'null', '[]', '{"dryRun":"false"}', '{"hookCategory":"invalid"}', '{"captureMethod":"invalid"}', '{"musicVolume":2}']) {
      const response = await fetch(url + '/api/generate', { method: 'POST', headers: { authorization: 'Bearer test-secret' }, body });
      assert.equal(response.status, 400, body);
    }
    assert.equal((await fetch(url + '/api/generate', { method: 'POST', headers: { authorization: 'Bearer test-secret' }, body: ' '.repeat(65_537) })).status, 413);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
