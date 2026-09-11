import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, processLock } from '@supabase/supabase-js';
import { validateCredentials, validateNewPassword, authErrorMessage } from '../src/lib/auth-validation.ts';

test('rejects malformed email and mismatched signup passwords without imposing signup rules on login', () => {
  assert.ok(validateCredentials('not-an-email', 'password123'));
  assert.equal(validateCredentials(' person@example.com ', 'old'), null);
  assert.ok(validateCredentials('person@example.com', 'password123', 'different'));
  assert.ok(validateNewPassword('short', 'short'));
  assert.equal(validateNewPassword('long password 123', 'long password 123'), null);
});

test('handles confirmation and rate limits without displaying internal error details', () => {
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /Confirm your email/);
  assert.match(authErrorMessage({ code: 'over_email_send_rate_limit' }), /Wait/);
  assert.doesNotMatch(authErrorMessage(new Error('secret backend details')), /secret/);
});

test('Supabase sign-in persists a session across clients and local sign-out clears it', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-123' })).toString('base64url');
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url: String(url), method: options?.method });
    if (String(url).includes('/logout')) return new Response(null, { status: 204 });
    return new Response(JSON.stringify({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: 'user-123', email: 'test@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const options = { auth: { storage, flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, lock: processLock }, global: { fetch } };
  const first = createClient('https://auth-test.supabase.co', 'test-publishable', options);
  assert.equal((await first.auth.signInWithPassword({ email: 'test@example.com', password: 'test password' })).error, null);
  const second = createClient('https://auth-test.supabase.co', 'test-publishable', options);
  assert.equal((await second.auth.getSession()).data.session.user.id, 'user-123');
  assert.equal((await second.auth.signOut({ scope: 'local' })).error, null);
  assert.equal((await second.auth.getSession()).data.session, null);
  assert.ok(requests.some(request => request.url.includes('/logout?scope=local')));
  assert.equal(values.has('sb-auth-test-auth-token'), false);
});

test('PKCE password reset sends the callback and emits PASSWORD_RECOVERY after code exchange', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const calls = [];
  const events = [];
  const fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    if (new URL(url).pathname.endsWith('/recover')) return new Response('{}', { status: 200 });
    return new Response(JSON.stringify({ access_token: 'test-access', refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: 'recovery-user', aud: 'authenticated', app_metadata: {}, user_metadata: {} } }), { status: 200 });
  };
  const client = createClient('https://recovery-test.supabase.co', 'test-publishable', {
    auth: { storage, flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
  });
  const { data: { subscription } } = client.auth.onAuthStateChange(event => events.push(event));
  assert.equal((await client.auth.resetPasswordForEmail('test@example.com', { redirectTo: 'outthere://auth/callback' })).error, null);
  assert.ok(calls[0].body.code_challenge);
  assert.match(calls[0].url, /redirect_to=outthere%3A%2F%2Fauth%2Fcallback/);
  assert.equal((await client.auth.exchangeCodeForSession('one-use-code')).error, null);
  assert.ok(calls[1].body.code_verifier);
  assert.ok(events.includes('PASSWORD_RECOVERY'));
  subscription.unsubscribe();
});
