import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';

const Row = ({ title, children }: PropsWithChildren<{ title: string }>) => <Card>
  <ThemedText type="subtitle">{title}</ThemedText>
  <ThemedText themeColor="textSecondary" style={{ lineHeight: 20 }}>{children}</ThemedText>
</Card>;

export default function TermsScreen() {
  return <Screen title="Terms of Use" headerDescription="Terms of Use">
    <Button label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile/account')} />
    <ThemedText type="small" themeColor="textSecondary">Effective 21 September 2026</ThemedText>
    <Row title="Using OutThere">Use accurate account information, keep your sign-in secure and use the app only in lawful ways. Place details can change; confirm opening hours, prices, accessibility and safety with the venue before visiting.</Row>
    <Row title="Social content">You remain responsible for ratings, notes, comments and profile content you share. Do not post harassment, threats, spam, impersonation, illegal content or another person’s private information. Friends-only sharing limits the intended audience but recipients can still capture what they see.</Row>
    <Row title="Safety enforcement">People can report users, posts and comments. OutThere may remove content or suspend social access after review. Blocking disconnects both accounts and hides their shared activity from each other.</Row>
    <Row title="Subscriptions">Store purchase terms govern subscriptions. Renewable plans continue until cancelled through the App Store or Play Store. Deleting an OutThere account does not cancel a store subscription. Restore purchases after changing devices or accounts.</Row>
    <Row title="Prototype availability">OutThere is currently a demonstration project for evaluation. Features may change and the service may be unavailable. The app and place recommendations are provided without a guarantee that every result is complete or current.</Row>
    <Row title="Ending access">You may stop using the app or delete your account at any time. OutThere may restrict access when needed to protect users, comply with law or preserve the service.</Row>
  </Screen>;
}
