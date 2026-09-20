import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, processLock } from '@supabase/supabase-js';
import {
  authErrorMessage,
  extractAuthParams,
  createAuthCallbackManager,
  validateCredentials,
  validateNewPassword,
} from '../src/lib/auth-validation.ts';

test('handles rate limits without displaying internal error details', () => {
  assert.match(authErrorMessage({ code: 'over_request_rate_limit' }), /Wait/);
  assert.match(authErrorMessage({ error: 'over_request_rate_limit' }), /Wait/);
  assert.match(authErrorMessage(new Error('rate_limit exceeded')), /Wait/);
  assert.doesNotMatch(authErrorMessage(new Error('secret backend details')), /secret/);
});

test('handles access_denied gracefully as cancellation', () => {
  assert.match(authErrorMessage({ code: 'access_denied' }), /cancelled/i);
  assert.match(authErrorMessage(new Error('access_denied')), /cancelled/i);
  assert.match(authErrorMessage({ message: 'access_denied' }), /cancelled/i);
  assert.match(authErrorMessage({ error: 'access_denied' }), /cancelled/i);
  assert.match(authErrorMessage({ code: 'ERR_REQUEST_CANCELED' }), /cancelled/i);
  assert.match(authErrorMessage({ code: 'ERR_CANCELED' }), /cancelled/i);
  assert.match(authErrorMessage({ code: 1001 }), /cancelled/i);
  assert.match(authErrorMessage(new Error('The user canceled the authorization attempt.')), /cancelled/i);
  assert.match(authErrorMessage(new Error('User denied access')), /cancelled/i);
  assert.match(authErrorMessage({ error_description: 'User cancelled sign in' }), /cancelled/i);
});

test('extracts auth params from OAuth redirect URLs', () => {
  assert.deepEqual(extractAuthParams('outthere://auth/callback?code=test-code-123'), {
    code: 'test-code-123',
    accessToken: undefined,
    refreshToken: undefined,
    error: undefined,
    errorCode: undefined,
  });
  assert.deepEqual(extractAuthParams('outthere://auth/callback#access_token=tok123&refresh_token=ref456'), {
    code: undefined,
    accessToken: 'tok123',
    refreshToken: 'ref456',
    error: undefined,
    errorCode: undefined,
  });
  // Hash fragment containing route or query delimiter
  assert.deepEqual(extractAuthParams('outthere://auth/callback#/auth/callback?access_token=tok123&refresh_token=ref456'), {
    code: undefined,
    accessToken: 'tok123',
    refreshToken: 'ref456',
    error: undefined,
    errorCode: undefined,
  });
  assert.deepEqual(extractAuthParams('outthere://auth/callback?error=access_denied&error_description=Cancelled'), {
    code: undefined,
    accessToken: undefined,
    refreshToken: undefined,
    error: 'Cancelled',
    errorCode: 'access_denied',
  });
  // Relative URLs
  assert.deepEqual(extractAuthParams('/auth/callback?code=rel-code'), {
    code: 'rel-code',
    accessToken: undefined,
    refreshToken: undefined,
    error: undefined,
    errorCode: undefined,
  });
  // Error code in query without description
  assert.deepEqual(extractAuthParams('outthere://auth/callback?error_code=403'), {
    code: undefined,
    accessToken: undefined,
    refreshToken: undefined,
    error: '403',
    errorCode: '403',
  });
  // Error in hash fragment
  assert.deepEqual(extractAuthParams('outthere://auth/callback#error=unauthorized_client&error_description=Denied'), {
    code: undefined,
    accessToken: undefined,
    refreshToken: undefined,
    error: 'Denied',
    errorCode: 'unauthorized_client',
  });
  // Invalid and empty inputs
  assert.deepEqual(extractAuthParams(''), {});
  assert.deepEqual(extractAuthParams(null), {});
});

