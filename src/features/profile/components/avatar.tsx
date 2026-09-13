import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { avatarUrl } from '../service';
export function Avatar({ path, preview, name, size = 88 }: { path: string | null; preview?: string; name: string; size?: number }) {
  const theme = useTheme();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; setUrl(null); setFailed(false);
    const refresh = () => { void avatarUrl(path).then(value => { if (active) { setUrl(value); setFailed(false); } }).catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 50 * 60 * 1000);
    return () => { active = false; clearInterval(timer); };
  }, [path]);
  useEffect(() => setFailed(false), [preview]);
  const uri = preview ?? url;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    {uri && !failed ? <Image accessibilityLabel="Profile photo" source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size }} /> :
      <ThemedText style={{ color: theme.onAccent, fontSize: size / 3, lineHeight: size / 2, fontWeight: '800' }}>{name.trim().slice(0, 2).toUpperCase() || '↗'}</ThemedText>}
  </View>;
}
