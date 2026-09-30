import { createContext, useContext, useEffect, useState, useCallback, useMemo, type PropsWithChildren } from 'react';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  getAuthSession,
  isAuthConfigured,
  resendSignUpConfirmation,
  resetPasswordForEmail,
  setAuthSession,
  signInWithOAuth,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updateUserPassword,
  type OAuthSignInParams,
  type SetSessionTokens,
  type SignInCredentials,
  type SignOutOptions,
  type SignUpParams,
} from '@/features/auth/service';

export interface AuthState {
  session: Session | null;
  loading: boolean;
  recovery: boolean;
  finishRecovery: () => void;
  initializationError: boolean;
  retry: () => void;
  isConfigured: boolean;

  signInWithPassword: (credentials: SignInCredentials) => Promise<{
    data: { user: User | null; session: Session | null };
    error: AuthError | null;
  }>;
  signUpWithPassword: (params: SignUpParams) => Promise<{
    data: { user: User | null; session: Session | null };
    error: AuthError | null;
  }>;
  signOut: (options?: SignOutOptions) => Promise<{
    error: AuthError | null;
  }>;
  signInWithOAuth: (params: OAuthSignInParams) => Promise<{
    data: { provider: string; url: string | null };
    error: AuthError | null;
  }>;
  resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<{
    data: Record<string, never>;
    error: AuthError | null;
  }>;
  updateUserPassword: (password: string) => Promise<{
    data: { user: User | null };
    error: AuthError | null;
  }>;
  resendSignUpConfirmation: (email: string, options?: { emailRedirectTo?: string }) => Promise<{
    data: Record<string, never>;
    error: AuthError | null;
  }>;
  getAuthSession: () => Promise<{
    data: { session: Session | null };
    error: AuthError | null;
  }>;
  setAuthSession: (tokens: SetSessionTokens) => Promise<{
    data: { session: Session | null; user: User | null };
    error: AuthError | null;
  }>;
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

  const finishRecovery = useCallback(() => setRecovery(false), []);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const handleSignOut = useCallback(async (options?: SignOutOptions) => {
    const res = await signOut(options);
    if (!res.error) {
      setSession(null);
      setRecovery(false);
    }
    return res;
  }, []);

  const isConfigured = isAuthConfigured();

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      recovery,
      finishRecovery,
      initializationError,
      retry,
      isConfigured,
      signInWithPassword,
      signUpWithPassword,
      signOut: handleSignOut,
      signInWithOAuth,
      resetPasswordForEmail,
      updateUserPassword,
      resendSignUpConfirmation,
      getAuthSession,
      setAuthSession,
    }),
    [session, loading, recovery, finishRecovery, initializationError, retry, isConfigured, handleSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
