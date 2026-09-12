import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { BillingError, billingError, hasPro, type BillingAdapter } from './model.ts';
export interface BillingState {
  userId: string | null;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  ready: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
}
const empty = (userId: string | null): BillingState => ({ userId, customerInfo: null, offering: null, ready: false, busy: false, error: null, message: null });

// Serializes SDK identity changes and store operations. Results from an old auth
// session are discarded, including when a purchase finishes after sign-out.
export class BillingController {
  state = empty(null);
  private revision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private stopListening?: () => void;
  private refreshing = false;
  private observers = new Set<() => void>();
  private adapter: BillingAdapter;
  constructor(adapter: BillingAdapter) { this.adapter = adapter; }
  subscribe = (callback: () => void) => { this.observers.add(callback); return () => { this.observers.delete(callback); }; };
  snapshot = () => this.state;
  private update(patch: Partial<BillingState>) { this.state = { ...this.state, ...patch }; this.observers.forEach(fn => fn()); }
  setUser(userId: string | null) {
    this.revision += 1;
    this.stopListening?.(); this.stopListening = undefined;
    this.state = empty(userId); this.update({});
    if (userId && !this.adapter.unavailable) void this.refresh();
  }
  private async run(task: (current: () => boolean) => Promise<void>) {
    if (!this.state.userId || this.adapter.unavailable || this.state.busy) return;
    const userId = this.state.userId, revision = this.revision;
    const current = () => revision === this.revision;
    this.update({ busy: true, error: null, message: null });
    const result = this.queue.then(async () => {
      if (!current()) return;
      try {
        await this.adapter.identify(userId);
        if (!current()) return;
        if (!this.stopListening) {
          this.stopListening = this.adapter.listen(() => {
            // Do not trust an event from a previous identity. Read the current
            // customer's info through the same serialized operation queue.
            if (!this.state.busy && !this.refreshing) void this.refresh(false);
          });
        }
        await task(current);
      } catch (error) { if (current()) this.update({ error: billingError(error) }); }
      finally { if (current()) this.update({ busy: false }); }
    });
    this.queue = result.catch(() => {});
    await result;
  }
  async refresh(includeOfferings = true) {
    await this.run(async current => {
      this.refreshing = true;
      try {
        const customerInfo = await this.adapter.customerInfo();
        if (!current()) return;
        this.update({ customerInfo, ready: true });
        if (includeOfferings) {
          const offering = await this.adapter.offerings();
          if (current()) this.update({ offering });
        }
      } finally { this.refreshing = false; }
    });
  }
  async purchase(pkg: PurchasesPackage) {
    if (!this.state.ready || hasPro(this.state.customerInfo)) return;
    await this.run(async current => {
      if (!this.state.offering?.availablePackages.includes(pkg)) throw new BillingError('Plans changed. Refresh them before purchasing.');
      const info = await this.adapter.purchase(pkg);
      if (current()) this.acceptPurchase(info, false);
    });
  }
  private acceptPurchase(customerInfo: CustomerInfo, restored: boolean) {
    this.update({ customerInfo, ready: true, message: hasPro(customerInfo) ? (restored ? 'Your OutThere Pro access is restored.' : 'OutThere Pro is active.') : (restored ? 'No active OutThere Pro purchase was found for this account.' : 'The store completed your purchase, but Pro isn’t active yet. Refresh your status before trying another purchase.') });
  }
  async restore() {
    await this.run(async current => { const info = await this.adapter.restore(); if (current()) this.acceptPurchase(info, true); });
  }
  async presentPaywall() {
    if (!this.state.ready) return;
    await this.run(async current => {
      const offering = this.state.offering;
      if (!offering?.availablePackages.length) throw new BillingError('No plans are available right now. Please try again later.');
      const result = await this.adapter.paywall(offering);
      if (!current()) return;
      if (result === 'ERROR') throw new BillingError('The paywall couldn’t open or complete the purchase. Please try again.');
      // A presentation result is not proof of entitlement. Always read CustomerInfo.
      const info = await this.adapter.customerInfo();
      if (!current()) return;
      if (result === 'PURCHASED' || result === 'RESTORED') this.acceptPurchase(info, result === 'RESTORED');
      else this.update({ customerInfo: info });
    });
  }
  async customerCenter() {
    await this.run(async current => {
      await this.adapter.customerCenter();
      if (!current()) return;
      const customerInfo = await this.adapter.customerInfo();
      if (current()) this.update({ customerInfo, ready: true });
    });
  }
}
