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

test('реклама — лише після цифр; продавець II — після другого продавця; балон 10 с', () => {
  const run = { money: 99999, owned: ['foil', 'shop'] };
  assert.equal(upgradeState(cfg, run, 'ads'), 'locked');
  assert.equal(upgradeState(cfg, { ...run, owned: [...run.owned, 'digits'] }, 'ads'), 'available');
  assert.equal(upgradeState(cfg, run, 'helper2'), 'locked');
  assert.equal(cfg.helium.refillSec, 10);
});
