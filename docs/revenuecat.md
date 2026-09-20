# RevenueCat in OutThere

The integration lives in `src/features/subscriptions`. It uses the installed
`react-native-purchases` and `react-native-purchases-ui` 10.9.1 SDKs, Supabase user
UUIDs, and the `outthere_pro` entitlement. Open **Profile → View membership**.

## 1. Install with npm and rebuild the native app

```sh
npm install --save react-native-purchases react-native-purchases-ui
npm run ios
# Or, with the Android toolchain installed:
npm run android
```

The packages autolink. `plugins/with-revenuecat.js` preserves the iOS In-App
Purchase capability and Android `singleTop` activity launch mode during Expo
prebuild. The Android setting allows a banking-app verification round trip
without cancelling the purchase. After pulling this change into a checkout with
existing generated native folders, run `npx expo prebuild --no-install` before
the native rebuild. Expo development builds must be rebuilt after adding them;
refreshing an old build does not install native modules. Use an actual development
build for purchase testing, not Expo Go's preview behavior. This implementation
intentionally leaves web billing unsupported and keeps native modules out of SSR.

## 2. Configure public SDK keys

The supplied Test Store key has been added to the ignored `.env.local`:

```dotenv
EXPO_PUBLIC_REVENUECAT_MODE=test
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_ELIobZLhZMvWmlRfOOTOkVNScvY
```

Restart Metro after changing configuration. Test Store mode is permitted only in
development builds. Before distributing a release, connect the Apple and Google
apps in RevenueCat, complete each store's billing setup, and supply their own
public SDK keys:

```dotenv
EXPO_PUBLIC_REVENUECAT_MODE=store
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_your_public_ios_sdk_key
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_your_public_android_sdk_key
```

Set those variables for the corresponding EAS build environment too. Test Store
products are separate from App Store/Google Play products; a Test Store key is
not an Apple sandbox key. Store sandbox/TestFlight testing uses the platform's
public store key. Never place RevenueCat secret `sk_` keys or Supabase service-role
keys in Expo public variables.

## 3. Products, entitlement, and offering

The public RevenueCat API was checked: the current offering is already `default`,
with these package mappings:

| Product identifier | Product type | Standard RevenueCat package |
| --- | --- | --- |
| `lifetime` | Lifetime/non-consumable, one-time purchase | `$rc_lifetime` |
| `yearly` | Auto-renewing subscription, one year | `$rc_annual` |
| `monthly` | Auto-renewing subscription, one month | `$rc_monthly` |

In the RevenueCat dashboard:

1. Under Product Catalog → Entitlements, create or open **`outthere_pro`**.
2. Attach all three products to that entitlement. The public offerings endpoint
   does not verify entitlement attachments; confirm them in the dashboard.
3. Under Offerings, open **`default`**, verify the mappings above, and keep it
   current. The app reads `getOfferings().current`, so targeting and experiments
   can supply a different current offering without a code change.
4. For production, create/import the actual App Store and Google Play products,
   attach them to `outthere_pro`, and map the corresponding products for each
   store to the same package slots. Apple monthly/yearly plans should share a
   subscription group. Lifetime must not be a consumable.
5. Set prices and availability in the respective store/Test Store. The app uses
   `product.priceString`; it never invents prices, currency, discounts, or trials.

## 4. OutThere Pro product contract

`outthere_pro` unlocks two benefits:

1. **Advanced place search** — open-now, price and minimum-rating filters,
   distance sorting, and search radii above 10 km up to 50 km. Free members keep
   place-name search, suggestions, food/activity and category filters, selectable
   areas, and radii up to 10 km.
2. **Personal taste insights** — the activity/food radar profiles, category
   strengths, rating averages and detailed category breakdowns. Core rankings,
   rating, saving places, discovery, profiles and social features remain free.

The benefit definitions and entitlement checks live in
`src/features/subscriptions/model.ts`. Search strips Pro-only values before a
request is sent even when a stale or hand-built deep link includes them. The
statistics screen checks the active entitlement at the route boundary. An active
entitlement continues through a cancelled subscription's paid-through date;
RevenueCat removes access when that entitlement expires.

## 5. SDK initialization and customer identity

`src/features/subscriptions/sdk.native.ts` contains the actual native adapter.
`SubscriptionProvider` is mounted once beneath `AuthProvider` in the root layout.
The controller calls the adapter through a serial queue, so account changes cannot
race a purchase or restore operation. The essential native initialization is:

