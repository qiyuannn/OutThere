import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { handleAuthCallbackUrl } from '@/lib/auth-callback';
import { authRedirectUrl } from '@/lib/auth-redirect';
import { authErrorMessage } from '@/lib/auth-validation';
import { getErrorCode } from '@/lib/errors';
import { isAuthConfigured, signInWithOAuth } from '../service';

export function useOAuthSignIn(
  isMounted: React.MutableRefObject<boolean>,
  setBusy: (busy: boolean) => void,
  setMessage: (msg: string) => void,
  setIsError: (err: boolean) => void,
  submitting: React.MutableRefObject<boolean>
) {
  const signInWithGoogle = async () => {
    if (submitting.current || !isAuthConfigured()) return;
    submitting.current = true;
    setBusy(true);
    setMessage('');
    setIsError(false);

    try {
      const redirectTo = authRedirectUrl();
      const { data, error: oAuthError } = await signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oAuthError) throw oAuthError;
      if (!data?.url) throw new Error('No authentication URL was returned.');

      const openBrowserSession = async (authUrl: string, targetRedirect: string) => {
        try {
          return await WebBrowser.openAuthSessionAsync(authUrl, targetRedirect);
        } catch (popupError: unknown) {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.assign(authUrl);
            return null;
          }
          throw popupError;
        }
      };

      const result = await openBrowserSession(data.url, redirectTo);
      if (result?.type === 'success' && result.url) {
        await handleAuthCallbackUrl(result.url);
      }
    } catch (error: unknown) {
      const msg = authErrorMessage(error);
      const code = getErrorCode(error);
      if (msg === 'Sign in was cancelled.' || code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED' || code === 'access_denied') {
        return;
      }
      if (isMounted.current) {
        setIsError(true);
        setMessage(msg);
      }
    } finally {
      submitting.current = false;
      if (isMounted.current) setBusy(false);
    }
  };

  return { signInWithGoogle };
}
