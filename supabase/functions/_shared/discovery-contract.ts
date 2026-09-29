export type SwipeChoice = 'pass' | 'save' | 'details';
export type SwipeMode = 'food' | 'activities';
export interface SwipeRequest {
  action: 'swipe';
  requestId: string;
  placeId: string;
  mode: SwipeMode;
  choice: SwipeChoice;
}
export interface SwipeAllowance {
  unlimited: boolean;
  limit: number;
  remaining: number | null;
  resetsAt: string | null;
  proExpiresAt: string | null;
  serverTime: string;
}
export interface SwipeResponse extends SwipeAllowance {
  accepted: boolean;
  duplicate: boolean;
}
export class DiscoveryError extends Error {
  status: number;
  constructor(message: string, status = 503) { super(message); this.status = status; }
}
export function parseDiscoveryRequest(value: unknown): SwipeRequest | { action: 'status' } {
  if (!value || typeof value !== 'object') throw new DiscoveryError('Invalid request.', 400);
  const v = value as Record<string, unknown>;
  // Reject identity / entitlement overrides rather than silently trusting them.
  const allowed = v.action === 'status' ? ['action'] : ['action', 'requestId', 'placeId', 'mode', 'choice'];
  if (Object.keys(v).some(key => !allowed.includes(key))) throw new DiscoveryError('Invalid request fields.', 400);
  if (v.action === 'status') return { action: 'status' };
  if (v.action !== 'swipe' || typeof v.requestId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.requestId)
    || typeof v.placeId !== 'string' || !v.placeId.trim() || v.placeId.length > 255
    || (v.mode !== 'food' && v.mode !== 'activities')
    || (v.choice !== 'pass' && v.choice !== 'save' && v.choice !== 'details')) {
    throw new DiscoveryError('Invalid swipe.', 400);
  }
  return { action: 'swipe', requestId: v.requestId, placeId: v.placeId, mode: v.mode, choice: v.choice };
}
export function parseSwipeResponse(value: unknown): SwipeResponse {
  if (!value || typeof value !== 'object') throw new Error('Could not read your swipe allowance. Please retry.');
  const v = value as SwipeResponse;
  const date = (s: unknown) => typeof s === 'string' && Number.isFinite(Date.parse(s));
  if (typeof v.accepted !== 'boolean' || typeof v.duplicate !== 'boolean' || typeof v.unlimited !== 'boolean'
    || v.limit !== 10 || !date(v.serverTime)
    || !(v.resetsAt === null || date(v.resetsAt)) || !(v.proExpiresAt === null || date(v.proExpiresAt))
    || (v.unlimited ? v.remaining !== null : !Number.isInteger(v.remaining) || v.remaining! < 0 || v.remaining! > 10)) {
    throw new Error('Could not read your swipe allowance. Please retry.');
  }
  return v;
}
