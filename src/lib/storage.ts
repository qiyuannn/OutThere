export type StorageBucket = 'avatars' | 'post-photos' | (string & {});

export const DEFAULT_SIGNED_URL_LIFETIME_SECONDS = 3600;
export const DEFAULT_STORAGE_BUCKET: StorageBucket = 'avatars';

export type StorageClientOverride = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl: string } | null; error: unknown }>;
      createSignedUrls: (
        paths: string[],
        expiresIn: number
      ) => Promise<{
        data: { path: string | null; signedUrl: string | null; error?: unknown }[] | null;
        error: unknown;
      }>;
    };
  };
} | null;

let cachedClient: StorageClientOverride | undefined;

export function setDefaultStorageClient(client?: StorageClientOverride): void {
  cachedClient = client;
}

async function getActiveClient(override?: StorageClientOverride): Promise<StorageClientOverride> {
  if (override !== undefined) return override;
  if (cachedClient !== undefined) return cachedClient;
  try {
    const mod = await import('./supabase.ts');
    cachedClient = mod.supabase;
    return cachedClient;
  } catch {
    return null;
  }
}

/**
 * Resolves an array of storage paths into a dictionary of signed URLs.
 * Handles deduplication, empty path pruning, client fallback, and error suppression.
 */
export async function resolveSignedUrls(
  paths: (string | null | undefined)[],
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
  expiresIn: number = DEFAULT_SIGNED_URL_LIFETIME_SECONDS,
  client?: StorageClientOverride
): Promise<Record<string, string>> {
  const uniquePaths = Array.from(
    new Set(paths.map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean))
  );

  if (uniquePaths.length === 0) return {};

  const activeClient = await getActiveClient(client);
  if (!activeClient?.storage) return {};

  try {
    const { data, error } = await activeClient.storage
      .from(bucket)
      .createSignedUrls(uniquePaths, expiresIn);

    if (error || !data) return {};

    const urlRecord: Record<string, string> = {};
    for (const item of data) {
      if (item.path && item.signedUrl) {
        urlRecord[item.path] = item.signedUrl;
      }
    }
    return urlRecord;
  } catch {
    return {};
  }
}

/**
 * Resolves an array of storage paths into a Map of signed URLs.
 * Convenient helper for existing callers that use Map.get().
 */
export async function resolveSignedUrlMap(
  paths: (string | null | undefined)[],
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
  expiresIn: number = DEFAULT_SIGNED_URL_LIFETIME_SECONDS,
  client?: StorageClientOverride
): Promise<Map<string, string>> {
  const record = await resolveSignedUrls(paths, bucket, expiresIn, client);
  return new Map(Object.entries(record));
}

/**
 * Resolves a single storage path into a signed URL.
 * Returns null if path is invalid or if the request fails.
 */
export async function resolveSignedUrl(
  path: string | null | undefined,
  bucket: StorageBucket = DEFAULT_STORAGE_BUCKET,
  expiresIn: number = DEFAULT_SIGNED_URL_LIFETIME_SECONDS,
  client?: StorageClientOverride
): Promise<string | null> {
  if (!path || typeof path !== 'string' || !path.trim()) return null;
  const trimmed = path.trim();

  const activeClient = await getActiveClient(client);
  if (!activeClient?.storage) return null;

  try {
    const { data, error } = await activeClient.storage
      .from(bucket)
      .createSignedUrl(trimmed, expiresIn);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
