import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG as cfg } from '../src/config.js';
import { Shift, makeRng } from '../src/logic.js';
import { makeBooking, EventShift } from '../src/event.js';

const FULL = { pink: 50, blue: 50, yellow: 50, confetti: 50, heart: 50, star: 50, digit: 20 };

test('обрав не ту кульку — поки не почав дути, можна взяти іншу', () => {
  const s = new Shift(cfg, { rng: makeRng(1), stock: FULL });
  assert.ok(s.pick('pink'));
  assert.ok(s.pick('blue'));                 // передумав
  assert.equal(s.nozzle.key, 'blue');
  assert.equal(s.stock.pink, FULL.pink);     // рожева повернулась на полицю
  assert.equal(s.stock.blue, FULL.blue - 1);
  s.startInflate(); s.update(0.3 * s.p.fullSec); s.release();   // недодута — гелій уже витрачено
  assert.equal(s.pick('pink'), false);       // тепер не поміняєш
});

test('виїзд: так само можна поміняти колір до надування', () => {
  const owned = ['confetti', 'foil', 'shop', 'digits', 'helper', 'car'];
  const ev = new EventShift(cfg, makeBooking(cfg, makeRng(4), owned, 5, 0), { owned, stock: FULL });
  assert.ok(ev.pick('pink'));
  assert.ok(ev.pick('yellow'));
  assert.equal(ev.nozzle.key, 'yellow');
  assert.equal(ev.stock.pink, FULL.pink);
});
