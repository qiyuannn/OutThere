import { DiscoveryError, parseDiscoveryRequest, type SwipeRequest, type SwipeResponse } from '../_shared/discovery-contract.ts';

// null means free, 'infinity' is a lifetime entitlement, otherwise an ISO expiry.
export function revenueCatProUntil(value: unknown, now = Date.now()): string | null {
  const data = value as { subscriber?: { entitlements?: Record<string, {
    expires_date?: string | null; grace_period_expires_date?: string | null;
  }> } } | null;
  const entitlements = data?.subscriber?.entitlements;
  if (!entitlements || typeof entitlements !== 'object' || Array.isArray(entitlements)) {
    throw new DiscoveryError('Could not verify your membership. Please retry.');
  }
  const pro = entitlements.outthere_pro;
  if (pro === undefined) return null;
  if (!pro || typeof pro !== 'object') throw new DiscoveryError('Could not verify your membership. Please retry.');
  if (pro.expires_date === null) return 'infinity';
  const expires = typeof pro.expires_date === 'string' ? Date.parse(pro.expires_date) : NaN;
  const grace = pro.grace_period_expires_date == null ? 0 : Date.parse(pro.grace_period_expires_date);
  if (!Number.isFinite(expires) || !Number.isFinite(grace)) throw new DiscoveryError('Could not verify your membership. Please retry.');
  const until = Math.max(expires, grace);
  return until > now ? new Date(until).toISOString() : null;
}

export interface DiscoveryDependencies {
  authenticate(token: string): Promise<string | null>;
  proUntil(userId: string): Promise<string | null>;
  transact(userId: string, proUntil: string | null, request: SwipeRequest | { action: 'status' }): Promise<SwipeResponse>;
}
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
export function createDiscoveryHandler(deps: DiscoveryDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (req.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    try {
      const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) throw new DiscoveryError('Sign in to use Discovery.', 401);
      const userId = await deps.authenticate(token);
      if (!userId) throw new DiscoveryError('Sign in to use Discovery.', 401);
      const raw = await req.text();
      if (raw.length > 4096) throw new DiscoveryError('Request is too large.', 400);
      let body: unknown;
      try { body = JSON.parse(raw); } catch { throw new DiscoveryError('Invalid JSON.', 400); }
      const request = parseDiscoveryRequest(body);
      const proUntil = await deps.proUntil(userId);
      return reply(await deps.transact(userId, proUntil, request));
    } catch (error) {
      return reply({ error: error instanceof DiscoveryError ? error.message : 'Could not check your swipes. Please retry.' },
        error instanceof DiscoveryError ? error.status : 503);
    }
  };
}
