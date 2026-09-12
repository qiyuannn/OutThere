import test from 'node:test';
import assert from 'node:assert/strict';
import { BillingController } from '../src/features/subscriptions/controller.ts';
import { availablePlans, hasPro, billingError } from '../src/features/subscriptions/model.ts';
import { selectBillingKey } from '../src/features/subscriptions/config.ts';
const info = (active = false) => ({ entitlements: { active: active ? { outthere_pro: { isActive: true } } : {}, all: {} } });
const pkg = { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { identifier: 'monthly', priceString: '$4.99' } };
const offering = { identifier: 'default', availablePackages: [pkg] };
const settle = async c => { for (let i=0; i<50 && c.state.busy; i++) await new Promise(setImmediate); assert.equal(c.state.busy, false); };
function fixture(overrides = {}) {
  let callback, current = info(); const identities = [];
  const sdk = { unavailable: null, testStore: true, identify: async id => { identities.push(id); }, customerInfo: async () => current,
    offerings: async () => offering, purchase: async () => info(true), restore: async () => info(true), paywall: async () => 'CANCELLED', customerCenter: async () => {},
    listen: fn => { callback = fn; return () => { callback = undefined; }; }, ...overrides };
  const c = new BillingController(sdk);
  return { c, identities, setInfo: next => { current = next; }, emit: () => callback?.() };
}
test('only active outthere_pro grants access, never historical products or another entitlement', () => {
  assert.equal(hasPro(null), false); assert.equal(hasPro(info()), false); assert.equal(hasPro(info(true)), true);
  assert.equal(hasPro({entitlements:{active:{other:{isActive:true},outthere_pro:{isActive:false}}}}), false);
});
test('maps standard annual/monthly/lifetime packages without requiring product IDs in UI', () => {
  assert.equal(availablePlans(offering)[0].id,'monthly');
  assert.equal(availablePlans({availablePackages:[{...pkg,packageType:'ANNUAL'}]})[0].id,'yearly');
  assert.equal(availablePlans(null).length,0);
});
test('test key is restricted to development, store keys are platform-specific, web stays unsupported', () => {
  assert.equal(selectBillingKey('ios',true,'test','test_public').key,'test_public');
  assert.ok(selectBillingKey('ios',false,'test','test_public').error);
  assert.ok(selectBillingKey('android',false,'store',undefined,'appl_key','test_key').error);
  assert.equal(selectBillingKey('ios',false,'store',undefined,'appl_key','goog_key').key,'appl_key');
  assert.ok(selectBillingKey('web',true,'test','test_public').error);
});
test('initializes signed-in customer, reads offerings, and updates after purchase', async () => {
  const {c,identities} = fixture(); c.setUser('user-a'); await settle(c);
  assert.equal(c.state.ready,true); assert.equal(c.state.offering.identifier,'default');
  await c.purchase(pkg); assert.equal(hasPro(c.state.customerInfo),true); assert.equal(identities[0],'user-a');
});
test('duplicate purchase taps are ignored while a store request is open', async () => {
  let complete, count=0;
  const {c}=fixture({purchase:()=>{count++;return new Promise(resolve=>{complete=resolve;});}});
  c.setUser('a');await settle(c);const first=c.purchase(pkg);await new Promise(setImmediate);
  await c.purchase(pkg);assert.equal(count,1);complete(info(true));await first;
});
test('sign-out clears Pro immediately and old purchase results cannot grant a new user access', async () => {
  let complete;
  const {c,identities}=fixture({purchase:()=>new Promise(resolve=>{complete=resolve;})});
  c.setUser('a');await settle(c);const first=c.purchase(pkg);await new Promise(setImmediate);
  c.setUser(null);assert.equal(c.state.customerInfo,null);c.setUser('b');
  complete(info(true));await first;await settle(c);
  assert.equal(c.state.userId,'b');assert.equal(hasPro(c.state.customerInfo),false);assert.equal(identities.at(-1),'b');
});
test('cancellation is quiet, pending payment does not grant access, and internal errors are not exposed', async () => {
  for (const code of ['1','20']) {
    const {c}=fixture({purchase:async()=>{throw {code,message:'internal secret'};}});
    c.setUser('a');await settle(c);await c.purchase(pkg);
    assert.equal(hasPro(c.state.customerInfo),false);
    if(code==='1')assert.equal(c.state.error,null);else assert.match(c.state.error,/pending/);
  }
  assert.doesNotMatch(billingError(new Error('internal secret')),/secret/);
});
test('restoration without entitlement reports no active purchase', async () => {
  const {c}=fixture({restore:async()=>info()});c.setUser('a');await settle(c);await c.restore();
  assert.equal(hasPro(c.state.customerInfo),false);assert.match(c.state.message,/No active/);
});
test('paywall success does not unlock access unless CustomerInfo confirms it', async () => {
  const {c}=fixture({paywall:async()=> 'PURCHASED'});c.setUser('a');await settle(c);await c.presentPaywall();
  assert.equal(hasPro(c.state.customerInfo),false);assert.match(c.state.message,/isn’t active yet/);
});
test('offering errors do not erase known entitlement and restore still works', async () => {
  const {c}=fixture({customerInfo:async()=>info(true),offerings:async()=>{throw {code:'23'};}});
  c.setUser('a');await settle(c);assert.equal(c.state.ready,true);assert.equal(hasPro(c.state.customerInfo),true);
  await c.restore();assert.match(c.state.message,/restored/);
});
test('customer updates and Customer Center dismissal refresh entitlement', async () => {
  const {c,setInfo,emit}=fixture();c.setUser('a');await settle(c);
  setInfo(info(true));emit();await settle(c);assert.equal(hasPro(c.state.customerInfo),true);
  setInfo(info());await c.customerCenter();assert.equal(hasPro(c.state.customerInfo),false);
});
