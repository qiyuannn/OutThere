export function validateCredentials(email: string, password?: string, confirmation?: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
  if (password !== undefined && !password) return 'Enter your password.';
  if (confirmation !== undefined) return validateNewPassword(password ?? '', confirmation);
  return null;
}

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  if (password !== confirmation) return 'Your passwords don’t match.';
  return null;
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  switch (code) {
    case 'invalid_credentials': return 'The email or password is incorrect.';
    case 'email_not_confirmed': return 'Confirm your email before signing in. You can resend the confirmation below.';
    case 'weak_password': return 'Choose a stronger password. Use at least 8 characters with a mix of letters, numbers, and symbols.';
    case 'same_password': return 'Choose a password different from your current one.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Too many attempts. Wait a moment and try again.';
    case 'user_already_exists': return 'Try signing in or resetting your password for this email.';
    default: return 'We couldn’t complete that request. Check your connection and try again.';
  }
}
