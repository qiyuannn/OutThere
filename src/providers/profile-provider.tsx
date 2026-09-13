import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useAuth } from './auth-provider';
import { loadProfile, saveProfile } from '@/features/profile/service';
import type { AvatarSelection, Profile, ProfileDraft } from '@/features/profile/model';
interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
  save: (draft: ProfileDraft, step: number, completed: boolean, avatar: AvatarSelection | null) => Promise<Profile>;
}
const Context = createContext<ProfileState | null>(null);
export function ProfileProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  return <ProfileSession key={session?.user.id ?? 'guest'} userId={session?.user.id}>{children}</ProfileSession>;
}
function ProfileSession({ children, userId }: PropsWithChildren<{ userId?: string }>) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const saving = useRef(false);
  const current = useRef<Profile | null>(null);
  const reload = useCallback(async () => {
    if (!userId || saving.current) return;
    const id = ++request.current;
    setLoading(true); setError(false);
    try {
      const next = await loadProfile(userId);
      if (id === request.current) { current.current = next; setProfile(next); }
    } catch { if (id === request.current) setError(true); }
    finally { if (id === request.current) setLoading(false); }
  }, [userId]);
  useEffect(() => { void reload(); return () => { request.current += 1; }; }, [reload]);
  async function save(draft: ProfileDraft, step: number, completed: boolean, avatar: AvatarSelection | null) {
    if (!userId || saving.current) throw new Error('A profile save is already in progress.');
    saving.current = true;
    const id = ++request.current;
    try {
      const next = await saveProfile(userId, current.current, draft, step, completed, avatar);
      if (id === request.current) { current.current = next; setProfile(next); setError(false); }
      return next;
    } finally { saving.current = false; }
  }
  return <Context.Provider value={{ profile, loading, error, reload, save }}>{children}</Context.Provider>;
}
export function useProfile() {
  const context = useContext(Context);
  if (!context) throw new Error('useProfile requires ProfileProvider');
  return context;
}
