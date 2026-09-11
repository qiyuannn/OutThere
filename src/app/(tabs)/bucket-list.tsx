import { router } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/foundation';
export default function BucketListScreen() {
  return <Screen title="Your someday starts here." eyebrow="BUCKET LIST"><EmptyState title="Room for new possibilities" description="The places you save will live here. Venue discovery is coming soon."><Button label="Back to Discover" onPress={() => router.navigate('/')} /></EmptyState></Screen>;
}
