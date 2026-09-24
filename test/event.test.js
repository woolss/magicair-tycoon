import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG as cfg } from '../src/config.js';
import { makeRng } from '../src/logic.js';
import { makeBooking, EventShift, fillOrder, bookingShort } from '../src/event.js';

const OWNED = ['pump2', 'pump3', 'confetti', 'foil', 'shop', 'digits', 'car'];
const FULL = { pink: 50, blue: 50, yellow: 50, confetti: 50, heart: 50, star: 50, digit: 20 };

function inflateTie(ev, key) {
  ev.pick(key); ev.startInflate(); ev.update(0.7 * ev.p.fullSec); ev.release(); return ev.tie();
}

test('виїзд: бронь — симетрична схема, оплата, час', () => {
  const rng = makeRng(3);
  for (let i = 0; i < 30; i++) {
    const b = makeBooking(cfg, rng, OWNED, 10, i % 3);
    const n = b.slots.length;
    assert.equal(n, cfg.event.sizes[i % 3]);
    for (let j = 0; j < n; j++) if (b.slots[j] !== 'digit') assert.equal(b.slots[j], b.slots[n - 1 - j]);
    assert.equal(Object.values(b.need).reduce((a, x) => a + x, 0), n);
    assert.ok(b.pay >= n * cfg.event.payPerBalloon);
    assert.ok(Number.isInteger(b.pay) && Number.isInteger(b.timeSec));
  }
  assert.deepEqual(fillOrder(5), [0, 4, 1, 3, 2]);
});

test('виїзд: кулька летить на своє місце, зайва — у мінус, все зібрав — 3★', () => {
  const b = makeBooking(cfg, makeRng(1), OWNED, 10, 0);
  const ev = new EventShift(cfg, b, { owned: OWNED, stock: FULL });
  const extra = ['pink', 'blue', 'yellow', 'confetti'].find((k) => !b.need[k]);
  for (const [k, n] of Object.entries(b.need)) for (let i = 0; i < n; i++) inflateTie(ev, k);
  assert.ok(ev.over);
  const end = ev.drainEvents().find((e) => e.type === 'end').result;
  assert.equal(end.done, true);
  assert.equal(end.stars, 3);
  assert.equal(end.pay, b.pay);
  assert.equal(end.tip, Math.round(b.pay * cfg.event.tipMul));
  // зайвий колір — не ставиться нікуди
  const ev2 = new EventShift(cfg, b, { owned: OWNED, stock: FULL });
  if (extra) { inflateTie(ev2, extra); assert.equal(ev2.stats.wasted, 1); assert.equal(ev2.stats.placed, 0); }
});

test('виїзд: не встиг — платять частку, 1★; склад списується', () => {
  const b = makeBooking(cfg, makeRng(2), OWNED, 10, 1);
  const ev = new EventShift(cfg, b, { owned: OWNED, stock: FULL });
  const k = b.slots[0];
  inflateTie(ev, k);
  ev.update(b.timeSec);
  const end = ev.drainEvents().find((e) => e.type === 'end').result;
  assert.equal(end.done, false);
  assert.equal(end.stars, 1);
  assert.equal(end.pay, Math.round((b.pay * cfg.event.partialMul) / b.slots.length));
  assert.equal(ev.stock[k], FULL[k] - 1);
  assert.deepEqual(bookingShort(b, {}).length, Object.keys(b.need).length);
});
