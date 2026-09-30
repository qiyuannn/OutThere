import type { AuthError, Provider, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authRedirectUrl } from '@/lib/auth-redirect';

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface SignUpParams {
  email: string;
  password: string;
  options?: {
    emailRedirectTo?: string;
    data?: Record<string, unknown>;
  };
}

export interface OAuthSignInParams {
  provider: Provider;
  options?: {
    redirectTo?: string;
    scopes?: string;
    queryParams?: Record<string, string>;
    skipBrowserRedirect?: boolean;
  };
}

export interface SignOutOptions {
  scope?: 'global' | 'local' | 'others';
}

export interface ResetPasswordParams {
  email: string;
  options?: {
    redirectTo?: string;
  };
}

export interface ResendConfirmationParams {
  email: string;
  options?: {
    emailRedirectTo?: string;
  };
}

export interface SetSessionTokens {
  access_token: string;
  refresh_token: string;
}

export type AuthClient = {
  auth: {
    signInWithPassword: (credentials: SignInCredentials) => Promise<{
      data: { user: User; session: Session } | { user: null; session: null };
      error: AuthError | null;
    }>;
    signUp: (params: { email: string; password: string; options?: { emailRedirectTo?: string; data?: Record<string, unknown> } }) => Promise<{
      data: { user: User | null; session: Session | null };
      error: AuthError | null;
    }>;
    signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<{
      error: AuthError | null;
    }>;
    signInWithOAuth: (params: { provider: Provider; options?: { redirectTo?: string; scopes?: string; queryParams?: Record<string, string>; skipBrowserRedirect?: boolean } }) => Promise<{
      data: { provider: Provider; url: string | null };
      error: AuthError | null;
    }>;
    resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<{
      data: Record<string, never>;
      error: AuthError | null;
    }>;
    updateUser: (attributes: { password?: string }) => Promise<{
      data: { user: User };
      error: AuthError | null;
    }>;
    resend: (params: { type: 'signup'; email: string; options?: { emailRedirectTo?: string } }) => Promise<{
      data: Record<string, never>;
      error: AuthError | null;
    }>;
    getSession: () => Promise<{
      data: { session: Session | null };
      error: AuthError | null;
    }>;
    setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{
      data: { session: Session | null; user: User | null };
      error: AuthError | null;
    }>;
  };
};

let defaultClientGetter: () => AuthClient | null = () => supabase as unknown as AuthClient | null;

export function setAuthClientGetter(getter: () => AuthClient | null): void {
  defaultClientGetter = getter;
}

function resolveClient(clientOverride?: AuthClient | null): AuthClient | null {
  if (clientOverride !== undefined) return clientOverride;
  return defaultClientGetter();
}

function unconfiguredError(): AuthError {
  return new Error('Authentication is not configured.') as unknown as AuthError;
}

export function isAuthConfigured(clientOverride?: AuthClient | null): boolean {
  return resolveClient(clientOverride) !== null;
}

export async function signInWithPassword(
  credentials: SignInCredentials,
  clientOverride?: AuthClient | null
): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { data: { user: null, session: null }, error: unconfiguredError() };
  return client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
}

export async function signUpWithPassword(
  params: SignUpParams,
  clientOverride?: AuthClient | null
): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { data: { user: null, session: null }, error: unconfiguredError() };
  return client.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: params.options?.emailRedirectTo ?? authRedirectUrl(),
      ...(params.options?.data ? { data: params.options.data } : {}),
    },
  });
}

export async function signOut(
  options?: SignOutOptions,
  clientOverride?: AuthClient | null
): Promise<{ error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { error: unconfiguredError() };
  return client.auth.signOut({ scope: options?.scope ?? 'local' });
}

export async function signInWithOAuth(
  params: OAuthSignInParams,
  clientOverride?: AuthClient | null
): Promise<{ data: { provider: string; url: string | null }; error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { data: { provider: params.provider, url: null }, error: unconfiguredError() };
  return client.auth.signInWithOAuth({
    provider: params.provider,
    options: {
      redirectTo: params.options?.redirectTo ?? authRedirectUrl(),
      skipBrowserRedirect: params.options?.skipBrowserRedirect ?? true,
      ...(params.options?.scopes ? { scopes: params.options.scopes } : {}),
      ...(params.options?.queryParams ? { queryParams: params.options.queryParams } : {}),
    },
  });
}

export async function resetPasswordForEmail(
  email: string,
  options?: { redirectTo?: string },
  clientOverride?: AuthClient | null
): Promise<{ data: Record<string, never>; error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { data: {}, error: unconfiguredError() };
  return client.auth.resetPasswordForEmail(email, {
    redirectTo: options?.redirectTo ?? authRedirectUrl(),
  });
}

export async function updateUserPassword(
  password: string,
  clientOverride?: AuthClient | null
): Promise<{ data: { user: User | null }; error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { data: { user: null }, error: unconfiguredError() };
  return client.auth.updateUser({ password });
}

export async function resendSignUpConfirmation(
  email: string,
  options?: { emailRedirectTo?: string },
  clientOverride?: AuthClient | null
): Promise<{ data: Record<string, never>; error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { data: {}, error: unconfiguredError() };
  return client.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: options?.emailRedirectTo ?? authRedirectUrl() },
  });
}

export async function getAuthSession(
  clientOverride?: AuthClient | null
): Promise<{ data: { session: Session | null }; error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { data: { session: null }, error: null };
  return client.auth.getSession();
}

export async function setAuthSession(
  tokens: SetSessionTokens,
  clientOverride?: AuthClient | null
): Promise<{ data: { session: Session | null; user: User | null }; error: AuthError | null }> {
  const client = resolveClient(clientOverride);
  if (!client) return { data: { session: null, user: null }, error: unconfiguredError() };
  return client.auth.setSession(tokens);
}
