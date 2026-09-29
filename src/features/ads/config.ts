export const DEFAULT_AD_INTERVAL = 5;

// Official Google AdMob test App IDs for development
export const TEST_APP_ID_IOS = 'ca-app-pub-3940256099942544~1458783700';
export const TEST_APP_ID_ANDROID = 'ca-app-pub-3940256099942544~3347511713';

// Official Google AdMob test Banner Unit IDs for development
export const TEST_BANNER_ID_IOS = 'ca-app-pub-3940256099942544/2934735716';
export const TEST_BANNER_ID_ANDROID = 'ca-app-pub-3940256099942544/6300978111';

export function getBannerAdUnitId(platform: string = 'android'): string {
  if (platform === 'ios') {
    const custom = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS?.trim();
    return custom && custom.length > 0 ? custom : TEST_BANNER_ID_IOS;
  }
  const custom = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID?.trim();
  return custom && custom.length > 0 ? custom : TEST_BANNER_ID_ANDROID;
}

export function shouldShowFeedAd({
  index,
  isPro,
  scope,
  interval = DEFAULT_AD_INTERVAL,
}: {
  index: number;
  isPro: boolean;
  scope: string;
  interval?: number;
}): boolean {
  if (isPro) return false;
  if (scope !== 'explore') return false;
  if (interval <= 0) return false;
  return (index + 1) % interval === 0;
}

export function isAdEligible(isPro: boolean, scope: string): boolean {
  return !isPro && scope === 'explore';
}
