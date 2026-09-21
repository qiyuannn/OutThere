import { useEffect, useRef, useState } from 'react';
import { Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts } from '@/constants/theme';
import { handleAuthCallbackUrl } from '@/lib/auth-callback';
import { authRedirectUrl } from '@/lib/auth-redirect';
import { authErrorMessage, validateCredentials } from '@/lib/auth-validation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

WebBrowser.maybeCompleteAuthSession();

const backIcon = require('../../../../assets/images/navigation/back.svg');

type Mode = 'welcome' | 'create_account' | 'login' | 'signup' | 'forgot';

type OutlineButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

function OutlineButton({ disabled = false, label, onPress }: OutlineButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.outlineButton,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function Wordmark() {
  return (
    <View accessibilityRole="header" style={styles.wordmark}>
      <Text style={styles.wordmarkIntro}>Are you ready to discover</Text>
      <View style={styles.wordmarkRow}>
        <Text style={styles.wordmarkPrefix}>what’s</Text>
        <Text style={styles.wordmarkName}>OutThere</Text>
      </View>
    </View>
  );
}

function AuthHeader({ description, onPress }: { description: string; onPress: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={onPress}
          style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
        >
          <Image source={backIcon} style={styles.headerBackIcon} contentFit="contain" />
        </Pressable>
        <Text style={styles.headerBrand}>OutThere</Text>
      </View>
      <Text style={styles.headerDescription}>{description}</Text>
    </View>
  );
}

type AuthInputProps = {
  autoComplete: 'email' | 'current-password' | 'new-password';
  editable: boolean;
  keyboardType?: 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  password?: boolean;
  textContentType: 'emailAddress' | 'password' | 'newPassword';
  value: string;
};

function AuthInput({ label, password = false, ...props }: AuthInputProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={password}
        selectionColor="#000000"
        style={styles.field}
      />
    </View>
  );
}

interface CarouselSlide {
  title: string;
  description: string;
  highlight: string;
}

const CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    title: 'Discover Extraordinary Places',
    description: 'Find food, dining, and unique local activities tailored to where you are.',
    highlight: 'Curated places · Smart search · Real reviews',
  },
  {
    title: 'Rate & Track Your Footprint',
    description: 'Build your personal place collection, assign tiers, and watch your interactive map grow.',
    highlight: 'Interactive map · Custom rankings · Visit history',
  },
  {
    title: 'Share With Friends',
    description: 'Exchange trusted recommendations, share ratings, and see where your circle loves to go.',
    highlight: 'Friends-only feed · Social activity · Privacy controls',
  },
  {
    title: 'Unlock OutThere Pro',
    description: 'Get custom search radius, advanced filters, unlimited badges, and priority discovery tools.',
    highlight: 'Ready to begin your journey? Create your account now.',
  },
];

