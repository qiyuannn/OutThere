export function accountError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/username exactly/i.test(message)) return 'Type your username exactly to confirm account deletion.';
  if (/sign in again/i.test(message)) return 'Your session expired. Sign in again before deleting your account.';
  if (/network|fetch|timeout/i.test(message)) return 'You appear to be offline. Reconnect and try again.';
  return 'Your account could not be deleted. Try again.';
}

export function matchesDeletionConfirmation(username: string, confirmation: string): boolean {
  return !!username && confirmation.trim().toLocaleLowerCase() === username.toLocaleLowerCase();
}
