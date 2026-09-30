import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createDiscoveryHandler, revenueCatProUntil } from './handler.ts';
import { DiscoveryError, parseSwipeResponse } from '../_shared/discovery-contract.ts';

const url = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const revenueCatKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
const admin = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

Deno.serve(createDiscoveryHandler({
  async authenticate(token) {
    if (!admin) throw new DiscoveryError('Discovery is not configured yet.');
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id ?? null;
  },
  async proUntil(userId) {
    if (!revenueCatKey) throw new DiscoveryError('Membership verification is not configured yet.');
    // No client claims or stale entitlement cache can grant unlimited access.
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${revenueCatKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error('Discovery membership verification failed', { status: response.status });
      throw new DiscoveryError('Could not verify your membership. Please retry.');
    }
    return revenueCatProUntil(await response.json());
  },
  async transact(userId, proUntil, request) {
    const { data, error } = await admin!.rpc('discovery_allowance', {
      p_user_id: userId, p_pro_until: proUntil,
      ...(request.action === 'swipe' ? { p_request_id: request.requestId, p_place_id: request.placeId, p_mode: request.mode, p_choice: request.choice } : {}),
    });
    if (error) {
      console.error('Discovery transaction failed', { code: error.code });
      throw new DiscoveryError(error.code === '22023' ? 'This swipe request is invalid.' : 'Could not save your choice. Please retry.', error.code === '22023' ? 400 : 503);
    }
    return parseSwipeResponse(data);
  },
}));
