export class ModerationError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export interface ModeratorUser { id: string; app_metadata?: Record<string, unknown> }
export interface ModerationDependencies {
  authenticate(token: string): Promise<ModeratorUser | null>;
  list(status: string, offset: number): Promise<unknown[]>;
  moderate(reportId: string, resolution: string, notes: string, moderatorId: string): Promise<void>;
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createModerationHandler(deps: ModerationDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers });
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    try {
      const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      const user = token ? await deps.authenticate(token) : null;
      if (!user) throw new ModerationError(401, 'Sign in again to continue.');
      if (user.app_metadata?.role !== 'moderator' && user.app_metadata?.is_moderator !== true) {
        throw new ModerationError(403, 'Moderator access is required.');
      }
      const raw = await request.text();
      if (raw.length > 5000) throw new ModerationError(400, 'Invalid moderation request.');
      let body: Record<string, unknown>;
      try { body = raw ? JSON.parse(raw) : {}; } catch { throw new ModerationError(400, 'Invalid moderation request.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ModerationError(400, 'Invalid moderation request.');

      if (body.action === 'list') {
        const status = typeof body.status === 'string' ? body.status : 'open';
        const offset = Number(body.offset ?? 0);
        if (!['open', 'dismissed', 'actioned'].includes(status) || !Number.isInteger(offset) || offset < 0 || offset > 5000) {
          throw new ModerationError(400, 'Invalid moderation queue.');
        }
        return reply({ reports: await deps.list(status, offset) });
      }
      if (body.action === 'resolve') {
        const reportId = String(body.report_id ?? '');
        const resolution = String(body.resolution ?? '');
        const notes = String(body.notes ?? '').trim();
        if (!UUID.test(reportId) || !['dismiss', 'remove_content', 'suspend_user'].includes(resolution) || notes.length > 2000) {
          throw new ModerationError(400, 'Invalid moderation decision.');
        }
        await deps.moderate(reportId, resolution, notes, user.id);
        return reply({ resolved: true });
      }
      throw new ModerationError(400, 'Unknown moderation action.');
    } catch (error) {
      if (error instanceof ModerationError) return reply({ error: error.message }, error.status);
      return reply({ error: 'The moderation request could not be completed.' }, 500);
    }
  };
}
