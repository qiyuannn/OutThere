import { Config } from '@/constants/config';
import { selectWebBillingKey } from './config';
import { createWebBillingAdapter } from './web-adapter';

// Load the SDK's browser implementation only after a signed-in client identifies.
// Server rendering never imports or configures Purchases.
export const billingAdapter = createWebBillingAdapter(
  selectWebBillingKey(Config.revenueCat.mode, Config.revenueCat.testApiKey, Config.revenueCat.webApiKey),
  async () => (await import('react-native-purchases')).default,
);
