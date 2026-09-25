import test from 'node:test';
import assert from 'node:assert/strict';
import { createSuggestionsController } from '../src/features/search/suggestions-controller.ts';

const wait = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));

test('profile suggestions controller debounces typing and suppresses short input', async () => {
  const requests = [];
  const states = [];
  const controller = createSuggestionsController(
    async (q) => {
      requests.push(q);
      return [
        {
          user_id: 'u-1',
          username: 'ramthegoat',
          display_name: 'Ram',
          bio: 'I love places!',
          avatar_path: null,
        },
      ];
    },
    (s) => states.push(s),
    5,
    'Could not load profiles.',
  );

  // Single character: should not fire request
  controller.update('r');
  await wait();
  assert.deepEqual(requests, []);

  // Multi-character burst: only last one fires
  controller.update('ra');
  controller.update('ram');
  await wait();
  assert.deepEqual(requests, ['ram']);

  assert.equal(states.at(-1).loading, false);
  assert.equal(states.at(-1).items.length, 1);
  assert.equal(states.at(-1).items[0].username, 'ramthegoat');

  // Clearing query resets items
  controller.update('');
  await wait();
  assert.equal(states.at(-1).loading, false);
  assert.deepEqual(states.at(-1).items, []);

  controller.cancel();
});

test('profile suggestions controller uses custom fallback error message on failure', async () => {
  const states = [];
  const controller = createSuggestionsController(
    async () => {
      throw new Error('Supabase network error');
    },
    (s) => states.push(s),
    0,
    'Could not search profiles. Check your connection.',
  );

  controller.update('sriram');
  await wait();
  assert.equal(states.at(-1).loading, false);
  assert.equal(states.at(-1).error, 'Could not search profiles. Check your connection.');
  assert.deepEqual(states.at(-1).items, []);

  controller.cancel();
});

test('profile suggestions controller cancels in-flight responses on dismiss', async () => {
  let finishPending;
  const states = [];
  const controller = createSuggestionsController(
    () =>
      new Promise((resolve) => {
        finishPending = resolve;
      }),
    (s) => states.push(s),
    0,
  );

  controller.update('alex');
  await wait();
  controller.cancel();
  const stateCount = states.length;

  if (finishPending) {
    finishPending([{ user_id: '1', username: 'alex', display_name: 'Alex', bio: null, avatar_path: null }]);
  }
  await wait();
  assert.equal(states.length, stateCount);
});
