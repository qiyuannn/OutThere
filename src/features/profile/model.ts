import { getErrorMessage, isCheckViolation, isUniqueViolation } from '../../lib/errors.ts';
import { InputLimits } from '../../constants/limits.ts';

export interface ProfileDraft {

  username: string;
  display_name: string;
  bio: string;
  avatar_path: string | null;
  is_private: boolean;
}
export interface Profile extends Omit<ProfileDraft, 'username'> {
  user_id: string;
  username: string | null;
  onboarding_completed: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface AvatarSelection { uri: string; base64: string }
export const emptyDraft = (): ProfileDraft => ({
  username: '',
  display_name: '',
  bio: '',
  avatar_path: null,
  is_private: false,
});
export function toDraft(profile: Profile | null): ProfileDraft {
  if (!profile) return emptyDraft();
  const { username, display_name, bio, avatar_path, is_private } = profile;
  return { username: username ?? '', display_name, bio, avatar_path, is_private: Boolean(is_private) };
}
export function normalizeProfile(draft: ProfileDraft): ProfileDraft {
  return {
    ...draft,
    username: draft.username.trim().toLowerCase(),
    display_name: draft.display_name.trim(),
    bio: draft.bio.trim(),
    is_private: Boolean(draft.is_private),
  };
}
export function validateProfile(draft: ProfileDraft): string | null {
  const value = normalizeProfile(draft);
  if (!value.display_name || value.display_name.length > InputLimits.maxDisplayNameLength) return 'Enter your name (up to 60 characters).';
  if (!/^[a-z0-9_]{3,24}$/.test(value.username)) return 'Choose a username with 3–24 letters, numbers, or underscores.';
  if (value.bio.length > InputLimits.maxBioLength) return 'Keep your bio within 240 characters.';
  return null;
}
export function profileError(error: unknown): string {
  if (isUniqueViolation(error)) return 'That username is already taken. Choose another one.';
  if (isCheckViolation(error)) return 'Some profile details aren’t valid. Check your entries and try again.';
  const message = getErrorMessage(error, '');
  if (message.startsWith('Your profile changed')) return message;
  return 'We couldn’t save your profile. Check your connection and try again.';
}


export function formatActivitiesTitle(isOwn: boolean, userName?: string): string {
  if (isOwn) return 'My Past Activities';
  return userName ? `${userName}’s Activities` : 'Past Activities';
}

export function formatStatisticsTitle(isOwn: boolean, userName?: string): string {
  if (isOwn) return 'Distribution & Statistics';
  return userName ? `${userName}’s Statistics` : 'Distribution & Statistics';
}

