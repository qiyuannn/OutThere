import { createContext, useContext, useEffect, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth-provider';
import { BillingController } from '@/features/subscriptions/controller';
import { billingAdapter } from '@/features/subscriptions/sdk';
import { hasPro } from '@/features/subscriptions/model';
const controller = new BillingController(billingAdapter);
function useSubscriptionState() {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const { session, loading } = useAuth();
  const userId = loading ? null : session?.user.id ?? null;
  // Mask old customer data synchronously, before the identity effect runs.
  const matched = userId !== null && state.userId === userId;
  return { ...state, userId, customerInfo: matched ? state.customerInfo : null,
    offering: matched ? state.offering : null, ready: matched && state.ready,
    isPro: matched && hasPro(state.customerInfo), busy: !matched || state.busy,
    error: matched ? state.error : null, message: matched ? state.message : null,
    unavailable: billingAdapter.unavailable, testStore: billingAdapter.testStore,
    refresh: () => controller.refresh(), purchase: controller.purchase.bind(controller),
    restore: () => controller.restore(), presentPaywall: () => controller.presentPaywall(),
    customerCenter: () => controller.customerCenter() };
}
const Context = createContext<ReturnType<typeof useSubscriptionState> | null>(null);
export function SubscriptionProvider({ children }: PropsWithChildren) {
  const { session, loading } = useAuth();
  const userId = loading ? null : session?.user.id ?? null;
  const value = useSubscriptionState();
  useEffect(() => { controller.setUser(userId); return () => controller.setUser(null); }, [userId]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void controller.refresh(); });
    return () => subscription.remove();
  }, []);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSubscription() {
  const value = useContext(Context);
  if (!value) throw new Error('useSubscription requires SubscriptionProvider');
  return value;
}
