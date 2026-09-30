import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '@/providers/auth-provider';
import { AccountForm } from './components/account-form';
import { WelcomeView } from './components/welcome-view';
import { useAccountAuth } from './use-account-auth';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const { session, recovery } = useAuth();
  const auth = useAccountAuth();

  if (session) return <Redirect href={recovery ? '/auth/reset-password' : '/'} />;

  if (auth.mode === 'welcome') {
    return (
      <WelcomeView
        busy={auth.busy}
        message={auth.message}
        isError={auth.isError}
        onGoogleSignIn={auth.signInWithGoogle}
        onEmailSignIn={() => auth.switchMode('login')}
      />
    );
  }

  return (
    <AccountForm
      mode={auth.mode}
      email={auth.email}
      setEmail={auth.setEmail}
      password={auth.password}
      setPassword={auth.setPassword}
      confirmation={auth.confirmation}
      setConfirmation={auth.setConfirmation}
      busy={auth.busy}
      message={auth.message}
      isError={auth.isError}
      canResend={auth.canResend}
      onSwitchMode={auth.switchMode}
      onSubmit={auth.submit}
    />
  );
}
