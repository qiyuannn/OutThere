import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const DEVICE_KEY = 'outthere.push.device-id';

async function deviceId() {
  const current = await AsyncStorage.getItem(DEVICE_KEY);
  if (current) return current;
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

function projectId() {
  return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
}

export type PushState = 'enabled' | 'denied' | 'unavailable' | 'disabled';

export async function pushState(): Promise<PushState> {
  if (!Device.isDevice || Platform.OS === 'web') return 'unavailable';
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status === 'granted') return 'enabled';
  return permission.canAskAgain ? 'disabled' : 'denied';
}

export async function enablePush(): Promise<PushState> {
  if (!supabase || !Device.isDevice || Platform.OS === 'web') return 'unavailable';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('social', {
      name: 'Social activity', importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250], lightColor: '#111111',
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return permission.canAskAgain ? 'disabled' : 'denied';
  const id = projectId();
  if (!id) throw new Error('Connect this app to an EAS project before enabling push notifications.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  const { error } = await supabase.rpc('social_register_push_token', {
    p_token: token, p_device_id: await deviceId(), p_platform: Platform.OS,
  });
  if (error) throw error;
  return 'enabled';
}

export async function disablePush(): Promise<PushState> {
  if (!supabase) return 'disabled';
  const id = await AsyncStorage.getItem(DEVICE_KEY);
  if (id) {
    const { error } = await supabase.rpc('social_unregister_push_token', { p_device_id: id });
    if (error) throw error;
  }
  return 'disabled';
}

export function openNotificationSettings() { return Linking.openSettings(); }
