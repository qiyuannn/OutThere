import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { PRO_ENTITLEMENT, type BillingAdapter } from './model';
import { selectBillingKey } from './config';
const config = selectBillingKey(Platform.OS, __DEV__, process.env.EXPO_PUBLIC_REVENUECAT_MODE,
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY, process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY, process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY);
export const billingAdapter: BillingAdapter = {
  unavailable: config.error,
  testStore: config.testStore,
  async identify(userId) {
    if (!(await Purchases.isConfigured())) {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: config.key, appUserID: userId });
    } else if ((await Purchases.getAppUserID()) !== userId) {
      await Purchases.logIn(userId);
    }
  },
  customerInfo: () => Purchases.getCustomerInfo(),
  offerings: async () => (await Purchases.getOfferings()).current,
  purchase: async pkg => (await Purchases.purchasePackage(pkg)).customerInfo,
  restore: () => Purchases.restorePurchases(),
  paywall: offering => RevenueCatUI.presentPaywallIfNeeded({ offering, requiredEntitlementIdentifier: PRO_ENTITLEMENT, displayCloseButton: true }),
  customerCenter: () => RevenueCatUI.presentCustomerCenter(),
  listen(callback) {
    Purchases.addCustomerInfoUpdateListener(callback);
    return () => Purchases.removeCustomerInfoUpdateListener(callback);
  },
};
