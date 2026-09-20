export class DeleteAccountError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export interface DeleteAccountUser { id: string }
export interface DeleteAccountProfile { username: string; avatar_path: string | null }
export interface DeleteAccountDependencies {
  authenticate(token: string): Promise<DeleteAccountUser | null>;
  profile(userId: string): Promise<DeleteAccountProfile | null>;
  removeAvatar(path: string): Promise<void>;
  deleteUser(userId: string): Promise<void>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
});

export function createDeleteAccountHandler(deps: DeleteAccountDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    try {
      const authorization = request.headers.get('Authorization') ?? '';
      const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) throw new DeleteAccountError('Sign in again before deleting your account.', 401);
      const user = await deps.authenticate(token);
      if (!user) throw new DeleteAccountError('Sign in again before deleting your account.', 401);

      const length = Number(request.headers.get('content-length') ?? '0');
      if (Number.isFinite(length) && length > 4096) throw new DeleteAccountError('Invalid deletion request.');
      let body: unknown;
      try { body = await request.json(); } catch { throw new DeleteAccountError('Invalid deletion request.'); }
      const confirmation = body && typeof body === 'object' && 'confirmation' in body
        ? String((body as { confirmation: unknown }).confirmation).trim().toLocaleLowerCase()
        : '';
      const profile = await deps.profile(user.id);
      if (!profile || confirmation !== profile.username.toLocaleLowerCase()) {
        throw new DeleteAccountError('Type your username exactly to confirm account deletion.');
      }

      // Database rows cascade from auth.users in one authoritative operation.
      // Avatar cleanup follows with the already-loaded path; a cleanup failure
      // must not turn a completed account deletion into an apparent failure.
      await deps.deleteUser(user.id);
      if (profile.avatar_path) {
        try { await deps.removeAvatar(profile.avatar_path); } catch { /* orphan cleanup can be retried administratively */ }
      }
      return json({ deleted: true });
    } catch (error) {
      if (error instanceof DeleteAccountError) return json({ error: error.message }, error.status);
      return json({ error: 'Your account could not be deleted. Try again.' }, 500);
    }
  };
}