```tsx
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export async function identifyCustomer(apiKey: string, supabaseUserId: string) {
  if (!(await Purchases.isConfigured())) {
    await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey, appUserID: supabaseUserId });
  } else if ((await Purchases.getAppUserID()) !== supabaseUserId) {
    await Purchases.logIn(supabaseUserId);
  }
}
```

Do not call this snippet separately in screens; the installed provider already
owns initialization. Purchase only while signed in. The ID is the stable Supabase
UUID, never the email, username, or a shared hardcoded ID.

OutThere follows RevenueCat's custom-IDs-only pattern: sign-out immediately clears
and masks application billing state, without calling RevenueCat `logOut()` (which
would create an anonymous ID). The next account uses `logIn(newUUID)`. Late results
from a previous account cannot populate the current account's state. Raw SDK calls
outside the adapter would bypass these protections; use the hook instead.

## 6. Customer info, entitlement checks, purchase and restore

This complete example uses the integrated provider and can be placed inside a
protected screen. The provider handles errors and busy states rather than letting
unhandled purchase promises escape into the UI:

```tsx
import { Button, Card, Screen } from '@/components/foundation';
import { ThemedText } from '@/components/themed-text';
import { useSubscription } from '@/providers/subscription-provider';
import { availablePlans } from '@/features/subscriptions/model';

export default function MembershipExample() {
  const billing = useSubscription();
  const plans = availablePlans(billing.offering);
  return <Screen title="Membership">
    <ThemedText>{billing.isPro ? 'Pro is active' : 'Pro is not active'}</ThemedText>
    {billing.unavailable && <ThemedText>{billing.unavailable}</ThemedText>}
    {billing.error && <ThemedText accessibilityRole="alert">{billing.error}</ThemedText>}
    {billing.message && <ThemedText accessibilityRole="alert">{billing.message}</ThemedText>}
    {!billing.unavailable && <>
      {!billing.isPro && plans.map(({ id, label, pkg }) => <Card key={id}>
        <ThemedText>{label} · {pkg.product.priceString}</ThemedText>
        <Button label={`Choose ${label}`} disabled={billing.busy || !billing.ready}
          onPress={() => { void billing.purchase(pkg); }} />
      </Card>)}
      <Button label="Refresh status" disabled={billing.busy}
        onPress={() => { void billing.refresh(); }} />
      <Button label="Restore purchases" disabled={billing.busy}
        onPress={() => { void billing.restore(); }} />
      <Button label="Show paywall" disabled={billing.busy || !billing.ready || !plans.length}
        onPress={() => { void billing.presentPaywall(); }} />
      <Button label="Manage membership" disabled={billing.busy || !billing.ready}
        onPress={() => { void billing.customerCenter(); }} />
    </>}
  </Screen>;
}
```

The actual complete screen is `src/features/subscriptions/screen.tsx`. It also
shows renewal/expiration, billing issues, a support ID, and recurring versus
one-time payment information. Active Pro members manage their membership rather
than being offered a second purchase. Subscription upgrades/downgrades and
crossgrades are not implemented as new purchases in this screen.

The authoritative client check is:

```ts
const info = await Purchases.getCustomerInfo();
const pro = info.entitlements.active['outthere_pro'];
const isPro = pro?.isActive === true;
```

The controller checks returned `CustomerInfo` after `purchasePackage`, restore,
and paywall presentation. A successful transaction or paywall result alone does
not imply Pro access. `activeSubscriptions` alone is insufficient because
lifetime/non-consumable access is also supported.

Customer info is refreshed on app foregrounding and SDK customer-info updates;
the listener is removed on account changes/provider cleanup. The SDK caches
customer info. An offline refresh failure preserves known access for the same
user and shows an error; it never fabricates access for a new account.

Cancellation is quiet. Pending approval keeps Pro inactive until confirmed.
Network/store/configuration errors show recoverable messages. Duplicate purchase
taps are ignored while a request is open. Restoring with no entitlement shows a
clear “no active purchase” result. Restore only runs on an explicit user action.

## 7. RevenueCat Paywall

The native adapter uses:

```tsx
import RevenueCatUI from 'react-native-purchases-ui';
import Purchases from 'react-native-purchases';

export async function showProPaywall() {
  const { current } = await Purchases.getOfferings();
  if (!current?.availablePackages.length) throw new Error('No current offering');
  const result = await RevenueCatUI.presentPaywallIfNeeded({
    offering: current,
    requiredEntitlementIdentifier: 'outthere_pro',
    displayCloseButton: true,
  });
  const customerInfo = await Purchases.getCustomerInfo();
  return { result, isPro: customerInfo.entitlements.active.outthere_pro?.isActive === true };
}
```

