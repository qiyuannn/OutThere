import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { getRoutes } = require('expo-router/build/getRoutes');
const { StackRouter, StackActions } = require('expo-router/build/react-navigation/routers/StackRouter');

// Use Expo's route discovery against the actual app files without mounting screens.
const context = () => ({ default: () => null });
context.keys = () => readdirSync(new URL('../src/app', import.meta.url), { recursive: true })
  .filter((path) => path.endsWith('.tsx'))
  .map((path) => `./${path}`);

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: subpage Back preserves its originating tab and nested history`, () => {
    const root = getRoutes(context, { platform, ignoreEntryPoints: true });
    const main = root.children.find((route) => route.route === '(main)');
    const names = main.children.map((route) => route.route);
    const options = { routeNames: names, routeParamList: {}, routeGetIdList: {} };
    const router = StackRouter({ initialRouteName: '(tabs)' });

    for (const [tab, pages] of [
      ['rankings', ['search/[id]', 'search/profile/[id]', 'search/profile/statistics']],
      ['search', ['search/results', 'search/[id]', 'rankings/post']],
      ['profile', ['profile/activities', 'profile/comments', 'search/profile/[id]']],
      ['(discover)', ['bucket-list/[id]', 'profile/subscription']],
      ['bucket-list', ['notifications', 'rankings/comments', 'search/[id]']],
      ['profile', ['profile/edit']],
    ]) {
      let state = router.getInitialState(options);
      state.routes[0].state = { index: 0, routes: [{ name: tab, key: tab, params: { filter: 'saved' } }] };
      const history = [];
      for (const [index, page] of pages.entries()) {
        assert.ok(names.includes(page), `${page} must share the stack with the tabs`);
        history.push(state);
        state = router.getStateForAction(state, StackActions.push(page, { id: String(index) }), options);
        assert.equal(state.routes[state.index].name, page);
      }
      for (const previous of history.reverse()) {
        state = router.getStateForAction(state, { type: 'GO_BACK' }, options);
        assert.deepEqual(state.routes, previous.routes);
        assert.equal(state.index, previous.index);
      }
    }
  });
}
