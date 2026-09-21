import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useSubscription } from '@/providers/subscription-provider';
import { availablePlans, PRO_BENEFITS, PRO_ENTITLEMENT } from './model';
export default function SubscriptionScreen() {
  const billing = useSubscription();
  const plans = availablePlans(billing.offering);
  const entitlement = billing.customerInfo?.entitlements.active[PRO_ENTITLEMENT];
  const disabled = billing.busy || !billing.ready;
  return <Screen title="OutThere Pro" eyebrow="MEMBERSHIP">
    {billing.testStore && <ThemedText type="small" themeColor="primary">Test Store · Test purchases only. No real charges.</ThemedText>}
    {billing.unavailable ? <Card><ThemedText>{billing.unavailable}</ThemedText></Card> : <>
      <Card><ThemedText type="subtitle" style={{ fontSize: 24 }}>{billing.isPro ? 'You’re a Pro member.' : billing.ready ? 'Find your membership.' : 'Checking your membership.'}</ThemedText>
        {PRO_BENEFITS.map((benefit) => <ThemedText key={benefit.id}>
          <ThemedText type="smallBold">{benefit.title}</ThemedText>{' · '}{benefit.description}
        </ThemedText>)}
        {entitlement && <>
          <ThemedText>{entitlement.expirationDate ? `${entitlement.willRenew ? 'Renews' : 'Access until'} ${new Date(entitlement.expirationDate).toLocaleDateString()}` : 'Lifetime access · no recurring renewal'}</ThemedText>
          {entitlement.billingIssueDetectedAt && <ThemedText>There’s a billing issue. Open Manage membership to review your payment details.</ThemedText>}
        </>}
        {!billing.isPro && <ThemedText themeColor="textSecondary">Review membership details, pricing, and terms before purchasing.</ThemedText>}
        {billing.busy && <ActivityIndicator accessibilityLabel="Updating membership" />}
        {!!billing.error && <ThemedText accessibilityRole="alert">{billing.error}</ThemedText>}
        {!!billing.message && <ThemedText accessibilityRole="alert">{billing.message}</ThemedText>}
        <Button label="Refresh membership" disabled={billing.busy} onPress={() => { void billing.refresh(); }} />
      </Card>
      {!billing.isPro && billing.ready && <>
        <Button label="View Pro paywall" disabled={disabled || !plans.length} onPress={() => { void billing.presentPaywall(); }} />
        {plans.length === 0 && <Card><ThemedText>No plans are available right now. You can still restore an existing purchase.</ThemedText></Card>}
        {plans.map(({ id, label, period, pkg }) => <Card key={id}>
          <ThemedText type="subtitle" style={{ fontSize: 24 }}>{label}</ThemedText>
          <ThemedText>{pkg.product.priceString} · {period}</ThemedText>
          {!!pkg.product.description && <ThemedText themeColor="textSecondary">{pkg.product.description}</ThemedText>}
          <ThemedText type="small" themeColor="textSecondary">{id === 'lifetime' ? 'One purchase, no automatic renewal.' : 'Automatically renews unless cancelled through your store account. Confirm all terms in the purchase sheet.'}</ThemedText>
          <Button label={`Continue with ${label.toLowerCase()}`} disabled={disabled} onPress={() => { void billing.purchase(pkg); }} />
        </Card>)}
      </>}
      <Card>
        <Button label="Restore purchases" disabled={billing.busy} onPress={() => { void billing.restore(); }} />
        <Button label="Manage membership" disabled={disabled} onPress={() => { void billing.customerCenter(); }} />
        <ThemedText type="small" themeColor="textSecondary">Use the store account that made the original purchase. Membership management includes purchase history and available support options.</ThemedText>
        <ThemedText type="small" selectable>Support ID: {billing.userId}</ThemedText>
      </Card>
    </>}
    <Card>
      <ThemedText type="subtitle">Policies</ThemedText>
      <Button label="Privacy Policy" onPress={() => router.push('/profile/privacy-policy')} />
      <Button label="Terms of Use" onPress={() => router.push('/profile/terms')} />
    </Card>
    <Button label="Back to profile" onPress={() => router.replace('/profile')} />
  </Screen>;
}
