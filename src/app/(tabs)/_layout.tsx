import { Redirect } from 'expo-router';
import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/providers/auth-provider';
export default function TabsLayout() {
  const { recovery } = useAuth();
  if (recovery) return <Redirect href="/auth/reset-password" />;
  return <AppTabs />;
}
