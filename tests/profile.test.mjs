import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDraft, normalizeProfile, validateProfile, toDraft, profileError } from '../src/features/profile/model.ts';

const complete = () => ({ ...emptyDraft(), username: 'explorer_1', display_name: 'Alex', city: 'Singapore', interests: ['nature'] });
test('onboarding can save identity before city and interests, but cannot finish early', () => {
  const draft = { ...emptyDraft(), username: 'explorer_1', display_name: 'Alex' };
  assert.equal(validateProfile(draft, 0), null);
  assert.match(validateProfile(draft), /city/);
  assert.match(validateProfile({ ...draft, city: 'Singapore' }, 1), /interest/);
  assert.equal(validateProfile(complete()), null);
});
test('normalization handles whitespace, username case, and duplicate interests without mutating input', () => {
  const draft = { ...complete(), username: ' Alex_1 ', display_name: ' Alex ', city: ' Singapore ', bio: ' Hi ', interests: ['nature', 'nature'] };
  const value = normalizeProfile(draft);
  assert.equal(value.username, 'alex_1'); assert.equal(value.display_name, 'Alex');
  assert.equal(value.city, 'Singapore'); assert.equal(value.bio, 'Hi');
  assert.deepEqual(value.interests, ['nature']); assert.equal(draft.interests.length, 2);
});
test('rejects invalid profile fields and out of bounds travel ranges', () => {
  for (const patch of [{ username: 'a' }, { username: 'a/b' }, { display_name: '   ' }, { bio: 'x'.repeat(241) }, { city: 'x'.repeat(81) }, { interests: ['unknown'] }, { budget: 'other' }, { exploration_style: 'other' }, { travel_radius_meters: 0 }, { travel_radius_meters: 50001 }, { travel_radius_meters: NaN }, { travel_radius_meters: 1200.5 }]) {
    assert.ok(validateProfile({ ...complete(), ...patch }), JSON.stringify(patch));
  }
  for (const distance of [1000, 50000]) assert.equal(validateProfile({ ...complete(), travel_radius_meters: distance }), null);
});
test('restores saved editable values without including server metadata or sharing arrays', () => {
  const profile = { ...complete(), user_id: 'user-1', version: 5, onboarding_step: 2, onboarding_completed: false };
  const draft = toDraft(profile);
  assert.equal(draft.username, profile.username); assert.equal(draft.city, profile.city);
  assert.equal('version' in draft, false); assert.equal('onboarding_completed' in draft, false);
  draft.interests.push('cafes'); assert.deepEqual(profile.interests, ['nature']);
  assert.deepEqual(toDraft(null), emptyDraft());
});
test('reports username conflicts and stale edits without leaking backend errors', () => {
  assert.match(profileError({ code: '23505' }), /already taken/);
  assert.match(profileError(new Error('Your profile changed on another device. Reload it before saving again.')), /Reload/);
  assert.doesNotMatch(profileError(new Error('private database details')), /private database/);
});
