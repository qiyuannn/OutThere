import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { exchangeAuthCode } from '@/lib/auth-callback';
import { authErrorMessage, extractAuthParams } from '@/lib/auth-validation';
import { useAuth } from '@/providers/auth-provider';

function firstParam(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

interface CallbackAuthParams {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  errorCode?: string;
}

function mergeAuthParams(target: CallbackAuthParams, source: CallbackAuthParams): void {
  if (!target.error && source.error) target.error = source.error;
  if (!target.errorCode && source.errorCode) target.errorCode = source.errorCode;
  if (!target.code && source.code) target.code = source.code;
  if (!target.accessToken && source.accessToken) target.accessToken = source.accessToken;
  if (!target.refreshToken && source.refreshToken) target.refreshToken = source.refreshToken;
}

async function resolveNativeLinkingParams(target: CallbackAuthParams): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const linkingUrl = ExpoLinking.getLinkingURL ? ExpoLinking.getLinkingURL() : null;
    if (linkingUrl) {
      mergeAuthParams(target, extractAuthParams(linkingUrl));
    }

    const hasAuth = target.code || target.accessToken || target.error || target.errorCode;
    if (hasAuth) return;

    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      mergeAuthParams(target, extractAuthParams(initialUrl));
    }
  } catch {
    // Ignore linking lookup failures
  }
}

export default function AuthCallback() {
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_code?: string | string[];
    error_description?: string | string[];
    access_token?: string | string[];
    refresh_token?: string | string[];
  }>();
  const { session, getAuthSession, setAuthSession, isConfigured } = useAuth();
  const [complete, setComplete] = useState(false);
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // When loaded inside an in-app browser popup on web, notify the opener
  const [isAuthSessionPopup] = useState(() => {
    if (Platform.OS === 'web') {
      try {
        const result = WebBrowser.maybeCompleteAuthSession();
        return result.type === 'success';
      } catch {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    if (isAuthSessionPopup) {
      // The redirect URL was successfully delivered to the opener window via postMessage.
      // The opener is completing the exchange and closing this popup; avoid duplicate code exchange.
      return;
    }

    let active = true;

    async function processCallback() {
      const authParams: CallbackAuthParams = {
        code: firstParam(params.code),
        accessToken: firstParam(params.access_token),
        refreshToken: firstParam(params.refresh_token),
        errorCode: firstParam(params.error_code) ?? firstParam(params.error),
        error: firstParam(params.error_description) ?? firstParam(params.error) ?? firstParam(params.error_code),
      };

      // Web fallback: inspect window.location.href (including hash fragment)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        mergeAuthParams(authParams, extractAuthParams(window.location.href));
      }

      await resolveNativeLinkingParams(authParams);

      if (!active) return;

      const { code, accessToken, refreshToken, error, errorCode } = authParams;

      // Handle explicit error parameter from OAuth provider
      if (error || errorCode) {
        setFailed(true);
        setErrorMessage(authErrorMessage({ code: errorCode ?? error, message: error ?? errorCode }));
        return;
      }

      // Handle OAuth PKCE authorization code
      if (code) {
        const verifyOrFallback = async (originalErr?: unknown) => {
          const { data: sessData } = await getAuthSession();
          if (!active) return;
          if (sessData?.session) {
            setComplete(true);
          } else {
            setFailed(true);
            setErrorMessage(authErrorMessage(originalErr));
          }
        };

        try {
          const result = await exchangeAuthCode(code);
          if (!active) return;
          if (result?.data?.session) {
            setComplete(true);
            return;
          }
          await verifyOrFallback(result?.error);
        } catch (err) {
          if (!active) return;
          await verifyOrFallback(err);
        }
        return;
      }

      // Handle implicit token exchange
      if (accessToken && refreshToken && isConfigured) {
        try {
          const { data, error: sessionError } = await setAuthSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!active) return;
          if (sessionError || !data?.session) {
            setFailed(true);
            setErrorMessage(authErrorMessage(sessionError));
          } else {
            setComplete(true);
          }
        } catch (err) {
          if (!active) return;
          setFailed(true);
          setErrorMessage(authErrorMessage(err));
        }
        return;
      }

      // If no code or tokens are present in callback parameters, verify active session
      if (session) {
        setComplete(true);
      } else {
        const { data: sessData } = await getAuthSession();
        if (!active) return;
        if (sessData?.session) {
          setComplete(true);
        } else {
          setFailed(true);
          setErrorMessage(
            !isConfigured
              ? 'Sign-in is not available yet. Please try again later.'
              : 'We couldn’t complete your sign in. The authorization may have expired or been cancelled. Please try signing in again.'
          );
        }
      }
    }

    void processCallback();

    return () => {
      active = false;
    };
  }, [
    isAuthSessionPopup,
    params.code,
    params.error,
    params.error_code,
    params.error_description,
    params.access_token,
    params.refresh_token,
    session,
    getAuthSession,
    isConfigured,
    setAuthSession,
  ]);

  if (!failed && (complete || session)) return <Redirect href="/" />;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
      {failed ? (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage || 'We couldn’t complete your sign in. The authorization may have expired or been cancelled. Please try signing in again.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/auth')}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>Back to sign in</Text>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator color="#000000" size="small" accessibilityLabel="Completing your sign in" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    gap: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#000000',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  outlineButton: {
    width: '100%',
    height: 36,
    borderColor: '#000000',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
});
