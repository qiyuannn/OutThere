export function selectBillingKey(platform: string, development: boolean, mode: string | undefined, testKey: string | undefined, iosKey: string | undefined, androidKey: string | undefined) {
  if (platform !== 'ios' && platform !== 'android') return { key: '', testStore: false, error: 'Subscriptions are available in the iOS and Android apps.' };
  if (mode === 'test') {
    if (!development) return { key: '', testStore: true, error: 'Test purchases are disabled in release builds.' };
    return testKey?.startsWith('test_') ? { key: testKey, testStore: true, error: null } : { key: '', testStore: true, error: 'Subscriptions aren’t configured for this build.' };
  }
  const key = platform === 'ios' ? iosKey : androidKey;
  const prefix = platform === 'ios' ? 'appl_' : 'goog_';
  return key?.startsWith(prefix) ? { key, testStore: false, error: null } : { key: '', testStore: false, error: 'Subscriptions aren’t configured for this build.' };
}
