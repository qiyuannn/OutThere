import type { BillingAdapter } from './model';
const unsupported = async (): Promise<never> => { throw new Error('Use the native app for subscriptions.'); };
// Web/SSR must never import or configure a native purchases module.
export const billingAdapter: BillingAdapter = {
  unavailable: 'Subscriptions are available in the iOS and Android apps.', testStore: false,
  identify: unsupported, customerInfo: unsupported, offerings: unsupported, purchase: unsupported,
  restore: unsupported, paywall: unsupported, customerCenter: unsupported, listen: () => () => {},
};
