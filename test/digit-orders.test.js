import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Shift, bundleCovers } from '../src/logic.js';
import { CONFIG } from '../src/config.js';
const setup = () => {
  const s = new Shift(CONFIG, { owned: ['foil', 'shop', 'digits'], stock: { digit: 10, pink: 10 } });
  s.customers[0] = { id: 1, age: 1, order: { digit: 1 }, seatedAt: 0 };
  return s;
};
test('one birthday order sets the number and keeps it through tying and sale', () => {
  const s = setup(); s.pick('digit'); assert.equal(s.nozzle.age, 1);
  assert.equal(s.startInflate(), true); s.nozzle.state = 'ready'; s.nozzle.quality = 'perfect';
  s.tie(); assert.equal(s.bundle[0].age, 1); assert.ok(s.give(0));
  assert.equal(s.drainEvents().find(e => e.type === 'sale').age, 1);
});
test('different ages require a choice before spending helium; an inflated digit is immutable', () => {
  const s = setup(); s.customers[1] = { id: 2, age: 8, order: { digit: 1 }, seatedAt: 0 };
  s.pick('digit'); const helium = s.helium;
  assert.equal(s.startInflate(), false); assert.equal(s.helium, helium);
  assert.equal(s.selectDigitCustomer(1), true); assert.equal(s.nozzle.age, 8);
  assert.equal(s.startInflate(), true); s.selectDigitCustomer(0); assert.equal(s.nozzle.age, 8);
});
test('delivery takes only the requested digit and leaves the other number on the counter', () => {
  const s = setup(); s.bundle = [{ key: 'digit', quality: 'perfect', age: 8 }];
  assert.equal(bundleCovers(s.customers[0].order, s.bundle, 1), false); assert.equal(s.give(0), null);
  s.bundle.push({ key: 'digit', quality: 'perfect', age: 1 });
  assert.ok(s.give(0)); assert.equal(s.bundle.length, 1); assert.equal(s.bundle[0].age, 8);
});
test('departed or helper-served customer does not keep the next digit selected', () => {
  const s = setup(); s.selectDigitCustomer(0); s.customers[0] = null;
  s.customers[1] = { id: 2, age: 4, order: { digit: 1 }, seatedAt: 0 };
  s.pick('digit'); assert.equal(s.nozzle.age, 4);
  s.customers[2] = { id: 3, age: 9, order: { digit: 1 }, helper: true };
  assert.equal(s.digitAge(), 4);
});
