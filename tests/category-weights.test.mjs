import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOOD_CATEGORY_GROUPS,
  ACTIVITY_CATEGORY_GROUPS,
  getCategoryGroupKey,
  getCategoryKeysForPlace,
  clampWeight,
  calculateCategoryWeightMultiplier,
  PASS_WEIGHT_DELTA,
  NOT_NOW_WEIGHT_DELTA,
  SAVE_WEIGHT_DELTA,
} from '../src/features/categories/catalog.ts';

test('Food catalog maps 10 category groups and all place types properly', () => {
  assert.equal(FOOD_CATEGORY_GROUPS.length, 10);
  const allFoodTypes = new Set();
  for (const group of FOOD_CATEGORY_GROUPS) {
    assert.ok(group.key);
    assert.ok(group.label);
    assert.ok(group.icon);
    assert.ok(group.placeTypes.length > 0);
    for (const t of group.placeTypes) {
      allFoodTypes.add(t);
      const mappedGroupKey = getCategoryGroupKey('food', t);
      assert.equal(mappedGroupKey, group.key);
    }
  }
  // Check key cuisines and place types
  assert.equal(getCategoryGroupKey('food', 'sushi_restaurant'), 'east_southeast_asian');
  assert.equal(getCategoryGroupKey('food', 'ramen_restaurant'), 'east_southeast_asian');
  assert.equal(getCategoryGroupKey('food', 'cafe'), 'cafes_bakeries_sweets');
  assert.equal(getCategoryGroupKey('food', 'italian_restaurant'), 'western_european_mediterranean');
  assert.equal(getCategoryGroupKey('food', 'taco_restaurant'), 'latin_south_american_bbq');
  assert.equal(getCategoryGroupKey('food', 'indian_restaurant'), 'south_asian_middle_eastern_african');
  assert.equal(getCategoryGroupKey('food', 'hamburger_restaurant'), 'quick_bites_fast_food');
  assert.equal(getCategoryGroupKey('food', 'bar'), 'bars_pubs_breweries');
  assert.equal(getCategoryGroupKey('food', 'seafood_restaurant'), 'steak_seafood_specialty');
  assert.equal(getCategoryGroupKey('food', 'vegan_restaurant'), 'healthy_vegan_fusion');
  assert.equal(getCategoryGroupKey('food', 'fine_dining_restaurant'), 'casual_fine_dining');
});

test('Activities catalog maps 6 category groups and all place types properly', () => {
  assert.equal(ACTIVITY_CATEGORY_GROUPS.length, 6);
  for (const group of ACTIVITY_CATEGORY_GROUPS) {
    assert.ok(group.key);
    assert.ok(group.label);
    assert.ok(group.icon);
    assert.ok(group.placeTypes.length > 0);
    for (const t of group.placeTypes) {
      const mappedGroupKey = getCategoryGroupKey('activities', t);
      assert.equal(mappedGroupKey, group.key);
    }
  }
  assert.equal(getCategoryGroupKey('activities', 'park'), 'nature_parks_outdoors');
  assert.equal(getCategoryGroupKey('activities', 'museum'), 'culture_history_museums');
  assert.equal(getCategoryGroupKey('activities', 'bowling_alley'), 'amusement_games_fun');
  assert.equal(getCategoryGroupKey('activities', 'concert_hall'), 'arts_shows_music');
  assert.equal(getCategoryGroupKey('activities', 'marina'), 'adventure_sports_recreation');
  assert.equal(getCategoryGroupKey('activities', 'night_club'), 'social_nightlife_venues');
});

test('Weight clamping strictly keeps values between 0.00 and 1.00', () => {
  assert.equal(clampWeight(-0.5), 0.00);
  assert.equal(clampWeight(0.00), 0.00);
  assert.equal(clampWeight(0.456), 0.46);
  assert.equal(clampWeight(1.00), 1.00);
  assert.equal(clampWeight(1.50), 1.00);
});

test('Weight delta parameters match gradual personal learning curve', () => {
  assert.equal(PASS_WEIGHT_DELTA, -0.01);
  assert.equal(NOT_NOW_WEIGHT_DELTA, 0.02);
  assert.equal(SAVE_WEIGHT_DELTA, 0.10);

  // Verify Let's Go >> Not Now > 0 > Pass
  assert.ok(SAVE_WEIGHT_DELTA > NOT_NOW_WEIGHT_DELTA);
  assert.ok(NOT_NOW_WEIGHT_DELTA > 0);
  assert.ok(PASS_WEIGHT_DELTA < 0);
});

test('Category multiplier calculation strictly satisfies formula [0.5, 2.0]', () => {
  // At W = 0.00: 0.5 + 1.5 * 0 = 0.5
  assert.equal(calculateCategoryWeightMultiplier(0.00), 0.5);
  // At W = 0.50: 0.5 + 1.5 * 0.5 = 1.25
  assert.equal(calculateCategoryWeightMultiplier(0.50), 1.25);
  // At W = 1.00: 0.5 + 1.5 * 1.0 = 2.0
  assert.equal(calculateCategoryWeightMultiplier(1.00), 2.0);
});

test('Resolves matching category keys for places accurately', () => {
  const keys = getCategoryKeysForPlace('food', 'sushi_restaurant', ['japanese_restaurant', 'restaurant', 'point_of_interest']);
  assert.ok(keys.includes('east_southeast_asian'));
  assert.ok(keys.includes('casual_fine_dining'));

  // Test display names with spaces
  const persianKeys = getCategoryKeysForPlace('food', 'Persian Restaurant');
  assert.ok(persianKeys.includes('south_asian_middle_eastern_african'));

  const seafoodKeys = getCategoryKeysForPlace('food', 'Seafood Restaurant');
  assert.ok(seafoodKeys.includes('steak_seafood_specialty'));

  const actKeys = getCategoryKeysForPlace('activities', 'art_museum', ['museum', 'tourist_attraction']);
  assert.ok(actKeys.includes('culture_history_museums'));
  assert.ok(actKeys.includes('adventure_sports_recreation'));

  const parkKeys = getCategoryKeysForPlace('activities', 'Botanical Garden');
  assert.ok(parkKeys.includes('nature_parks_outdoors'));
});

test('Radar chart items map all category groups correctly', () => {
  const sampleWeights = {
    nature_parks_outdoors: 0.8,
    culture_history_museums: 0.4,
  };

  const activityItems = ACTIVITY_CATEGORY_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    weight: sampleWeights[g.key] ?? 0,
  }));

  assert.equal(activityItems.length, 6);
  assert.equal(activityItems[0].weight, 0.8);
  assert.equal(activityItems[1].weight, 0.4);
  assert.equal(activityItems[2].weight, 0);

  // Derive top preference and active count
  let topWeight = 0;
  let topCategory = '—';
  let activeCount = 0;
  for (const item of activityItems) {
    if (item.weight > 0) activeCount++;
    if (item.weight > topWeight) {
      topWeight = item.weight;
      topCategory = item.label;
    }
  }

  assert.equal(activeCount, 2);
  assert.equal(topCategory, 'Nature & Outdoors');
  assert.equal(Math.round(topWeight * 100), 80);
});
