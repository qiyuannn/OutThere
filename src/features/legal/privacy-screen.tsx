import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';

const Row = ({ title, children }: PropsWithChildren<{ title: string }>) => <Card>
  <ThemedText type="subtitle">{title}</ThemedText>
  <ThemedText themeColor="textSecondary" style={{ lineHeight: 20 }}>{children}</ThemedText>
</Card>;

export default function PrivacyPolicyScreen() {
  return <Screen title="Privacy Policy" headerDescription="Privacy Policy">
    <Button label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile/account')} />
    <ThemedText type="small" themeColor="textSecondary">Effective 21 September 2026</ThemedText>
    <Row title="Information OutThere uses">Your account email and sign-in data; profile name, username, bio and avatar; saved places, ratings and notes; friend relationships, posts, likes, comments, blocks and reports; subscription status; and a push token only when you enable notifications.</Row>
    <Row title="Location and place search">Your device location is requested only after permission and is used to search nearby places. Search requests are processed through OutThere’s backend and Google Places. OutThere does not save your precise device location to your profile.</Row>
    <Row title="How information is used">Information is used to operate your account, save your choices, show friends-only activity, prevent abuse, review reports, deliver notifications you request and restore paid access. Reports include a snapshot of the reported content so moderators can review it even if it changes later.</Row>
    <Row title="Sharing and service providers">Friends can see activity you explicitly share with friends. Supabase provides authentication and data storage, Google provides place results, RevenueCat manages purchase status, and Expo delivers enabled push notifications. OutThere does not sell personal information.</Row>
    <Row title="Controls and retention">You can make ratings private, disable social discovery, block people, turn off push notifications and delete your account in Account & Privacy. Account deletion removes the account and associated app data; limited moderation audit records may retain identifiers required to document safety decisions.</Row>
    <Row title="Contact">For privacy questions or deletion help, contact the OutThere project team through the channel that provided your test access.</Row>
  </Screen>;
}
