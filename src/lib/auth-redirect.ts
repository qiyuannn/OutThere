import { Platform } from 'react-native';
import { DeepLinks } from '@/constants/storage';

export function authRedirectUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return DeepLinks.authCallbackUrl;
}

