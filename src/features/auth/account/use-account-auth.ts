import { useEffect, useRef, useState } from 'react';

import { authErrorMessage, validateCredentials } from '@/lib/auth-validation';
import { getErrorCode } from '@/lib/errors';
import {
  isAuthConfigured,
  resendSignUpConfirmation,
  resetPasswordForEmail,
  signInWithPassword,
  signUpWithPassword,
} from '../service';
import { useOAuthSignIn } from './use-oauth-sign-in';

export type Mode = 'welcome' | 'login' | 'signup' | 'forgot';

export function useAccountAuth() {
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

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const { signInWithGoogle } = useOAuthSignIn(isMounted, setBusy, setMessage, setIsError, submitting);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword('');
    setConfirmation('');
    setMessage('');
    setCanResend(false);
    setIsError(false);
  }

  const executeAuthAction = async (address: string, resend: boolean) => {
    if (!isAuthConfigured()) return;
    if (resend) {
      const { error } = await resendSignUpConfirmation(address);
      if (error) throw error;
      if (isMounted.current) {
        setMessage('If your account needs confirmation, a new link is on its way. Check your inbox and spam folder.');
      }
      return;
    }

    if (mode === 'login') {
      const { error } = await signInWithPassword({ email: address, password });
      if (error) throw error;
      if (isMounted.current) setPassword('');
    } else if (mode === 'signup') {
      const { data, error } = await signUpWithPassword({
        email: address,
        password,
      });
      if (error) throw error;
      if (!isMounted.current) return;
      setPassword('');
      setConfirmation('');
      if (!data.session) {
        setCanResend(true);
        setMessage('Check your email to confirm your account. Open the link on this device, then return here to sign in. If you already have an account, try signing in.');
      }
    } else if (mode === 'forgot') {
      const { error } = await resetPasswordForEmail(address);
      if (error) throw error;
      if (isMounted.current) {
        setMessage('If an account exists for this email, you’ll receive a password-reset link. Open it on the same device and browser where you requested it.');
      }
    }
  };

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
    if (!isAuthConfigured()) {
      setIsError(true);
      setMessage('Sign-in isn’t available yet. Please try again later.');
      return;
    }

    submitting.current = true;
    setBusy(true);
    setMessage('');
    setIsError(false);

    try {
      await executeAuthAction(email.trim(), resend);
    } catch (error: unknown) {
      if (isMounted.current) {
        setIsError(true);
        setMessage(authErrorMessage(error));
        if (getErrorCode(error) === 'email_not_confirmed') setCanResend(true);
      }
    } finally {
      submitting.current = false;
      if (isMounted.current) setBusy(false);
    }
  }

  return {
    mode,
    email,
    setEmail,
    password,
    setPassword,
    confirmation,
    setConfirmation,
    busy,
    message,
    isError,
    canResend,
    switchMode,
    submit,
    signInWithGoogle,
  };
}
