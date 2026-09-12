import { router } from 'expo-router';
import { ProfileForm } from './components/profile-form';

export default function EditProfileScreen() {
  return <ProfileForm onDone={() => router.replace('/profile?updated=1')} onCancel={() => router.replace('/profile')} />;
}
