import test from 'node:test';
import assert from 'node:assert/strict';

import { accountError, matchesDeletionConfirmation } from '../src/features/profile/account-model.ts';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.ts';

const request = (confirmation, token = 'valid') => new Request('https://example.test/delete-account', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmation }),
});

test('account deletion confirmation matches the signed-in username', () => {
  assert.equal(matchesDeletionConfirmation('Explorer_1', ' explorer_1 '), true);
  assert.equal(matchesDeletionConfirmation('Explorer_1', 'Explorer_2'), false);
  assert.equal(matchesDeletionConfirmation('', ''), false);
});

test('delete-account authenticates, deletes the auth user, then removes the avatar', async () => {
  const calls = [];
  const handler = createDeleteAccountHandler({
    authenticate: async token => token === 'valid' ? { id: 'user-1' } : null,
    profile: async () => ({ username: 'explorer_1', avatar_path: 'user-1/avatar.jpg' }),
    removeAvatar: async path => { calls.push(`avatar:${path}`); },
    deleteUser: async id => { calls.push(`user:${id}`); },
  });
  const response = await handler(request('explorer_1'));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['user:user-1', 'avatar:user-1/avatar.jpg']);
  assert.deepEqual(await response.json(), { deleted: true });
});

test('delete-account rejects expired sessions and incorrect confirmation without deleting', async () => {
  let deleted = false;
  const handler = createDeleteAccountHandler({
    authenticate: async token => token === 'valid' ? { id: 'user-1' } : null,
    profile: async () => ({ username: 'explorer_1', avatar_path: null }),
    removeAvatar: async () => {},
    deleteUser: async () => { deleted = true; },
  });
  assert.equal((await handler(request('explorer_1', 'expired'))).status, 401);
  assert.equal((await handler(request('wrong'))).status, 400);
  assert.equal(deleted, false);
});

test('a completed account deletion succeeds even if later avatar cleanup fails', async () => {
  let deleted = false;
  const handler = createDeleteAccountHandler({
    authenticate: async () => ({ id: 'user-1' }),
    profile: async () => ({ username: 'explorer_1', avatar_path: 'user-1/avatar.jpg' }),
    deleteUser: async () => { deleted = true; },
    removeAvatar: async () => { throw new Error('storage unavailable'); },
  });
  const response = await handler(request('explorer_1'));
  assert.equal(response.status, 200);
  assert.equal(deleted, true);
});

test('account deletion errors do not expose backend details', () => {
  assert.match(accountError(new Error('Type your username exactly to confirm account deletion.')), /username exactly/);
  assert.match(accountError(new Error('fetch failed')), /offline/);
  assert.doesNotMatch(accountError(new Error('service role database details')), /service role/);
});
