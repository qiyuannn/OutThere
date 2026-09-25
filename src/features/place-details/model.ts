export const MUTUAL_SAVES_PLURAL_TEXT = 'have this on their saved list too!';
export const MUTUAL_SAVES_SINGULAR_TEXT = 'has this on their saved list too!';

export function formatMutualSavesText(
  users: { displayName?: string }[],
  options?: { literal?: boolean }
): string {
  if (!users || users.length === 0) return '';
  if (options?.literal) {
    return MUTUAL_SAVES_PLURAL_TEXT;
  }
  return users.length === 1 ? MUTUAL_SAVES_SINGULAR_TEXT : MUTUAL_SAVES_PLURAL_TEXT;
}

