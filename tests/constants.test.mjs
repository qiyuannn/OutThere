import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Config,
  Timeouts,
  CacheTtl,
  ImageLimits,
  InputLimits,
  PaginationLimits,
  StorageBuckets,
  StorageKeys,
  DeepLinks,
} from '../src/constants/index.ts';

test('Config provides dynamic getters responding to process.env changes', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalSupport = process.env.EXPO_PUBLIC_SUPPORT_URL;

  try {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://custom-test.supabase.co';
    assert.equal(Config.supabase.url, 'https://custom-test.supabase.co');

    delete process.env.EXPO_PUBLIC_SUPPORT_URL;
    assert.equal(Config.support.contactUrl, 'https://outthere.app/support');

    process.env.EXPO_PUBLIC_SUPPORT_URL = 'https://help.example.com';
    assert.equal(Config.support.contactUrl, 'https://help.example.com');
  } finally {
    if (originalUrl !== undefined) {
      process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    } else {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    }

    if (originalSupport !== undefined) {
      process.env.EXPO_PUBLIC_SUPPORT_URL = originalSupport;
    } else {
      delete process.env.EXPO_PUBLIC_SUPPORT_URL;
    }
  }
});

test('Timeouts and CacheTtl define valid positive duration constants', () => {
  assert.ok(Timeouts.placeSearchEdgeFunctionMs > 0);
  assert.ok(Timeouts.deviceLocationMs > 0);
  assert.ok(Timeouts.searchDebounceMs > 0);
  assert.equal(CacheTtl.signedUrlSeconds, 3600);
  assert.equal(CacheTtl.swipeWindowDurationMs, 24 * 60 * 60 * 1000);
});

test('ImageLimits enforce exact base64 and binary constraints', () => {
  assert.equal(ImageLimits.maxAvatarSizeBytes, 2 * 1024 * 1024);
  assert.equal(ImageLimits.maxAvatarBase64Chars, 2_796_200);
  assert.equal(ImageLimits.maxProfileAvatarDimensionPx, 512);
  assert.equal(ImageLimits.maxPostPhotos, 5);
  assert.equal(ImageLimits.maxPostPhotoSizeBytes, 5 * 1024 * 1024);
});

test('InputLimits define valid field lengths', () => {
  assert.equal(InputLimits.maxDisplayNameLength, 60);
  assert.equal(InputLimits.minUsernameLength, 3);
  assert.equal(InputLimits.maxUsernameLength, 24);
  assert.equal(InputLimits.maxBioLength, 240);
  assert.equal(InputLimits.maxPostBodyLength, 2000);
  assert.equal(InputLimits.maxCommentLength, 1000);
});

test('StorageBuckets, StorageKeys and DeepLinks format correctly', () => {
  assert.equal(StorageBuckets.avatars, 'avatars');
  assert.equal(StorageBuckets.postPhotos, 'post-photos');
  assert.equal(StorageKeys.recentPlaces('user-42'), 'outthere:recent-places:user-42');
  assert.equal(StorageKeys.discoveryAllowance('user-42'), 'outthere:discovery-allowance:user-42');
  assert.equal(DeepLinks.authCallbackUrl, 'outthere://auth/callback');
});
