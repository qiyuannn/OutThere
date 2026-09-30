import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSignedUrl,
  resolveSignedUrls,
  resolveSignedUrlMap,
  DEFAULT_SIGNED_URL_LIFETIME_SECONDS,
  DEFAULT_STORAGE_BUCKET,
} from '../src/lib/storage.ts';

test('resolveSignedUrl returns null for invalid or empty paths without client calls', async () => {
  const mockClient = {
    storage: {
      from: () => ({
        createSignedUrl: () => assert.fail('Should not be called'),
      }),
    },
  };

  assert.equal(await resolveSignedUrl(null, 'avatars', 3600, mockClient), null);
  assert.equal(await resolveSignedUrl(undefined, 'avatars', 3600, mockClient), null);
  assert.equal(await resolveSignedUrl('', 'avatars', 3600, mockClient), null);
  assert.equal(await resolveSignedUrl('   ', 'avatars', 3600, mockClient), null);
});

test('resolveSignedUrl handles unconfigured client gracefully', async () => {
  assert.equal(await resolveSignedUrl('avatar.jpg', 'avatars', 3600, null), null);
});

test('resolveSignedUrl successfully signs a valid path', async () => {
  const calls = [];
  const mockClient = {
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (path, expiresIn) => {
          calls.push({ bucket, path, expiresIn });
          return { data: { signedUrl: `https://storage.local/${bucket}/${path}?signed=1` }, error: null };
        },
      }),
    },
  };

  const result = await resolveSignedUrl('user1/avatar.jpg', 'avatars', 1800, mockClient);
  assert.equal(result, 'https://storage.local/avatars/user1/avatar.jpg?signed=1');
  assert.deepEqual(calls, [{ bucket: 'avatars', path: 'user1/avatar.jpg', expiresIn: 1800 }]);
});

test('resolveSignedUrl returns null on client error or exception', async () => {
  const errorClient = {
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: null, error: new Error('File not found') }),
      }),
    },
  };
  assert.equal(await resolveSignedUrl('missing.jpg', 'avatars', 3600, errorClient), null);

  const throwingClient = {
    storage: {
      from: () => ({
        createSignedUrl: async () => { throw new Error('Network failure'); },
      }),
    },
  };
  assert.equal(await resolveSignedUrl('throw.jpg', 'avatars', 3600, throwingClient), null);
});

test('resolveSignedUrls returns empty record for empty or falsy path lists', async () => {
  const mockClient = {
    storage: {
      from: () => ({
        createSignedUrls: () => assert.fail('Should not be called'),
      }),
    },
  };

  assert.deepEqual(await resolveSignedUrls([], 'avatars', 3600, mockClient), {});
  assert.deepEqual(await resolveSignedUrls([null, undefined, '', '   '], 'avatars', 3600, mockClient), {});
});

test('resolveSignedUrls deduplicates paths and maps response data into Record', async () => {
  const calls = [];
  const mockClient = {
    storage: {
      from: (bucket) => ({
        createSignedUrls: async (paths, expiresIn) => {
          calls.push({ bucket, paths, expiresIn });
          return {
            data: paths.map((p) => ({
              path: p,
              signedUrl: `https://storage.local/${bucket}/${p}?signed=1`,
              error: null,
            })),
            error: null,
          };
        },
      }),
    },
  };

  const paths = ['a.jpg', 'b.jpg', 'a.jpg', null, 'c.jpg', ''];
  const record = await resolveSignedUrls(paths, 'post-photos', 3600, mockClient);

  assert.deepEqual(calls, [{ bucket: 'post-photos', paths: ['a.jpg', 'b.jpg', 'c.jpg'], expiresIn: 3600 }]);
  assert.deepEqual(record, {
    'a.jpg': 'https://storage.local/post-photos/a.jpg?signed=1',
    'b.jpg': 'https://storage.local/post-photos/b.jpg?signed=1',
    'c.jpg': 'https://storage.local/post-photos/c.jpg?signed=1',
  });
});

test('resolveSignedUrlMap returns Map instance matching resolveSignedUrls', async () => {
  const mockClient = {
    storage: {
      from: (bucket) => ({
        createSignedUrls: async (paths) => ({
          data: paths.map((p) => ({ path: p, signedUrl: `https://test/${p}` })),
          error: null,
        }),
      }),
    },
  };

  const map = await resolveSignedUrlMap(['x.png', 'y.png'], 'avatars', 3600, mockClient);
  assert.ok(map instanceof Map);
  assert.equal(map.get('x.png'), 'https://test/x.png');
  assert.equal(map.get('y.png'), 'https://test/y.png');
  assert.equal(map.get('unknown.png'), undefined);
});
