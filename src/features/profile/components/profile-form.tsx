import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Screen, Card, Button } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/providers/profile-provider';
import { Avatar } from './avatar';
import { Choice, Field } from './fields';
import { BUDGETS, EXPLORATION, INTERESTS, profileError, toDraft, validateProfile, type AvatarSelection, type ProfileDraft } from '../model';

export function ProfileForm({ onboarding = false, onDone, onCancel }: { onboarding?: boolean; onDone: () => void; onCancel: () => void | Promise<void> }) {
  const theme = useTheme();
  const { profile, save, reload } = useProfile();
  const [draft, setDraft] = useState(() => toDraft(profile));
  const [step, setStep] = useState(onboarding ? profile?.onboarding_step ?? 0 : 0);
  const [avatar, setAvatar] = useState<AvatarSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) { setDraft(current => ({ ...current, [key]: value })); setError(''); }
  async function pickAvatar() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      // The system picker grants access to the chosen image; no broad library permission is requested.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || asset.width < 1 || asset.height < 1) throw new Error('Invalid image');
      const side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      context.crop({ originX: (asset.width - side) / 2, originY: (asset.height - side) / 2, width: side, height: side }).resize({ width: 512, height: 512 });
      const rendered = await context.renderAsync();
      const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
      if (!image.base64 || image.base64.length > 2796200) throw new Error('Image too large');
      setAvatar({ uri: image.uri, base64: image.base64 });
    } catch { setError('We couldn’t open that photo. Try another image, or continue without a photo.'); }
    finally { working.current = false; setBusy(false); }
  }
  async function submit() {
    if (working.current) return;
    const validation = validateProfile(draft, onboarding && step < 2 ? step : undefined);
    if (validation) { setError(validation); return; }
    working.current = true; setBusy(true); setError(''); setConflict(false);
    try {
      const complete = !onboarding || step === 2;
      const nextStep = complete ? 2 : step + 1;
      const saved = await save(draft, nextStep, complete, avatar);
      setDraft(toDraft(saved)); setAvatar(null);
      if (complete) onDone(); else setStep(nextStep);
    } catch (reason) {
      setError(profileError(reason));
      setConflict(reason instanceof Error && reason.message.startsWith('Your profile changed'));
    } finally { working.current = false; setBusy(false); }
  }
  async function cancel() {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try { await onCancel(); }
    catch { setError('We couldn’t sign you out. Check your connection and try again.'); }
    finally { working.current = false; setBusy(false); }
  }
  const show = (section: number) => !onboarding || step === section;
  const titles = ['Make yourself at home.', 'What draws you outside?', 'Your kind of adventure.'];
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen title={onboarding ? titles[step] : 'Make it yours.'} eyebrow={onboarding ? `WELCOME · STEP ${step + 1} OF 3` : 'EDIT PROFILE'}>
      {onboarding && <View accessibilityLabel={`Step ${step + 1} of 3`} style={{ flexDirection: 'row', gap: 8 }}>{[0, 1, 2].map(index => <View key={index} style={{ flex: 1, height: 5, borderRadius: 5, backgroundColor: index <= step ? theme.primary : theme.border }} />)}</View>}
      {show(0) && <Card>
        <View style={{ alignItems: 'center', gap: 12 }}><Avatar name={draft.display_name} path={draft.avatar_path} preview={avatar?.uri} />
          <ThemedText type="small" themeColor="textSecondary">A photo is optional. Your initials work too.</ThemedText>
          <Button disabled={busy} label="Choose photo" onPress={pickAvatar} />
          {(draft.avatar_path || avatar) && <Button disabled={busy} label="Remove photo" onPress={() => { setAvatar(null); update('avatar_path', null); }} />}
        </View>
        <Field label="Your name" value={draft.display_name} onChangeText={value => update('display_name', value)} maxLength={60} autoComplete="name" editable={!busy} placeholder="What should we call you?" />
        <Field label="Username" value={draft.username} onChangeText={value => update('username', value.toLowerCase())} maxLength={24} autoCapitalize="none" autoCorrect={false} editable={!busy} placeholder="your_unique_name" help="3–24 letters, numbers, or underscores. You can change this later." />
        <Field label="A little about you (optional)" multiline value={draft.bio} onChangeText={value => update('bio', value)} maxLength={240} editable={!busy} placeholder="Always searching for a quiet café…" help={`${draft.bio.length}/240 characters`} />
      </Card>}
      {show(1) && <Card>
        <Field label="Home city" value={draft.city} onChangeText={value => update('city', value)} maxLength={80} editable={!busy} placeholder="e.g. Singapore" help="Your home base. Nearby discovery uses your device location separately." />
        <ThemedText type="subtitle" style={{ fontSize: 24 }}>Follow your curiosity</ThemedText>
        <ThemedText themeColor="textSecondary">Pick at least one interest. Choose as many as you like.</ThemedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{INTERESTS.map(([id, label, icon]) => <Choice key={id} label={`${icon} ${label}`} selected={draft.interests.includes(id)} disabled={busy} onPress={() => update('interests', draft.interests.includes(id) ? draft.interests.filter(value => value !== id) : [...draft.interests, id])} />)}</View>
      </Card>}
      {show(2) && <>
        <Card><ThemedText type="subtitle" style={{ fontSize: 24 }}>What feels comfortable?</ThemedText><ThemedText themeColor="textSecondary">Your usual spending preference for an outing.</ThemedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{BUDGETS.map(([id, label, description]) => <Choice key={id} label={label} description={description} selected={draft.budget === id} disabled={busy} onPress={() => update('budget', id)} />)}</View>
        </Card>
        <Card><ThemedText type="subtitle" style={{ fontSize: 24 }}>How far would you go?</ThemedText><ThemedText themeColor="textSecondary">Your default discovery range. You can adjust it in Discover.</ThemedText>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Button label="− 1 km" disabled={busy || draft.travel_radius_meters <= 1000} onPress={() => update('travel_radius_meters', draft.travel_radius_meters - 1000)} />
            <ThemedText type="smallBold" accessibilityLiveRegion="polite">{draft.travel_radius_meters / 1000} km</ThemedText>
            <Button label="+ 1 km" disabled={busy || draft.travel_radius_meters >= 50000} onPress={() => update('travel_radius_meters', draft.travel_radius_meters + 1000)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[5, 10, 25, 50].map(km => <Choice key={km} label={`${km} km`} selected={draft.travel_radius_meters === km * 1000} onPress={() => update('travel_radius_meters', km * 1000)} disabled={busy} />)}</View>
        </Card>
        <Card><ThemedText type="subtitle" style={{ fontSize: 24 }}>Leave room for discovery</ThemedText>{EXPLORATION.map(([id, label, description]) => <Choice key={id} label={label} description={description} selected={draft.exploration_style === id} onPress={() => update('exploration_style', id)} disabled={busy} />)}</Card>
      </>}
      {!!error && <ThemedText accessibilityRole="alert">{error}</ThemedText>}
      {conflict && <Button label="Reload latest profile" disabled={busy} onPress={() => { void reload(); }} />}
      <Button disabled={busy || conflict} label={busy ? 'Saving…' : onboarding ? step === 2 ? 'Let’s explore' : 'Save and continue' : 'Save changes'} onPress={submit} />
      {onboarding && step > 0 && <Button disabled={busy} label="Back" onPress={() => { setStep(step - 1); setError(''); }} />}
      {confirmCancel ? <Card><ThemedText>{onboarding ? 'Your completed steps are saved. Sign out now?' : 'Discard your unsaved changes?'}</ThemedText><Button label={onboarding ? 'Sign out' : 'Discard changes'} disabled={busy} onPress={cancel} /><Button label="Keep editing" disabled={busy} onPress={() => setConfirmCancel(false)} /></Card> : <Button disabled={busy} label={onboarding ? 'Finish later · sign out' : 'Cancel'} onPress={() => setConfirmCancel(true)} />}
      {onboarding && <ThemedText type="small" themeColor="textSecondary">Each completed step is saved. You can edit these details in your profile anytime.</ThemedText>}
    </Screen>
  </KeyboardAvoidingView>;
}
