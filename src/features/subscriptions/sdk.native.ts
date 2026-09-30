import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { BillingError, PRO_ENTITLEMENT, type BillingAdapter } from './model';
import { selectBillingKey } from './config';
import { Config } from '../../constants/config.ts';

const config = selectBillingKey(
  Platform.OS,
  __DEV__,
  Config.revenueCat.mode,
  Config.revenueCat.testApiKey,
  Config.revenueCat.iosApiKey,
  Config.revenueCat.androidApiKey
);
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
  async manageSubscription(info) {
    const entitlement = info.entitlements.active[PRO_ENTITLEMENT];
    if (info.managementURL) {
      try { await Linking.openURL(info.managementURL); }
      catch { throw new BillingError('Couldn’t open your subscription settings. Please try again, or open subscriptions in the store where you purchased OutThere Pro.'); }
      return;
    }
    if (Platform.OS === 'ios' && entitlement?.store === 'APP_STORE') {
      await Purchases.showManageSubscriptions();
      return;
    }
    throw new BillingError('Subscription settings aren’t available for this purchase. Open subscriptions in the store where you purchased OutThere Pro.');
  },
  listen(callback) {
    Purchases.addCustomerInfoUpdateListener(callback);
    return () => Purchases.removeCustomerInfoUpdateListener(callback);
  },
};
