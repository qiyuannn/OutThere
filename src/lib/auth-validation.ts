export function validateCredentials(email: string, password?: string, confirmation?: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  if (password !== undefined && !password) return 'Enter your password.';
  if (confirmation !== undefined) return validateNewPassword(password ?? '', confirmation);
  return null;
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  if (password !== confirmation) return 'Your passwords don’t match.';
  return null;
}

export interface ExtractedAuthParams {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  errorCode?: string;
}

export function extractAuthParams(urlStr: string): ExtractedAuthParams {
  try {
    if (!urlStr || typeof urlStr !== 'string') return {};
    const parsed = new URL(urlStr, 'https://localhost');
    const query = parsed.searchParams;
    let hashParams: URLSearchParams | undefined;
    if (parsed.hash) {
      let hashString = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
      if (hashString.includes('?')) {
        hashString = hashString.slice(hashString.indexOf('?') + 1);
      }
      hashParams = new URLSearchParams(hashString);
    }

    const code = query.get('code') ?? hashParams?.get('code') ?? undefined;
    const accessToken = hashParams?.get('access_token') ?? query.get('access_token') ?? undefined;
    const refreshToken = hashParams?.get('refresh_token') ?? query.get('refresh_token') ?? undefined;
    const errorDesc = query.get('error_description') ?? hashParams?.get('error_description');
    const err = query.get('error') ?? hashParams?.get('error');
    const errCode = query.get('error_code') ?? hashParams?.get('error_code');
    const error = errorDesc ?? err ?? errCode ?? undefined;
    const errorCode = errCode ?? err ?? undefined;

    return {
      code,
      accessToken,
      refreshToken,
      error,
      errorCode,
    };
  } catch {
    return {};
  }
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as any).code) : '';
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as any).message) : '';
  const err = typeof error === 'object' && error !== null && 'error' in error ? String((error as any).error) : '';
  const errorDescription = typeof error === 'object' && error !== null && 'error_description' in error ? String((error as any).error_description) : '';
  const lowerMsg = message.toLowerCase();
  const lowerCode = code.toLowerCase();
  const lowerErr = err.toLowerCase();
  const lowerDesc = errorDescription.toLowerCase();

  switch (code) {
    case 'invalid_credentials': return 'The email or password is incorrect.';
    case 'email_not_confirmed': return 'Confirm your email before signing in. You can resend the confirmation below.';
    case 'weak_password': return 'Choose a stronger password. Use at least 8 characters with a mix of letters, numbers, and symbols.';
    case 'same_password': return 'Choose a password different from your current one.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Too many attempts. Wait a moment and try again.';
    case 'user_already_exists': return 'Try signing in or resetting your password for this email.';
  }

  if (
    code === 'over_request_rate_limit' ||
    err === 'over_request_rate_limit' ||
    lowerMsg.includes('rate_limit') ||
    lowerMsg.includes('too many') ||
    lowerDesc.includes('rate_limit') ||
    lowerDesc.includes('too many')
  ) {
    return 'Too many attempts. Wait a moment and try again.';
  }

  if (
    code === 'access_denied' ||
    err === 'access_denied' ||
    code === 'ERR_REQUEST_CANCELED' ||
    code === 'ERR_CANCELED' ||
    code === '1001' ||
    lowerCode.includes('cancel') ||
    lowerMsg.includes('cancel') ||
    lowerMsg.includes('denied') ||
    lowerErr.includes('cancel') ||
    lowerErr.includes('denied') ||
    lowerDesc.includes('cancel') ||
    lowerDesc.includes('denied')
  ) {
    return 'Sign in was cancelled.';
  }

  return 'We couldn’t complete that request. Check your connection and try again.';
}

export interface AuthCallbackClient {
  auth: {
    exchangeCodeForSession: (code: string) => Promise<{ data: any; error: any }>;
    setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{ data: any; error: any }>;
    getSession: () => Promise<{ data: { session: any } | null; error: any }>;
  };
}

export function createAuthCallbackManager(getClient: () => AuthCallbackClient | null) {
  let lastCode: string | undefined;
  let pendingExchange: Promise<any> | undefined;
  let lastResult: any = undefined;

  function _resetExchangeState() {
    lastCode = undefined;
    pendingExchange = undefined;
    lastResult = undefined;
  }

  function exchangeAuthCode(code: string, clientOverride?: AuthCallbackClient | null) {
    const client = clientOverride !== undefined ? clientOverride : getClient();
    if (!client) throw new Error('Authentication is not configured.');
    if (code === lastCode) {
      if (pendingExchange) return pendingExchange;
      if (lastResult) return Promise.resolve(lastResult);
    }
    lastCode = code;
    lastResult = undefined;
    pendingExchange = client.auth.exchangeCodeForSession(code)
      .then((result: any) => {
        if (result?.data?.session) {
          lastResult = result;
        } else {
          lastCode = undefined;
          lastResult = undefined;
        }
        return result;
      })
      .catch((err: any) => {
        lastCode = undefined;
        lastResult = undefined;
        throw err;
      })
      .finally(() => {
        pendingExchange = undefined;
      });
    return pendingExchange;
  }

  async function handleAuthCallbackUrl(urlStr: string, clientOverride?: AuthCallbackClient | null) {
    const client = clientOverride !== undefined ? clientOverride : getClient();
    if (!client) throw new Error('Authentication is not configured.');
    const { code, accessToken, refreshToken, error, errorCode } = extractAuthParams(urlStr);
    if (error || errorCode) {
      const err = new Error(error ?? errorCode);
      (err as any).code = errorCode ?? error;
      throw err;
    }
    if (code) {
      const result = await exchangeAuthCode(code, client);
      if (result.error) {
        try {
          const { data: currentSession } = await client.auth.getSession();
          if (currentSession?.session) {
            return currentSession;
          }
        } catch {
          // Ignore getSession error and throw exchange error below
        }
        throw result.error;
      }
      return result.data;
    }
    if (accessToken && refreshToken) {
      const result = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (result.error) throw result.error;
      return result.data;
    }
    throw new Error('No authorization code or session was provided in callback URL.');
  }

  return {
    exchangeAuthCode,
    handleAuthCallbackUrl,
    _resetExchangeState,
  };
}
