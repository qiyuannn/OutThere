import { supabase } from './supabase';
import {
  createAuthCallbackManager,
  extractAuthParams,
  type ExtractedAuthParams,
  type AuthCallbackClient,
} from './auth-validation';

export { extractAuthParams, type ExtractedAuthParams, type AuthCallbackClient, createAuthCallbackManager };

const defaultManager = createAuthCallbackManager(() => supabase);

export const exchangeAuthCode = defaultManager.exchangeAuthCode;
export const handleAuthCallbackUrl = defaultManager.handleAuthCallbackUrl;
export const _resetExchangeState = defaultManager._resetExchangeState;


