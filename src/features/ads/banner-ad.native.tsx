import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router } from 'expo-router';
import mobileAds, { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { ThemedText } from '@/components/themed-text';
import { getBannerAdUnitId } from './config';
import type { FeedAdBannerProps } from './types';

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  try {
    initialized = true;
    void mobileAds().initialize();
  } catch {
    // Ignore initialization errors
  }
}

export function FeedAdBanner({ style }: FeedAdBannerProps) {
  const [failed, setFailed] = useState(false);

  // In standard Expo Go, native Google Mobile Ads SDK is not included.
  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo';

  useEffect(() => {
    if (!isExpoGo) {
      ensureInitialized();
    }
  }, [isExpoGo]);

  if (isExpoGo || failed) {
    return null;
  }

  const adUnitId = getBannerAdUnitId(Platform.OS);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <ThemedText style={styles.badge}>ADVERTISEMENT</ThemedText>
        <Pressable
          accessibilityHint="Navigates to OutThere Pro subscription options"
          accessibilityLabel="Remove ads with OutThere Pro"
          accessibilityRole="button"
          onPress={() => router.push('/profile/subscription')}
          style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed]}
        >
          <ThemedText style={styles.upgradeText}>Hide ads with Pro ⚡</ThemedText>
        </Pressable>
      </View>
      <View style={styles.adWrapper}>
        <BannerAd
          onAdFailedToLoad={() => {
            setFailed(true);
          }}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          size={BannerAdSize.BANNER}
          unitId={adUnitId}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    gap: 8,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  badge: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#9CA3AF',
  },
  upgradeButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  upgradeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: '#000000',
  },
  adWrapper: {
    width: 320,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.55,
  },
});
