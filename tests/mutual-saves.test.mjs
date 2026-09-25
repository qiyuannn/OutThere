import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMutualSavesText,
  MUTUAL_SAVES_PLURAL_TEXT,
  MUTUAL_SAVES_SINGULAR_TEXT,
} from '../src/features/place-details/model.ts';

test('formatMutualSavesText handles empty array', () => {
  assert.equal(formatMutualSavesText([]), '');
});

test('formatMutualSavesText handles 1 mutual follower', () => {
  assert.equal(formatMutualSavesText([{ displayName: 'Alice' }]), MUTUAL_SAVES_SINGULAR_TEXT);
  assert.equal(
    formatMutualSavesText([{ displayName: 'Alice' }], { literal: true }),
    MUTUAL_SAVES_PLURAL_TEXT
  );
});

test('formatMutualSavesText handles 2 mutual followers', () => {
  assert.equal(
    formatMutualSavesText([{ displayName: 'Alice' }, { displayName: 'Bob' }]),
    MUTUAL_SAVES_PLURAL_TEXT
  );
});

test('formatMutualSavesText handles 3 or more mutual followers', () => {
  assert.equal(
    formatMutualSavesText([
      { displayName: 'Alice' },
      { displayName: 'Bob' },
      { displayName: 'Charlie' },
    ]),
    MUTUAL_SAVES_PLURAL_TEXT
  );

  assert.equal(
    formatMutualSavesText([
      { displayName: 'Alice' },
      { displayName: 'Bob' },
      { displayName: 'Charlie' },
      { displayName: 'David' },
    ]),
    MUTUAL_SAVES_PLURAL_TEXT
  );
});

