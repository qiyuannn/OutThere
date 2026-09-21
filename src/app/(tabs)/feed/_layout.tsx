import { Stack } from 'expo-router';

export default function PageLayout() {
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="post/[id]" options={{ presentation: 'formSheet', sheetGrabberVisible: true, sheetAllowedDetents: [0.65, 0.95], sheetInitialDetentIndex: 1 }} />
  </Stack>;
}
