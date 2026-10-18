import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebBillingAdapter } from '../src/features/subscriptions/web-adapter.ts';
import { selectWebBillingKey } from '../src/features/subscriptions/config.ts';
import { BillingController } from '../src/features/subscriptions/controller.ts';
import { hasPro } from '../src/features/subscriptions/model.ts';

const info = active => ({ entitlements: { active: active ? { outthere_pro: { isActive: true } } : {}, all: {} } });
const config = selectWebBillingKey('test', 'test_public');
const settle = async controller => {
  for (let i = 0; i < 50 && controller.state.busy; i++) await new Promise(setImmediate);
  assert.equal(controller.state.busy, false);
};
function fixture() {
  let userId = null, fail = false, loads = 0;
  const users = new Map([['a', info(true)], ['b', info(false)]]);
  const sdk = {
    isConfigured: async () => userId !== null,
    configure: options => { assert.equal(options.apiKey, 'test_public'); userId = options.appUserID; },
    getAppUserID: async () => userId,
    logIn: async id => { userId = id; },
    getCustomerInfo: async () => { if (fail) throw new Error('private service details'); return users.get(userId); },
  };
  const adapter = createWebBillingAdapter(config, async () => { loads++; return sdk; });
  return { adapter, controller: new BillingController(adapter), get loads() { return loads; }, setFail: value => { fail = value; } };
}

test('web status accepts public web/test keys and rejects native or secret keys', () => {
  assert.equal(config.error, null);
  assert.equal(selectWebBillingKey('store', undefined, 'rcb_public').key, 'rcb_public');
  for (const key of [undefined, 'appl_public', 'goog_public', 'sk_secret', 'test_public']) {
    assert.ok(selectWebBillingKey('store', undefined, key).error);
  }
  assert.ok(selectWebBillingKey('test', 'sk_secret').error);
});

test('SSR and signed-out construction do not load or configure the web SDK', () => {
  const f = fixture();
  f.controller.setUser(null);
  assert.equal(f.loads, 0);
});

test('web loads the mobile entitlement for the same signed-in ID without offerings', async () => {
  const { controller } = fixture();
  controller.setUser('a'); await settle(controller);
  assert.equal(controller.state.ready, true);
  assert.equal(hasPro(controller.state.customerInfo), true);
  assert.equal(controller.state.offering, null);
  assert.equal(controller.state.error, null);
});

test('web account changes and sign-out clear previous membership', async () => {
  const { controller } = fixture();
  controller.setUser('a'); await settle(controller);
  controller.setUser('b');
  assert.equal(controller.state.customerInfo, null);
  await settle(controller);
  assert.equal(controller.state.ready, true);
  assert.equal(hasPro(controller.state.customerInfo), false);
  controller.setUser(null);
  assert.equal(controller.state.customerInfo, null);
});

test('web network errors preserve known access and refresh recovers', async () => {
  const { controller, setFail } = fixture();
  controller.setUser('a'); await settle(controller);
  setFail(true); await controller.refresh();
  assert.equal(hasPro(controller.state.customerInfo), true);
  assert.match(controller.state.error, /membership status/);
  assert.doesNotMatch(controller.state.error, /private/);
  setFail(false); await controller.refresh();
  assert.equal(controller.state.error, null);
});

test('web initial fetch failures can be retried without inventing inactive status', async () => {
  const { controller, setFail } = fixture();
  setFail(true); controller.setUser('a'); await settle(controller);
  assert.equal(controller.state.ready, false);
  assert.equal(controller.state.customerInfo, null);
  assert.match(controller.state.error, /membership status/);
  setFail(false); await controller.refresh();
  assert.equal(hasPro(controller.state.customerInfo), true);
});

test('web purchase, restore, paywall and management entry points remain blocked', async () => {
  const { adapter, controller } = fixture();
  controller.setUser('a'); await settle(controller);
  await controller.purchase({}); await controller.restore(); await controller.presentPaywall();
  await controller.cancelSubscription(); await controller.customerCenter();
  assert.equal(controller.state.error, null);
  assert.equal(hasPro(controller.state.customerInfo), true);
  for (const action of ['purchase', 'restore', 'paywall', 'customerCenter', 'manageSubscription']) {
    await assert.rejects(adapter[action]({}), /iOS or Android/);
  }
});

test('missing web configuration never loads the SDK or leaves a request running', async () => {
  let loaded = false;
  const adapter = createWebBillingAdapter(selectWebBillingKey('store'), async () => { loaded = true; throw new Error(); });
  const controller = new BillingController(adapter);
  controller.setUser('a'); await controller.refresh();
  assert.ok(adapter.unavailable);
  assert.equal(loaded, false);
  assert.equal(controller.state.busy, false);
});
