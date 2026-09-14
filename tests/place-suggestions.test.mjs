import test from 'node:test';
import assert from 'node:assert/strict';
import { createSuggestionsController } from '../src/features/search/suggestions-controller.ts';
const wait = () => new Promise(resolve => setTimeout(resolve, 15));

test('typing bursts are debounced and short or cleared input makes no request', async () => {
  const requests = [], states = [];
  const controller = createSuggestionsController(async q => { requests.push(q); return []; }, s => states.push(s), 5);
  controller.update('D'); await wait(); assert.deepEqual(requests, []);
  controller.update('Di'); controller.update('Din'); controller.update('Din Tai');
  await wait(); assert.deepEqual(requests, ['Din Tai']);
  controller.update(''); await wait(); assert.equal(states.at(-1).loading, false); assert.deepEqual(states.at(-1).items, []);
  controller.cancel();
});
test('slower earlier suggestions cannot replace matches for newer letters', async () => {
  const resolve = new Map(); const states = [];
  const controller = createSuggestionsController(q => new Promise(r => resolve.set(q, r)), s => states.push(s), 0);
  controller.update('Din'); await wait(); controller.update('Din Tai'); await wait();
  resolve.get('Din Tai')([{ id: 'new', name: 'Din Tai Fung', address: '' }]); await wait();
  resolve.get('Din')([{ id: 'old', name: 'Diner', address: '' }]); await wait();
  assert.equal(states.at(-1).items[0].id, 'new'); controller.cancel();
});
test('dismissing or selecting invalidates pending responses and errors', async () => {
  let reject; const states = [];
  const controller = createSuggestionsController(() => new Promise((_, r) => { reject = r; }), s => states.push(s), 0);
  controller.update('Din'); await wait(); controller.cancel(); const count = states.length;
  reject(new Error('late error')); await wait(); assert.equal(states.length, count);
});
test('suggestion failure offers full-search fallback without exposing provider errors', async () => {
  const states = [];
  const controller = createSuggestionsController(async () => { throw new Error('secret'); }, s => states.push(s), 0);
  controller.update('cafe'); await wait(); assert.equal(states.at(-1).loading, false);
  assert.match(states.at(-1).error, /Search places/); assert.doesNotMatch(states.at(-1).error, /secret/);
  controller.cancel();
});
