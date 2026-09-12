import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
export const PRO_ENTITLEMENT = 'outthere_pro';
export const PLANS = [
  { id: 'lifetime', type: 'LIFETIME', label: 'Lifetime', period: 'one-time payment' },
  { id: 'yearly', type: 'ANNUAL', label: 'Yearly', period: 'per year' },
  { id: 'monthly', type: 'MONTHLY', label: 'Monthly', period: 'per month' },
] as const;
export function hasPro(info: CustomerInfo | null) {
  return info?.entitlements.active[PRO_ENTITLEMENT]?.isActive === true;
}
export function availablePlans(offering: PurchasesOffering | null) {
  return PLANS.flatMap(plan => {
    const pkg = offering?.availablePackages.find(item => item.packageType === plan.type || item.identifier === plan.id);
    return pkg ? [{ ...plan, pkg }] : [];
  });
}
export interface BillingAdapter {
  unavailable: string | null;
  testStore: boolean;
  identify(userId: string): Promise<void>;
  customerInfo(): Promise<CustomerInfo>;
  offerings(): Promise<PurchasesOffering | null>;
  purchase(pkg: PurchasesPackage): Promise<CustomerInfo>;
  restore(): Promise<CustomerInfo>;
  paywall(offering: PurchasesOffering): Promise<string>;
  customerCenter(): Promise<void>;
  listen(callback: () => void): () => void;
}
export class BillingError extends Error {}
export function billingError(error: unknown): string | null {
  if (error instanceof BillingError) return error.message;
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  // RevenueCat PURCHASES_ERROR_CODE values; kept independent of native modules for web and tests.
  switch (code) {
    case '1': return null; // User cancellation is not an error.
    case '10': case '35': case '32': return 'Couldn’t connect to the store. Check your connection and try again.';
    case '20': return 'Your payment is pending approval. Pro will activate when the store confirms it.';
    case '6': return 'You already own this purchase. Try Restore purchases.';
    case '7': case '13': return 'This purchase belongs to another account. Sign in to your original OutThere account.';
    case '3': return 'Purchases aren’t allowed on this device. Check your store account settings.';
    case '5': case '11': case '23': return 'Plans are temporarily unavailable. Please try again later.';
    default: return 'We couldn’t complete that request. Please try again.';
  }
}