export default function AuthScreen() {
  const { session, recovery } = useAuth();
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const isMounted = useRef(true);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [canResend, setCanResend] = useState(false);

  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { width: windowWidth } = useWindowDimensions();
  const [carouselWidth, setCarouselWidth] = useState(0);
  const slideWidth = carouselWidth > 0 ? carouselWidth : windowWidth;

  function goToSlide(index: number) {
    const target = Math.max(0, Math.min(index, CAROUSEL_SLIDES.length - 1));
    setActiveSlide(target);
    carouselRef.current?.scrollTo({ x: target * slideWidth, animated: true });
  }

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  if (session) return <Redirect href={recovery ? '/auth/reset-password' : '/'} />;

  function switchMode(next: Mode) {
    fadeAnim.setValue(0);
    slideAnim.setValue(8);
    setMode(next);
    setActiveSlide(0);
    carouselRef.current?.scrollTo({ x: 0, animated: false });
    setPassword('');
    setConfirmation('');
    setMessage('');
    setCanResend(false);
    setIsError(false);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }

  async function submit(resend = false) {
    if (submitting.current) return;
    const invalid = validateCredentials(
      email,
      mode === 'forgot' || resend ? undefined : password,
      mode === 'signup' && !resend ? confirmation : undefined
    );
    if (invalid) {
      setIsError(true);
      setMessage(invalid);
      return;
    }
    if (!supabase) {
      setIsError(true);
      setMessage('Sign-in isn’t available yet. Please try again later.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setMessage('');
    setIsError(false);

    try {
      const address = email.trim();
      if (resend) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: address,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw error;
        if (isMounted.current) {
          setMessage('If your account needs confirmation, a new link is on its way. Check your inbox and spam folder.');
        }
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        if (isMounted.current) setPassword('');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: authRedirectUrl() },
        });
        if (error) throw error;
        if (isMounted.current) {
          setPassword('');
          setConfirmation('');
          if (!data.session) {
            setCanResend(true);
            setMessage('Check your email to confirm your account. Open the link on this device, then return here to sign in. If you already have an account, try signing in.');
          }
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(address, {
          redirectTo: authRedirectUrl(),
        });
        if (error) throw error;
        if (isMounted.current) {
          setMessage('If an account exists for this email, you’ll receive a password-reset link. Open it on the same device and browser where you requested it.');
        }
      }
    } catch (error: any) {
      if (isMounted.current) {
        setIsError(true);
        setMessage(authErrorMessage(error));
        if (typeof error === 'object' && error && 'code' in error && error.code === 'email_not_confirmed') {
          setCanResend(true);
        }
      }
    } finally {
      submitting.current = false;
      if (isMounted.current) setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (submitting.current || !supabase) return;
    submitting.current = true;
    setBusy(true);
    setMessage('');
    setIsError(false);

    try {
      const redirectTo = authRedirectUrl();
      const { data, error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (oAuthError) throw oAuthError;
      if (!data?.url) throw new Error('No authentication URL was returned.');

      if (Platform.OS === 'web') {
        let result;
        try {
          result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        } catch (popupError: any) {
          if (typeof window !== 'undefined') {
            window.location.assign(data.url);
            return;
          }
          throw popupError;
        }

        if (result.type === 'success' && result.url) {
          await handleAuthCallbackUrl(result.url);
        }
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success' && result.url) {
          await handleAuthCallbackUrl(result.url);
        }
      }
    } catch (error: any) {
      const msg = authErrorMessage(error);
      if (
        msg === 'Sign in was cancelled.' ||
        error?.code === 'ERR_REQUEST_CANCELED' ||
        error?.code === 'ERR_CANCELED' ||
        error?.code === 'access_denied' ||
        error?.message === 'access_denied'
      ) {
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
  }

  if (mode === 'welcome') {
    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <Animated.View style={[styles.welcome, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.wordmarkStage}>
            <Wordmark />
          </View>

          {!!message && (
            <Text accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.message}>
              {message}
            </Text>
          )}

          <View style={styles.welcomeActions}>
            <OutlineButton
              disabled={busy}
              label="Log In"
              onPress={() => switchMode('login')}
            />
            <OutlineButton
              disabled={busy}
              label="Create Account"
              onPress={() => switchMode('create_account')}
            />
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (mode === 'create_account') {
    const isLastSlide = activeSlide === CAROUSEL_SLIDES.length - 1;

    return (
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <AuthHeader description="Create Account" onPress={() => switchMode('welcome')} />
        <Animated.View style={[styles.carouselContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onLayout={(e) => {
              const w = Math.round(e.nativeEvent.layout.width);
              if (w > 0 && w !== carouselWidth) {
                setCarouselWidth(w);
                if (activeSlide > 0) {
                  carouselRef.current?.scrollTo({ x: activeSlide * w, animated: false });
                }
              }
            }}
            onMomentumScrollEnd={(e) => {
              const currentSlideWidth = slideWidth > 0 ? slideWidth : windowWidth;
              const nextIndex = Math.round(e.nativeEvent.contentOffset.x / currentSlideWidth);
              if (nextIndex >= 0 && nextIndex < CAROUSEL_SLIDES.length) {
                setActiveSlide(nextIndex);
              }
            }}
            style={styles.carouselScroll}
            contentContainerStyle={styles.carouselContent}
          >
            {CAROUSEL_SLIDES.map((slide, index) => (
              <View key={index} style={[styles.slide, { width: slideWidth }]}>
                <View style={styles.slideCard}>
                  <Text style={styles.slideTitle}>{slide.title}</Text>
                  <Text style={styles.slideDescription}>{slide.description}</Text>
                  <View style={styles.slideHighlightPill}>
                    <Text style={styles.slideHighlightText}>{slide.highlight}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.carouselFooter}>
            <View style={styles.dotsRow}>
              {CAROUSEL_SLIDES.map((_, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to slide ${i + 1}`}
                  onPress={() => goToSlide(i)}
                  style={[
                    styles.dot,
                    i === activeSlide && styles.activeDot,
                  ]}
                />
              ))}
            </View>

            {!!message && (
              <Text accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.message}>
                {message}
              </Text>
            )}

            <View style={styles.welcomeActions}>
              {isLastSlide ? (
                <>
                  <OutlineButton
                    disabled={busy || !supabase}
                    label={busy ? 'Please wait…' : 'Get started with Google'}
                    onPress={signInWithGoogle}
                  />
                  <OutlineButton
                    disabled={busy}
                    label="Get started with Email"
                    onPress={() => switchMode('signup')}
                  />
                </>
              ) : (
                <OutlineButton
                  label="Next"
                  onPress={() => goToSlide(activeSlide + 1)}
                />
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              hitSlop={10}
              onPress={() => switchMode('login')}
              style={({ pressed }) => [styles.bottomLink, pressed && styles.pressed]}
            >
              <Text style={styles.linkLabel}>
                Already have an account? Log In here.
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const description = mode === 'signup'
    ? 'Create Account'
    : mode === 'forgot'
      ? 'Reset your Password'
      : 'Log In';
  const backMode: Mode = mode === 'signup' ? 'create_account' : mode === 'forgot' ? 'login' : 'welcome';

  return (
    <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView edges={['top', 'right', 'bottom', 'left']} style={styles.safeArea}>
        <StatusBar style="dark" />
        <AuthHeader description={description} onPress={() => switchMode(backMode)} />
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formFields}>
              <AuthInput
                autoComplete="email"
                editable={!busy}
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                textContentType="emailAddress"
                value={email}
              />

              {mode !== 'forgot' && (
                <AuthInput
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  editable={!busy}
                  label="Password"
                  onChangeText={setPassword}
                  password
                  textContentType={mode === 'signup' ? 'newPassword' : 'password'}
                  value={password}
                />
              )}

              {mode === 'signup' && (
                <AuthInput
                  autoComplete="new-password"
                  editable={!busy}
                  label="Confirm password"
                  onChangeText={setConfirmation}
                  password
                  textContentType="newPassword"
                  value={confirmation}
                />
              )}

              {mode === 'login' && (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  hitSlop={10}
                  onPress={() => switchMode('forgot')}
                  style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}
                >
                  <Text style={styles.linkLabel}>Forgot password?</Text>
                </Pressable>
              )}

              {!!message && (
                <Text accessibilityRole={isError ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.message}>
                  {message}
                </Text>
              )}

              <OutlineButton
                disabled={busy || !supabase}
                label={
                  busy
                    ? 'Please wait…'
                    : mode === 'signup'
                      ? 'Create Account'
                      : mode === 'forgot'
                        ? 'Send Reset Link'
                        : 'Log In'
                }
                onPress={() => submit()}
              />

              {mode === 'login' && (
                <OutlineButton
                  disabled={busy || !supabase}
                  label={busy ? 'Please wait…' : 'Sign in with Google'}
                  onPress={signInWithGoogle}
                />
              )}

              {canResend && (
                <OutlineButton
                  disabled={busy || !supabase}
                  label="Resend Confirmation Email"
                  onPress={() => submit(true)}
                />
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={busy}
              hitSlop={10}
              onPress={() => switchMode(mode === 'login' ? 'create_account' : 'login')}
              style={({ pressed }) => [styles.bottomLink, pressed && styles.pressed]}
            >
              <Text style={styles.linkLabel}>
                {mode === 'login' ? 'Don’t have an account? Create account here.' : 'Already have an account? Log In here.'}
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  welcome: {
    flex: 1,
    gap: 10,
    padding: 20,
  },
  wordmarkStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    width: 280,
    minHeight: 84,
    justifyContent: 'center',
  },
  wordmarkIntro: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 14,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordmarkPrefix: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 14,
  },
  wordmarkName: {
    color: '#000000',
    fontFamily: Fonts.mono,
    fontSize: 42,
    fontWeight: '400',
    lineHeight: 48,
  },
  welcomeActions: {
    gap: 12,
  },
  outlineButton: {
    width: '100%',
    minHeight: 52,
    borderColor: '#000000',
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  buttonLabel: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.55,
  },
  disabled: {
    opacity: 0.45,
  },
  header: {
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerRow: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackButton: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: 24,
    height: 24,
  },
  headerBackIcon: {
    width: 24,
    height: 24,
  },
  headerBrand: {
    color: '#000000',
    fontFamily: Fonts.mono,
    fontSize: 20,
    fontWeight: '400',
    lineHeight: 24,
    textAlign: 'center',
  },
  headerDescription: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
  },
  formContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: 24,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
  },
  formFields: {
    gap: 16,
  },
  fieldGroup: {
    gap: 10,
  },
  fieldLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  field: {
    width: '100%',
    minHeight: 52,
    borderColor: '#D1D5DB',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    color: '#000000',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  forgotButton: {
    alignSelf: 'flex-end',
  },
  linkLabel: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
  message: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
  },
  bottomLink: {
    alignSelf: 'center',
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  carouselScroll: {
    flex: 1,
  },
  carouselContent: {
    flexGrow: 1,
  },
  slide: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  slideCard: {
    width: '100%',
    maxWidth: 340,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  slideTitle: {
    color: '#000000',
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  slideDescription: {
    color: '#637068',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  slideHighlightPill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  slideHighlightText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  carouselFooter: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  activeDot: {
    width: 24,
    backgroundColor: '#000000',
  },
});
