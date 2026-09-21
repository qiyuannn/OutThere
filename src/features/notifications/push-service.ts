// Web and TypeScript fallback. Metro selects push-service.native.ts on iOS and Android.
export type PushState = 'enabled' | 'denied' | 'unavailable' | 'disabled';
export async function pushState(): Promise<PushState> { return 'unavailable'; }
export async function enablePush(): Promise<PushState> { return 'unavailable'; }
export async function disablePush(): Promise<PushState> { return 'disabled'; }
export async function openNotificationSettings() {}
