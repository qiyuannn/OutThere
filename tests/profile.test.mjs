import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyDraft,
  normalizeProfile,
  validateProfile,
  toDraft,
  profileError,
  formatActivitiesTitle,
  formatStatisticsTitle,
} from '../src/features/profile/model.ts';

const complete = () => ({ ...emptyDraft(), username: 'explorer_1', display_name: 'Alex' });
test('onboarding only requires identity fields', () => {
  const draft = { ...emptyDraft(), username: 'explorer_1', display_name: 'Alex' };
  assert.equal(validateProfile(draft), null);
  assert.equal(validateProfile(complete()), null);
});
test('normalization handles whitespace and username case', () => {
  const draft = { ...complete(), username: ' Alex_1 ', display_name: ' Alex ', bio: ' Hi ' };
  const value = normalizeProfile(draft);
  assert.equal(value.username, 'alex_1'); assert.equal(value.display_name, 'Alex');
  assert.equal(value.bio, 'Hi');
});
test('rejects invalid profile identity fields', () => {
  for (const patch of [{ username: 'a' }, { username: 'a/b' }, { display_name: '   ' }, { bio: 'x'.repeat(241) }]) {
    assert.ok(validateProfile({ ...complete(), ...patch }), JSON.stringify(patch));
  }
});
test('restores saved editable values without including server metadata', () => {
  const profile = { ...complete(), user_id: 'user-1', version: 5, onboarding_completed: false };
  const draft = toDraft(profile);
  assert.equal(draft.username, profile.username);
  assert.equal('version' in draft, false); assert.equal('onboarding_completed' in draft, false);
  assert.deepEqual(toDraft(null), emptyDraft());
});
test('reports username conflicts and stale edits without leaking backend errors', () => {
  assert.match(profileError({ code: '23505' }), /already taken/);
  assert.match(profileError(new Error('Your profile changed on another device. Reload it before saving again.')), /Reload/);
  assert.doesNotMatch(profileError(new Error('private database details')), /private database/);
});
test('formats activities and statistics headers for own profile and other users', () => {
  assert.equal(formatActivitiesTitle(true), 'My Past Activities');
  assert.equal(formatActivitiesTitle(true, 'Alex'), 'My Past Activities');
  assert.equal(formatActivitiesTitle(false, 'Sarah'), 'Sarah’s Activities');
  assert.equal(formatActivitiesTitle(false), 'Past Activities');

  assert.equal(formatStatisticsTitle(true), 'Distribution & Statistics');
  assert.equal(formatStatisticsTitle(true, 'Alex'), 'Distribution & Statistics');
  assert.equal(formatStatisticsTitle(false, 'Sarah'), 'Sarah’s Statistics');
  assert.equal(formatStatisticsTitle(false), 'Distribution & Statistics');
});