test('handleAuthCallbackUrl exchanges code, restores tokens, and rejects errors', async () => {
  let exchangeCalls = 0;
  let setSessionCalls = 0;
  const mockClient = {
    auth: {
      async exchangeCodeForSession(code) {
        exchangeCalls++;
        if (code === 'fail-code') return { data: null, error: new Error('Exchange failed') };
        return { data: { session: { user: { id: 'u1' }, code } }, error: null };
      },
      async setSession(tokens) {
        setSessionCalls++;
        if (tokens.access_token === 'bad') return { data: null, error: new Error('Bad token') };
        return { data: { session: { user: { id: 'u2' }, ...tokens } }, error: null };
      },
      async getSession() {
        return { data: { session: null }, error: null };
      },
    },
  };

  const manager = createAuthCallbackManager(() => mockClient);

  // 1. Success code exchange
  const res1 = await manager.handleAuthCallbackUrl('outthere://auth/callback?code=good-code');
  assert.equal(res1.session.user.id, 'u1');
  assert.equal(exchangeCalls, 1);

  // 2. Success token restore from hash
  const res2 = await manager.handleAuthCallbackUrl('outthere://auth/callback#access_token=tok&refresh_token=ref');
  assert.equal(res2.session.user.id, 'u2');
  assert.equal(setSessionCalls, 1);

  // 3. Error parameter in URL throws with code attached
  await assert.rejects(
    async () => manager.handleAuthCallbackUrl('outthere://auth/callback?error=access_denied&error_description=Cancelled'),
    (err) => {
      assert.equal(err.message, 'Cancelled');
      assert.equal(err.code, 'access_denied');
      assert.equal(authErrorMessage(err), 'Sign in was cancelled.');
      return true;
    }
  );

  // 4. Missing tokens/code in URL throws
  await assert.rejects(
    async () => manager.handleAuthCallbackUrl('outthere://auth/callback'),
    /No authorization code or session was provided/
  );

  // 5. Unconfigured client throws
  const unconfiguredManager = createAuthCallbackManager(() => null);
  await assert.rejects(
    async () => unconfiguredManager.handleAuthCallbackUrl('outthere://auth/callback?code=abc'),
    /Authentication is not configured/
  );
});

test('exchangeAuthCode memoizes code exchange preventing double-request failures on single-use PKCE codes', async () => {
  let calls = 0;
  const mockClient = {
    auth: {
      async exchangeCodeForSession(code) {
        calls++;
        await new Promise(r => setTimeout(r, 10));
        return { data: { session: { user: { id: 'user-memo' }, code } }, error: null };
      },
      async setSession() { return { data: null, error: null }; },
      async getSession() { return { data: { session: null }, error: null }; },
    },
  };

  const manager = createAuthCallbackManager(() => mockClient);

  // Concurrent calls (e.g. React StrictMode double-mount)
  const [r1, r2] = await Promise.all([
    manager.exchangeAuthCode('pkce-code-1'),
    manager.exchangeAuthCode('pkce-code-1'),
  ]);
  assert.equal(calls, 1);
  assert.equal(r1.data.session.code, 'pkce-code-1');
  assert.equal(r2.data.session.code, 'pkce-code-1');

  // Sequential call with the same code after resolution
  const r3 = await manager.exchangeAuthCode('pkce-code-1');
  assert.equal(calls, 1, 'Should return cached result without hitting Supabase again with a consumed code');
  assert.equal(r3.data.session.code, 'pkce-code-1');

  // Fresh code triggers new request
  const r4 = await manager.exchangeAuthCode('pkce-code-2');
  assert.equal(calls, 2);
  assert.equal(r4.data.session.code, 'pkce-code-2');
});

test('exchangeAuthCode does not memoize failed exchanges, permitting retries', async () => {
  let attempts = 0;
  const mockClient = {
    auth: {
      async exchangeCodeForSession(code) {
        attempts++;
        if (attempts === 1) return { data: null, error: new Error('Network timeout') };
        return { data: { session: { user: { id: 'retry-user' }, code } }, error: null };
      },
      async setSession() { return { data: null, error: null }; },
      async getSession() { return { data: { session: null }, error: null }; },
    },
  };

  const manager = createAuthCallbackManager(() => mockClient);

  // Attempt 1 fails
  const res1 = await manager.exchangeAuthCode('retry-code');
  assert.equal(attempts, 1);
  assert.equal(res1.error.message, 'Network timeout');

  // Attempt 2 with same code retries and succeeds because failure is not memoized
  const res2 = await manager.exchangeAuthCode('retry-code');
  assert.equal(attempts, 2, 'Should retry against Supabase rather than returning stale cached failure');
  assert.equal(res2.data.session.user.id, 'retry-user');

  // Attempt 3 with same code returns memoized success
  const res3 = await manager.exchangeAuthCode('retry-code');
  assert.equal(attempts, 2, 'Should now return memoized successful session without new request');
  assert.equal(res3.data.session.user.id, 'retry-user');
});

