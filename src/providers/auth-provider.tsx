import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  recovery: boolean;
  finishRecovery: () => void;
  initializationError: boolean;
  retry: () => void;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [initializationError, setInitializationError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let active = true;
    let eventReceived = false;
    setLoading(true);
    setInitializationError(false);
    // Keep this callback synchronous; awaiting Supabase here can deadlock its auth lock.
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      eventReceived = true;
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
      setLoading(false);
    });
    client.auth.getSession().then(({ data, error }) => {
      if (!active || eventReceived) return;
      setSession(data.session);
      setInitializationError(!!error);
      setLoading(false);
    }).catch(() => {
      if (active && !eventReceived) { setInitializationError(true); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [attempt]);

  return <AuthContext.Provider value={{ session, loading, recovery, initializationError,
    finishRecovery: () => setRecovery(false), retry: () => setAttempt(value => value + 1) }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
