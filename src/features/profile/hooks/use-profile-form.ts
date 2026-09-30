import { useRef, useState } from 'react';
import { pickAvatarImage } from '@/lib/image-picker';
import { useProfile } from '@/providers/profile-provider';
import {
  profileError,
  toDraft,
  validateProfile,
  type AvatarSelection,
  type ProfileDraft,
} from '../model';

export function useProfileForm(onDone: () => void, onCancel: () => void | Promise<void>) {
  const { profile, save, reload } = useProfile();
  const [draft, setDraft] = useState(() => toDraft(profile));
  const [avatar, setAvatar] = useState<AvatarSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
  }

  async function pickAvatar() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      const processed = await pickAvatarImage();
      if (!processed) return;
      setAvatar({ uri: processed.uri, base64: processed.base64 });
    } catch {
      setError('We couldn’t open that photo. Try another image, or continue without a photo.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function submit() {
    if (working.current) return;
    const validation = validateProfile(draft);
    if (validation) {
      setError(validation);
      return;
    }
    working.current = true;
    setBusy(true);
    setError('');
    setConflict(false);
    try {
      const saved = await save(draft, true, avatar);
      setDraft(toDraft(saved));
      setAvatar(null);
      onDone();
    } catch (reason) {
      setError(profileError(reason));
      setConflict(reason instanceof Error && reason.message.startsWith('Your profile changed'));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function cancel() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await onCancel();
    } catch {
      setError('We couldn’t sign you out. Check your connection and try again.');
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return {
    draft,
    avatar,
    setAvatar,
    busy,
    error,
    conflict,
    update,
    pickAvatar,
    submit,
    cancel,
    reload,
  };
}
