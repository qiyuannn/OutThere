import { type PropsWithChildren, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export function BackendProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const client = supabase;
    if (!client || Platform.OS === 'web') return;
    const update = (state: string) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => { subscription.remove(); client.auth.stopAutoRefresh(); };
  }, []);
  return children;
}
