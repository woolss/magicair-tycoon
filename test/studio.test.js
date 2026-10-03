import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseDefaultOutfit, chooseStudio, studioState } from '../src/studio.js';
import { endDay, loadRun, saveRun } from '../src/run.js';

test('старе збереження: студія відкривається після переїзду і не змінює прогрес', () => {
  const run = { day: 23, money: 8000, stock: { pink: 10 }, owned: ['shop'] };
  assert.equal(studioState(run).room, 'default');
  assert.equal(chooseStudio({ ...run, owned: [] }, 'decor-lamp'), null);
  const decorated = chooseStudio(run, 'decor-lamp');
  assert.equal(decorated.money, 7100);
  assert.deepEqual(decorated.owned, run.owned);
  const store = new Map();
  const storage = { getItem: (k) => store.get(k), setItem: (k, v) => store.set(k, v) };
  saveRun(decorated, storage);
  const loaded = loadRun(storage);
  assert.deepEqual(studioState(loaded).decor, ['decor-lamp']);
  assert.deepEqual(endDay(loaded, { moneyAfter: 7200 }, {}).studio, loaded.studio);
});

test('кожен предмет і костюм купується окремо; перемикання не списує гроші', () => {
  let run = { day: 25, money: 10000, stock: {}, owned: ['shop'] };
  run = chooseStudio(run, 'seller-lavender');
  assert.equal(run.money, 8600);
  assert.equal(studioState(run).helper, 'default');
  run = chooseStudio(run, 'helper-sunshine');
  assert.equal(run.money, 7000);
  run = chooseStudio(run, 'decor-gifts');
  assert.deepEqual(studioState(run).decor, ['decor-gifts']);
  assert.equal(run.money, 6300);
  run = chooseStudio(run, 'decor-plant');
  assert.deepEqual(studioState(run).decor, ['decor-gifts', 'decor-plant']);
  run = chooseStudio(run, 'decor-gifts');
  assert.deepEqual(studioState(run).decor, ['decor-plant']);
  assert.equal(run.money, 5500);
  run = chooseDefaultOutfit(run, 'seller');
  assert.equal(studioState(run).seller, 'default');
  run = chooseStudio(run, 'seller-lavender');
  assert.equal(run.money, 5500);
  assert.equal(chooseStudio(run, 'room-lavender')?.money, 2500);
  assert.equal(chooseStudio(run, 'room-peach')?.money, 2000);
  assert.equal(chooseStudio({ ...run, money: 100 }, 'room-peach'), null);
});
