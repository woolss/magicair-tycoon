// Правки за фідбеком: продавець II, помічник чекає, поки клієнт дійде, реклама після цифр, баллон 10 с
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG as cfg } from '../src/config.js';
import { Shift, deriveParams, makeRng } from '../src/logic.js';
import { upgradeState } from '../src/run.js';

const mk = (owned) => new Shift(cfg, { rng: makeRng(3), owned, stock: { pink: 20, blue: 20, yellow: 20, heart: 10, star: 10 } });

test('продавець II: замовлення до 5 кульок, зарплата 110', () => {
  const p = deriveParams(cfg, ['foil', 'shop', 'helper', 'helper2']);
  assert.equal(p.helperMax, 5);
  assert.equal(p.salary, cfg.salary + 110);
  assert.equal(deriveParams(cfg, ['foil', 'shop', 'helper']).helperMax, 3);
  const s = mk(['foil', 'shop', 'helper', 'helper2']);
  s.nextArrival = Infinity;
  s.customers[0] = { id: 90, order: { pink: 2, star: 3 }, arrivedAt: 0, seatedAt: 0, slot: 0 };
  s.update(0.1);
  assert.ok(s.customers[0].helper);
});

test('помічник не бере клієнта, поки той іде до прилавка', () => {
  const s = mk(['foil', 'shop', 'helper']);
  s.waitWalk = true;
  s.nextArrival = Infinity;
  s.queue.push({ id: 91, order: { pink: 1 }, arrivedAt: 0 });
  s.update(0.1);
  const c = s.customers.find(Boolean);
  assert.ok(c && c.walking && !c.helper);
  c.walking = false;                  // дійшов
  s.update(0.1);
  assert.ok(c.helper);
});

test('після видачі замовлення помічниця чекає дві секунди', () => {
  const s = mk(['shop', 'helper']);
  s.nextArrival = Infinity;
  s.customers[0] = { id: 1, order: { blue: 1 }, seatedAt: 0 };
  s.customers[1] = { id: 2, order: { pink: 2 }, seatedAt: 0 };
  s.update(0.1);
  assert.equal(s.helper.cust.id, 1);
  s.update(cfg.helper.serveSec);
  assert.equal(s.helper.cust, null);
  s.update(1.99);
  assert.equal(s.helper.cust, null);
  s.update(0.01);
  assert.equal(s.helper.cust.id, 2);
});

test('помічниця може взяти інше замовлення, поки гравець збирає своє', () => {
  const s = mk(['shop', 'helper']);
  s.nextArrival = Infinity;
  s.customers[0] = { id: 1, order: { pink: 2 }, seatedAt: 0 };
  s.customers[1] = { id: 2, order: { yellow: 1 }, seatedAt: 1 };
  s.bundle.push({ key: 'pink', quality: 'perfect' });
  s.update(0.1);
  assert.equal(s.helper.cust.id, 2);
  assert.equal(s.customers[0].helper, undefined);
});

test('помічниця не забирає замовлення, для якого гравець уже готує кульку', () => {
  const s = mk(['shop', 'helper']);
  s.nextArrival = Infinity;
  s.customers[0] = { id: 1, order: { blue: 1 }, seatedAt: 0 };
  s.customers[1] = { id: 2, order: { pink: 2 }, seatedAt: 0 };
  s.update(0.1);
  assert.equal(s.helper.cust.id, 1);
  s.pick('pink');
  s.update(cfg.helper.serveSec);
  s.update(cfg.helper.pauseSec);
  assert.equal(s.helper.cust, null); // кулька на соплі
  s.nozzle = null;
  s.bundle.push({ key: 'pink', quality: 'perfect' });
  s.update(0.1);
  assert.equal(s.helper.cust, null); // кулька у зв'язці
  s.discardAll();
  s.update(0.1);
  assert.equal(s.helper.cust.id, 2);
});

test('цифра захищає тільки замовлення з таким самим віком', () => {
  const s = mk(['shop', 'helper']);
  s.nozzle = { key: 'digit', age: 7 };
  assert.equal(s.playerMatch({ order: { digit: 1 }, age: 7 }), 1);
  assert.equal(s.playerMatch({ order: { digit: 1 }, age: 2 }), 0);
});

test('один вибраний клієнт захищений, інших із такими ж кульками бере помічниця', () => {
  const s = mk(['shop', 'helper']);
  s.nextArrival = Infinity;
  s.customers[0] = { id: 1, order: { blue: 1 }, seatedAt: 0 };
  s.customers[1] = { id: 2, order: { pink: 2 }, seatedAt: 1 };
  s.customers[2] = { id: 3, order: { pink: 1 }, seatedAt: 2 };
  s.update(0.1);
  s.pick('pink');
  s.update(cfg.helper.serveSec);
  s.update(cfg.helper.pauseSec);
  assert.equal(s.playerTargetId, 2); // автоматично обране старше замовлення
  assert.equal(s.helper.cust.id, 3);
});

test('тап на замовлення вибирає саме його навіть серед однакових', () => {
  const s = mk(['shop', 'helper']);
  s.nextArrival = Infinity;
  s.customers[0] = { id: 1, order: { blue: 1 }, seatedAt: 0 };
  s.customers[1] = { id: 2, order: { pink: 2 }, seatedAt: 1 };
  s.customers[2] = { id: 3, order: { pink: 1 }, seatedAt: 2 };
  s.update(0.1);
  assert.equal(s.selectTarget(2), true);
  s.pick('pink');
  s.update(cfg.helper.serveSec);
  s.update(cfg.helper.pauseSec);
  assert.equal(s.playerTargetId, 3);
  assert.equal(s.helper.cust.id, 2);
});

test('реклама — лише після цифр; продавець II — після другого продавця; балон 10 с', () => {
  const run = { money: 99999, owned: ['foil', 'shop'] };
  assert.equal(upgradeState(cfg, run, 'ads'), 'locked');
  assert.equal(upgradeState(cfg, { ...run, owned: [...run.owned, 'digits'] }, 'ads'), 'available');
  assert.equal(upgradeState(cfg, run, 'helper2'), 'locked');
  assert.equal(cfg.helium.refillSec, 10);
});
