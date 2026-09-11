import { Platform } from 'react-native';

export function authRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return 'outthere://auth/callback';
}
