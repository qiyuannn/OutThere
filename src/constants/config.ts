/**
 * Application environment configuration and public endpoints.
 * Dynamic getters for environment variables ensure tests and runtime changes work reliably.
 */

export const Config = {
  appScheme: 'outthere',
  appBundleId: 'com.outthere.app',

  supabase: {
    get url(): string | undefined {
      return process.env.EXPO_PUBLIC_SUPABASE_URL;
    },
    get publishableKey(): string | undefined {
      return process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    },
  },

  support: {
    get contactUrl(): string {
      return process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://outthere.app/support';
    },
    get termsUrl(): string {
      return process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://outthere.app/terms';
    },
    get privacyUrl(): string {
      return process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://outthere.app/privacy';
    },
  },

  revenueCat: {
    get mode(): string | undefined {
      return process.env.EXPO_PUBLIC_REVENUECAT_MODE;
    },
    get testApiKey(): string | undefined {
      return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
    },
    get iosApiKey(): string | undefined {
      return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    },
    get androidApiKey(): string | undefined {
      return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
    },
  },

  ads: {
    testAppIdIos: 'ca-app-pub-3940256099942544~1458783700',
    testAppIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
    testBannerIdIos: 'ca-app-pub-3940256099942544/2934735716',
    testBannerIdAndroid: 'ca-app-pub-3940256099942544/6300978111',

    get customBannerIdIos(): string | undefined {
      return process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_IOS?.trim();
    },
    get customBannerIdAndroid(): string | undefined {
      return process.env.EXPO_PUBLIC_ADMOB_BANNER_ID_ANDROID?.trim();
    },
  },
} as const;
