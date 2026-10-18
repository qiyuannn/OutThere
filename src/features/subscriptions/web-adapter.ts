import type Purchases from 'react-native-purchases';
import { BillingError, type BillingAdapter } from './model.ts';

type StatusSDK = Pick<typeof Purchases, 'isConfigured' | 'configure' | 'getAppUserID' | 'logIn' | 'getCustomerInfo'>;

export function createWebBillingAdapter(
  config: { key: string; testStore: boolean; error: string | null },
  loadSDK: () => Promise<StatusSDK>,
): BillingAdapter {
  const unsupported = async (): Promise<never> => {
    throw new BillingError('Use the iOS or Android app to purchase, restore, or manage your subscription.');
  };
  return {
    unavailable: config.error,
    testStore: config.testStore,
    readOnly: true,
    async identify(userId) {
      if (config.error) throw new BillingError(config.error);
      const sdk = await loadSDK();
      if (!(await sdk.isConfigured())) {
        sdk.configure({ apiKey: config.key, appUserID: userId });
      } else if ((await sdk.getAppUserID()) !== userId) {
        await sdk.logIn(userId);
      }
    },
    async customerInfo() {
      try { return await (await loadSDK()).getCustomerInfo(); }
      catch { throw new BillingError('Couldn’t load your membership status. Check your connection and try again.'); }
    },
    offerings: async () => null,
    purchase: unsupported,
    restore: unsupported,
    paywall: unsupported,
    customerCenter: unsupported,
    manageSubscription: unsupported,
    listen: () => () => {},
  };
}