test('handleAuthCallbackUrl falls back to active session if code was already exchanged concurrently', async () => {
  const mockClient = {
    auth: {
      async exchangeCodeForSession() {
        return { data: null, error: new Error('code has already been used') };
      },
      async setSession() { return { data: null, error: null }; },
      async getSession() {
        return { data: { session: { user: { id: 'existing-active-user' } } }, error: null };
      },
    },
  };

  const manager = createAuthCallbackManager(() => mockClient);
  const result = await manager.handleAuthCallbackUrl('outthere://auth/callback?code=already-used-code');
  assert.equal(result.session.user.id, 'existing-active-user');
});

test('handleAuthCallbackUrl preserves original exchange error if getSession throws during fallback', async () => {
  const mockClient = {
    auth: {
      async exchangeCodeForSession() {
        return { data: null, error: new Error('AuthApiError: code has already been used') };
      },
      async setSession() { return { data: null, error: null }; },
      async getSession() {
        throw new Error('Storage or network failure in getSession');
      },
    },
  };

  const manager = createAuthCallbackManager(() => mockClient);
  await assert.rejects(
    async () => manager.handleAuthCallbackUrl('outthere://auth/callback?code=already-used-code'),
    /code has already been used/
  );
});




test('Google OAuth PKCE flow creates sign-in URL and exchanges callback code for session', async () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const calls = [];
  const events = [];
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'google-user' })).toString('base64url');
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`;
  const fetch = async (url, options) => {
    calls.push({ url: String(url), body: options?.body ? JSON.parse(options.body) : null });
    return new Response(JSON.stringify({ access_token: token, refresh_token: 'google-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: 'google-user', aud: 'authenticated', app_metadata: {}, user_metadata: {} } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const client = createClient('https://oauth-test.supabase.co', 'test-publishable', {
    auth: { storage, flowType: 'pkce', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch },
  });
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => events.push({ event, session }));
  const { data: oAuthData, error: oAuthErr } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'outthere://auth/callback', skipBrowserRedirect: true },
  });
  assert.equal(oAuthErr, null);
  assert.match(oAuthData.url, /provider=google/);
  assert.match(oAuthData.url, /redirect_to=outthere%3A%2F%2Fauth%2Fcallback/);
  assert.match(oAuthData.url, /code_challenge=/);

  assert.equal((await client.auth.exchangeCodeForSession('google-auth-code')).error, null);
  assert.ok(calls[0].body.code_verifier);
  assert.ok(events.some(e => e.event === 'SIGNED_IN'));
  subscription.unsubscribe();
});

test('validates email and password credentials accurately', () => {
  assert.equal(validateCredentials(''), 'Enter a valid email address.');
  assert.equal(validateCredentials('invalid-email'), 'Enter a valid email address.');
  assert.equal(validateCredentials('test@example.com'), null);
  assert.equal(validateCredentials('test@example.com', ''), 'Enter your password.');
  assert.equal(validateCredentials('test@example.com', 'short', 'short'), 'Use at least 8 characters for your password.');
  assert.equal(validateCredentials('test@example.com', 'validpass123', 'mismatch'), 'Your passwords don’t match.');
  assert.equal(validateCredentials('test@example.com', 'validpass123', 'validpass123'), null);
});

test('validates new passwords with minimum length and confirmation match', () => {
  assert.equal(validateNewPassword('1234567', '1234567'), 'Use at least 8 characters for your password.');
  assert.equal(validateNewPassword('12345678', '87654321'), 'Your passwords don’t match.');
  assert.equal(validateNewPassword('12345678', '12345678'), null);
});

test('maps email/password error codes to user-friendly messages', () => {
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /incorrect/i);
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /confirm your email/i);
  assert.match(authErrorMessage({ code: 'weak_password' }), /stronger password/i);
  assert.match(authErrorMessage({ code: 'same_password' }), /different/i);
  assert.match(authErrorMessage({ code: 'user_already_exists' }), /try signing in/i);
});

