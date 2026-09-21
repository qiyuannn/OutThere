import assert from 'node:assert/strict';
import test from 'node:test';
import { createModerationHandler } from '../supabase/functions/moderate-social/handler.ts';

const call = (handler, body, token = 'session') => handler(new Request('https://example.test', {
  method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
}));

test('moderation queue is restricted to app-metadata moderators', async () => {
  let listed = false;
  const handler = createModerationHandler({
    authenticate: async () => ({ id: 'user', app_metadata: {} }),
    list: async () => { listed = true; return []; }, moderate: async () => {},
  });
  const response = await call(handler, { action: 'list', status: 'open' });
  assert.equal(response.status, 403);
  assert.equal(listed, false);
});

test('moderators can page supported queues', async () => {
  const calls = [];
  const handler = createModerationHandler({
    authenticate: async () => ({ id: 'mod', app_metadata: { role: 'moderator' } }),
    list: async (status, offset) => { calls.push({ status, offset }); return [{ id: 'report' }]; },
    moderate: async () => {},
  });
  const response = await call(handler, { action: 'list', status: 'actioned', offset: 21 });
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ status: 'actioned', offset: 21 }]);
  assert.deepEqual((await response.json()).reports, [{ id: 'report' }]);
});

test('resolution validates decisions before invoking the transactional database action', async () => {
  const decisions = [];
  const handler = createModerationHandler({
    authenticate: async () => ({ id: 'mod', app_metadata: { is_moderator: true } }),
    list: async () => [],
    moderate: async (...decision) => { decisions.push(decision); },
  });
  const bad = await call(handler, { action: 'resolve', report_id: 'not-a-uuid', resolution: 'ban_everyone' });
  assert.equal(bad.status, 400);
  assert.equal(decisions.length, 0);
  const good = await call(handler, {
    action: 'resolve', report_id: '123e4567-e89b-42d3-a456-426614174000', resolution: 'suspend_user', notes: 'Repeated harassment',
  });
  assert.equal(good.status, 200);
  assert.deepEqual(decisions, [['123e4567-e89b-42d3-a456-426614174000', 'suspend_user', 'Repeated harassment', 'mod']]);
});
