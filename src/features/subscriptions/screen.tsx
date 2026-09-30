import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/app-header';
import { Fonts } from '@/constants/theme';
import { Config } from '@/constants/config';
import { formatDisplayDate } from '@/lib/format';
import { useSubscription } from '@/providers/subscription-provider';
import { availablePlans, PRO_ENTITLEMENT } from './model';

export default function SubscriptionScreen() {
  const billing = useSubscription();
  async function openLink(url: string | undefined, label: string) {
    billing.reportError(null);
    if (!url?.trim()) {
      billing.reportError(`${label} is not available yet. Please try again later.`);
      return;
    }
    try {
      await Linking.openURL(url.trim());
    } catch {
      billing.reportError(`Couldn’t open ${label.toLowerCase()}. Please try again or check that you have an app that can open this link.`);
    }
  }
  const plan = availablePlans(billing.offering)[0];
  const entitlement = billing.customerInfo?.entitlements.active[PRO_ENTITLEMENT];
  const disabled = billing.busy || !billing.ready || !!billing.unavailable;
  const price = plan?.pkg.product.priceString;
  const expiration = entitlement?.expirationDate;
  const date = expiration ? formatDisplayDate(expiration) : null;

  // The current offering may differ from an existing member's purchased product.
  const matchingPrice = plan?.pkg.product.identifier === entitlement?.productIdentifier ? price : undefined;
  const renewal = date
    ? `${entitlement?.willRenew ? `${matchingPrice ? `${matchingPrice} ` : ''}renews` : 'Access until'} ${date}`
    : 'Your Pro access is active';
  const feedback = billing.error ?? billing.message ?? billing.unavailable
    ?? (entitlement?.billingIssueDetectedAt ? 'There’s a billing issue. Manage your subscription to review your payment details.' : null)
    ?? (billing.ready && !billing.isPro && !plan ? 'The monthly plan is temporarily unavailable. You can still restore purchases.' : null);
  const canCancel = entitlement?.willRenew && !!expiration;

  return <SafeAreaView edges={['left', 'right']} style={styles.page}>
    <AppHeader description="Membership" showBack onBack={() => {
      if (router.canGoBack()) router.back(); else router.replace('/profile');
    }} />
    <ScrollView contentContainerStyle={styles.body}>
      {billing.isPro ? <View style={[styles.heading, styles.outline]}>
        <Text style={styles.title}>Your Pro <Text style={styles.brand}>OutThere</Text> subscription is active</Text>
        <Text style={styles.light}>{renewal}</Text>
      </View> : <>
        <View style={styles.heading}>
          <Text style={styles.title}>Subscribe to <Text style={styles.brand}>OutThere</Text> Pro</Text>
          <Text style={styles.light}>{price ? `${price}/month` : billing.ready ? 'Monthly membership' : 'Checking your membership…'}</Text>
        </View>
        <View style={styles.benefits}>
          <Text style={styles.semibold}>Pro Benefits</Text>
          <View>
            <Text style={styles.text}>1. Ad-Free</Text>
            <Text style={styles.text}>2. Unlimited Discovery swipes</Text>
          </View>
        </View>
      </>}
      <View style={styles.spacer} />
      {(billing.testStore || billing.busy || feedback) && <View style={styles.status}>
        {billing.testStore && <Text style={styles.light}>Test Store · No real charges</Text>}
        {billing.busy && !billing.unavailable && <ActivityIndicator color="#000000" accessibilityLabel="Updating membership" />}
        {!!feedback && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.light}>{feedback}</Text>}

      </View>}
      {billing.isPro ? <>
        <Pressable accessibilityRole="button" accessibilityHint="Opens membership management" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { void billing.customerCenter(); }} style={({ pressed }) => [styles.outline, styles.action, (disabled || pressed) && styles.dimmed]}>
          <Text style={styles.light}>Manage Subscription</Text>
        </Pressable>
        {canCancel && <Pressable accessibilityRole="button" accessibilityHint="Opens your store subscription settings to cancel renewal" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { void billing.cancelSubscription(); }} style={({ pressed }) => [styles.outline, styles.action, (disabled || pressed) && styles.dimmed]}>
          <Text style={styles.light}>Cancel Subscription</Text>
        </Pressable>}
      </> : <>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || !plan }} disabled={disabled || !plan} onPress={() => { if (plan) void billing.purchase(plan.pkg); }} style={({ pressed }) => [styles.outline, styles.action, (disabled || !plan || pressed) && styles.dimmed]}>
          <Text style={styles.semibold}>{price ? `Subscribe for ${price}/month` : 'Subscribe monthly'}</Text>
          <Text style={styles.light}>Cancel at any time</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: billing.busy || !!billing.unavailable }} disabled={billing.busy || !!billing.unavailable} onPress={() => { void billing.restore(); }} style={({ pressed }) => [styles.outline, styles.action, (billing.busy || !!billing.unavailable || pressed) && styles.dimmed]}>
          <Text style={styles.light}>Restore Purchases</Text>
        </Pressable>
      </>}
      <Pressable accessibilityRole="button" onPress={() => { void openLink(Config.support.contactUrl, 'Contact Support'); }} style={({ pressed }) => [styles.outline, styles.action, pressed && styles.dimmed]}>
        <Text style={styles.light}>Contact Support</Text>
      </Pressable>
      <View style={styles.legalLinks}>
        <Pressable accessibilityRole="link" onPress={() => { void openLink(Config.support.termsUrl, 'Terms of Use'); }} style={({ pressed }) => [styles.textLink, pressed && styles.dimmed]}>
          <Text style={styles.light}>Terms of Use</Text>
        </Pressable>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.light}>·</Text>
        <Pressable accessibilityRole="link" onPress={() => { void openLink(Config.support.privacyUrl, 'Privacy Policy'); }} style={({ pressed }) => [styles.textLink, pressed && styles.dimmed]}>
          <Text style={styles.light}>Privacy Policy</Text>
        </Pressable>
      </View>

    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { flexGrow: 1, padding: 10, gap: 10 },
  heading: { padding: 10, alignItems: 'center' },
  outline: { borderWidth: 1, borderColor: '#000000' },
  title: { color: '#000000', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  brand: { fontFamily: Fonts.mono, fontSize: 20, fontWeight: '700' },
  text: { color: '#000000', fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15 },
  light: { color: '#000000', fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15, fontWeight: '300', textAlign: 'center' },
  semibold: { color: '#000000', fontFamily: Fonts.sans, fontSize: 12, lineHeight: 15, fontWeight: '600' },
  benefits: { padding: 10, gap: 10 },
  spacer: { flexGrow: 1, minHeight: 20 },
  action: { padding: 10, alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  status: { gap: 10, padding: 10 },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 10 },
  textLink: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  dimmed: { opacity: 0.45 },
});
