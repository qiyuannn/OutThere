import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_AD_INTERVAL,
  TEST_BANNER_ID_ANDROID,
  TEST_BANNER_ID_IOS,
  getBannerAdUnitId,
  isAdEligible,
  shouldShowFeedAd,
} from '../src/features/ads/config.ts';

test('isAdEligible grants ads only to non-Pro users on the explore feed', () => {
  assert.equal(isAdEligible(false, 'explore'), true);
  assert.equal(isAdEligible(true, 'explore'), false);
  assert.equal(isAdEligible(false, 'following'), false);
  assert.equal(isAdEligible(true, 'following'), false);
});

test('shouldShowFeedAd never shows ads to OutThere Pro subscribers', () => {
  for (let index = 0; index < 30; index++) {
    assert.equal(
      shouldShowFeedAd({ index, isPro: true, scope: 'explore' }),
      false,
      `Pro subscriber should never see ad at index ${index}`
    );
  }
});

test('shouldShowFeedAd never shows ads on following feed', () => {
  for (let index = 0; index < 30; index++) {
    assert.equal(
      shouldShowFeedAd({ index, isPro: false, scope: 'following' }),
      false,
      `Non-pro user should not see ad on following feed at index ${index}`
    );
  }
});

test('shouldShowFeedAd shows ads periodically (every 5 posts by default) on explore feed for non-Pro users', () => {
  // Posts 1 to 4 (indices 0 to 3) should not have an ad
  assert.equal(shouldShowFeedAd({ index: 0, isPro: false, scope: 'explore' }), false);
  assert.equal(shouldShowFeedAd({ index: 1, isPro: false, scope: 'explore' }), false);
  assert.equal(shouldShowFeedAd({ index: 2, isPro: false, scope: 'explore' }), false);
  assert.equal(shouldShowFeedAd({ index: 3, isPro: false, scope: 'explore' }), false);

  // Post 5 (index 4) should have an ad
  assert.equal(shouldShowFeedAd({ index: 4, isPro: false, scope: 'explore' }), true);

  // Posts 6 to 9 (indices 5 to 8) should not have an ad
  assert.equal(shouldShowFeedAd({ index: 5, isPro: false, scope: 'explore' }), false);
  assert.equal(shouldShowFeedAd({ index: 6, isPro: false, scope: 'explore' }), false);
  assert.equal(shouldShowFeedAd({ index: 7, isPro: false, scope: 'explore' }), false);
  assert.equal(shouldShowFeedAd({ index: 8, isPro: false, scope: 'explore' }), false);

  // Post 10 (index 9) should have an ad
  assert.equal(shouldShowFeedAd({ index: 9, isPro: false, scope: 'explore' }), true);

  // Post 15 (index 14) should have an ad
  assert.equal(shouldShowFeedAd({ index: 14, isPro: false, scope: 'explore' }), true);
});

test('shouldShowFeedAd supports customizable ad intervals', () => {
  // Interval of 3 posts
  assert.equal(shouldShowFeedAd({ index: 0, isPro: false, scope: 'explore', interval: 3 }), false);
  assert.equal(shouldShowFeedAd({ index: 1, isPro: false, scope: 'explore', interval: 3 }), false);
  assert.equal(shouldShowFeedAd({ index: 2, isPro: false, scope: 'explore', interval: 3 }), true);
  assert.equal(shouldShowFeedAd({ index: 5, isPro: false, scope: 'explore', interval: 3 }), true);

  // Invalid or zero intervals should safely return false
  assert.equal(shouldShowFeedAd({ index: 0, isPro: false, scope: 'explore', interval: 0 }), false);
  assert.equal(shouldShowFeedAd({ index: 2, isPro: false, scope: 'explore', interval: -1 }), false);
});

test('getBannerAdUnitId returns official test IDs by default', () => {
  const originalIos = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS;
  const originalAndroid = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID;

  delete process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS;
  delete process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID;

  try {
    assert.equal(getBannerAdUnitId('ios'), TEST_BANNER_ID_IOS);
    assert.equal(getBannerAdUnitId('android'), TEST_BANNER_ID_ANDROID);
  } finally {
    if (originalIos !== undefined) process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS = originalIos;
    if (originalAndroid !== undefined) process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID = originalAndroid;
  }
});

test('getBannerAdUnitId respects custom environment variable overrides', () => {
  const originalIos = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS;
  const originalAndroid = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID;

  process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS = 'ca-app-pub-custom-ios/123456';
  process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID = 'ca-app-pub-custom-android/654321';

  try {
    assert.equal(getBannerAdUnitId('ios'), 'ca-app-pub-custom-ios/123456');
    assert.equal(getBannerAdUnitId('android'), 'ca-app-pub-custom-android/654321');
  } finally {
    if (originalIos !== undefined) {
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS = originalIos;
    } else {
      delete process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS;
    }
    if (originalAndroid !== undefined) {
      process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID = originalAndroid;
    } else {
      delete process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID;
    }
  }
});