This standalone snippet illustrates SDK calls; app screens should call
`billing.presentPaywall()` to keep identity, concurrency, cancellation, and error
handling centralized. `PURCHASED`/`RESTORED` trigger entitlement verification;
`CANCELLED`/`NOT_PRESENTED` do not grant access; `ERROR` produces a retry message.

In the dashboard, design and publish a paywall attached to `default`. Use the two
benefits above, all three plans, accurate renewal disclosures, restore support,
and the production privacy-policy and terms links. Add a close action in the
paywall editor: `displayCloseButton` applies to older template paywalls and is
ignored by V2 paywalls.

## 8. Customer Center

The **Manage membership** action calls:

```tsx
import RevenueCatUI from 'react-native-purchases-ui';
import Purchases from 'react-native-purchases';

export async function manageMembership() {
  await RevenueCatUI.presentCustomerCenter();
  return Purchases.getCustomerInfo();
}
```

The integration refreshes customer info after the native screen closes. This is
appropriate for reviewing purchases and available subscription/support actions,
including lapsed subscribers. Lifetime buyers should not be described as having
an auto-renewing subscription.

Configure Customer Center in the RevenueCat dashboard, including support and
available management options. Actions vary by store/platform, purchase type, and
project setup. A Test Store purchase does not validate real store cancellation,
refund, or billing-management flows. Dashboard settings were not changed here.

## 9. App Store and Google Play configuration

The native product catalog must be created before a production offering can be
published:

| Store | Product | Store type | RevenueCat package |
| --- | --- | --- | --- |
| App Store | `monthly` | 1-month auto-renewing subscription | `$rc_monthly` |
| App Store | `yearly` | 1-year auto-renewing subscription | `$rc_annual` |
| App Store | `lifetime` | non-consumable | `$rc_lifetime` |
| Google Play | `outthere_pro:monthly` | subscription monthly base plan | `$rc_monthly` |
| Google Play | `outthere_pro:yearly` | subscription yearly base plan | `$rc_annual` |
| Google Play | `lifetime` | one-time non-consumable product | `$rc_lifetime` |

Put the two Apple subscriptions in one **OutThere Pro** subscription group. On
Google Play, keep monthly and yearly as base plans of one subscription so a user
can change plans cleanly. Import all products into RevenueCat, attach all of them
to `outthere_pro`, add each platform product to the matching package in the
`default` offering, and make `default` current. Store review metadata, prices,
territories, tax settings, banking agreements and production SDK keys must be
completed in the respective owner accounts.

## 10. Production subscription management

- Keep RevenueCat as the billing source of truth; do not write a client-controlled
  `is_pro` flag into Supabase and treat it as authorization.
- For premium server endpoints, verify entitlement on your backend using a secret
  RevenueCat key or a webhook-maintained record with idempotent event handling.
  Validate webhook authorization, handle renewals/expiry/refunds/transfers, and
  never expose backend credentials in this app. No premium server endpoints or
  webhook integration are introduced by this change.
- Review RevenueCat restore/transfer behavior for shared store accounts and
  multiple OutThere logins. Test that restoring does not violate your intended
  account ownership policy.
- Do not mark a cancelled-but-unexpired subscription inactive just because
  `willRenew` is false; rely on the active entitlement.
- Test Apple/Google sandbox billing separately before launch. Configure store
  server notifications, products, agreements, and required app metadata.

## 11. Verification

```sh
npm test
npm run typecheck
npx expo export --platform all
npm run ios
```

Automated billing tests cover active/historical entitlements, package selection,
key isolation, purchase success/cancellation/pending approval, duplicate taps,
account changes during purchases, empty restoration, missing offerings, paywall
result verification, and customer-info/Customer Center updates.

The simulator acceptance pass verified all three Test Store products and prices,
paywall dismissal, an empty restore, a valid monthly purchase, immediate
`outthere_pro` activation, unlocked statistics, and Customer Center showing the
active purchase. Automated tests cover cancellation, pending purchases, restore,
expiration/inactive entitlements and account changes without making real charges.
Repeat purchase, cancellation, renewal, expiration, refund and restore in both
Apple Sandbox/TestFlight and Google Play license testing before store submission.

## Official references

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [React Native installation](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [SDK configuration](https://www.revenuecat.com/docs/getting-started/configuring-sdk)
- [Customer identity and custom-ID-only behavior](https://www.revenuecat.com/docs/customers/identifying-customers)
- [Entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)
- [Offerings](https://www.revenuecat.com/docs/offerings/overview)
- [Displaying paywalls](https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls)
- [React Native Customer Center](https://www.revenuecat.com/docs/tools/customer-center/customer-center-react-native)
- [Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store)
