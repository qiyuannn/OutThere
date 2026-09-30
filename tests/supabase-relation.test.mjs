import test from 'node:test';
import assert from 'node:assert/strict';
import { unwrapSingleRelation } from '../src/lib/supabase-relation.ts';


test('unwrapSingleRelation returns null for null, undefined, or empty array', () => {
  assert.equal(unwrapSingleRelation(null), null);
  assert.equal(unwrapSingleRelation(undefined), null);
  assert.equal(unwrapSingleRelation([]), null);
});

test('unwrapSingleRelation returns the item when given a single object', () => {
  const place = { google_place_id: 'g123', display_name: 'Central Cafe' };
  assert.deepEqual(unwrapSingleRelation(place), place);
});

test('unwrapSingleRelation returns the first item when given an array', () => {
  const place1 = { google_place_id: 'g1', display_name: 'Place 1' };
  const place2 = { google_place_id: 'g2', display_name: 'Place 2' };
  assert.deepEqual(unwrapSingleRelation([place1, place2]), place1);
});

test('unwrapSingleRelation returns null when array contains only null or undefined', () => {
  assert.equal(unwrapSingleRelation([null]), null);
  assert.equal(unwrapSingleRelation([undefined]), null);
});

test('unwrapSingleRelation preserves primitive values', () => {
  assert.equal(unwrapSingleRelation('value'), 'value');
  assert.equal(unwrapSingleRelation(0), 0);
  assert.equal(unwrapSingleRelation(false), false);
  assert.equal(unwrapSingleRelation(['item']), 'item');
});
