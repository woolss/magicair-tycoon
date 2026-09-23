import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { Shift, makeRng, bundleMatches, gradeFill, summarize, heliumCost, starsFor } from '../src/logic.js';

const cfg = CONFIG;

function inflateTo(s, fill) {
  s.startInflate();
  s.update(fill * cfg.pump.fullSec);
  return s.release();
}

test('надування: недодув / ідеально / лопнула', () => {
  assert.equal(gradeFill(cfg, 0.3), 'under');
  assert.equal(gradeFill(cfg, 0.7), 'perfect');
  assert.equal(gradeFill(cfg, 0.9), 'popped');
  const s = new Shift(cfg, { rng: makeRng(1) });
  s.pick('pink');
  assert.equal(inflateTo(s, 0.7), 'perfect');
  s.tie();
  s.pick('blue');
  assert.equal(inflateTo(s, 0.95), 'popped');
  assert.equal(s.nozzle, null);
  assert.equal(s.stats.popped, 1);
});

test('перетримав до 1.0 — лопається сама', () => {
  const s = new Shift(cfg, { rng: makeRng(1) });
  s.pick('pink'); s.startInflate();
  s.update(cfg.pump.fullSec + 0.1);
  assert.equal(s.nozzle, null);
  assert.equal(s.stats.popped, 1);
});

test('зв\'язка має збігтися з замовленням точно', () => {
  assert.ok(bundleMatches({ pink: 2, blue: 1 }, [{ color: 'pink' }, { color: 'blue' }, { color: 'pink' }]));
  assert.ok(!bundleMatches({ pink: 2 }, [{ color: 'pink' }]));
  assert.ok(!bundleMatches({ pink: 1 }, [{ color: 'pink' }, { color: 'blue' }]));
});

test('продаж: ціна, недодув дешевше, чайові за швидкість', () => {
  const s = new Shift(cfg, { rng: makeRng(3) });
  s.update(cfg.customers.firstAtSec);
  const cust = s.customers[0];
  assert.ok(cust);
  let under = true;
  for (const [color, n] of Object.entries(cust.order)) {
    for (let i = 0; i < n; i++) {
      s.pick(color);
      inflateTo(s, under ? 0.4 : 0.7); // перша недодута
      under = false;
      s.tie();
    }
  }
  const total = Object.values(cust.order).reduce((a, b) => a + b, 0);
  const expected = (total - 1) * 15 + Math.round(15 * cfg.inflate.underSellMul);
  const r = s.give(0);
  assert.equal(r.value, expected);
  assert.equal(r.tip, Math.round(expected * cfg.customers.tipMul));
  assert.equal(s.stats.served, 1);
  assert.equal(s.bundle.length, 0);
});

test('не та зв\'язка — продажу немає', () => {
  const s = new Shift(cfg, { rng: makeRng(3) });
  s.update(cfg.customers.firstAtSec);
  const wrong = Object.keys(cfg.colors).find((c) => !s.customers[0].order[c]) || 'pink';
  s.pick(wrong); inflateTo(s, 0.7); s.tie();
  if (bundleMatches(s.customers[0].order, s.bundle)) return; // рідкісний збіг
  assert.equal(s.give(0), null);
  assert.equal(s.stats.served, 0);
});

test('клієнт іде, коли терпіння скінчилось', () => {
  const s = new Shift(cfg, { rng: makeRng(5) });
  s.update(cfg.customers.firstAtSec);
  const id = s.customers[0].id;
  s.update(cfg.customers.patienceSec + 0.01);
  assert.ok(!s.customers.some((c) => c && c.id === id));
  assert.ok(s.stats.lost >= 1);
});

test('гелій: закінчився → 15 с чекаєш, потім повний балон', () => {
  const s = new Shift(cfg, { rng: makeRng(7) });
  s.helium = 1;
  s.pick('pink');
  assert.ok(s.startInflate());
  assert.equal(s.helium, 0);
  assert.equal(s.refillLeft, cfg.helium.refillSec);
  s.update(0.5 * cfg.pump.fullSec); s.release(); s.tie();
  s.pick('pink');
  assert.equal(s.startInflate(), false);
  s.update(cfg.helium.refillSec);
  assert.equal(s.helium, cfg.helium.tank);
  assert.ok(s.startInflate());
});

test('підсумок: цілі числа, оренда, у мінус не йдемо', () => {
  assert.equal(heliumCost(cfg, 100), 120);
  assert.equal(heliumCost(cfg, 7), 8);
  const bad = summarize(cfg, { revenue: 0, tips: 0, served: 0, lost: 5, popped: 3, balloonsBought: 3, heliumUsed: 3 }, 10);
  assert.equal(bad.rent, 40);
  assert.equal(bad.moneyAfter, 0);
  const ok = summarize(cfg, { revenue: 300, tips: 20, served: 10, lost: 0, popped: 0, balloonsBought: 20, heliumUsed: 20 }, 300);
  assert.equal(ok.profit, 300 + 20 - 100 - 24 - 40);
  assert.equal(ok.moneyAfter, 456);
  assert.ok(Number.isInteger(ok.profit));
  assert.equal(starsFor(cfg, 9, 1), 3);
  assert.equal(starsFor(cfg, 7, 3), 2);
  assert.equal(starsFor(cfg, 1, 3), 1);
});

test('зміна закінчується за таймером', () => {
  const s = new Shift(cfg, { rng: makeRng(9) });
  for (let i = 0; i < 1900; i++) s.update(0.1);
  assert.ok(s.over);
  assert.ok(s.drainEvents().some((e) => e.type === 'end'));
});

// Бот-гравець: грає цілу зміну — перевіряємо, що дохід близький до симулятора (~300 за день 1)
test('бот-гравець: прибуток дня 1 у розумних межах', () => {
  const profits = [];
  for (let seed = 1; seed <= 20; seed++) {
    const s = new Shift(cfg, { rng: makeRng(seed) });
    const dt = 0.05;
    let busy = 0; // «час на рух пальця» між діями
    let target = null;
    while (!s.over) {
      s.update(dt);
      if ((busy -= dt) > 0) continue;
      if (s.nozzle?.state === 'inflating') {
        if (s.nozzle.fill >= 0.7) { s.release(); busy = 0.15; }
        continue;
      }
      if (s.nozzle?.state === 'ready') { s.tie(); busy = 0.3; continue; }
      if (!target || !s.customers.includes(target)) {
        target = s.customers.filter(Boolean).sort((a, b) => a.arrivedAt - b.arrivedAt)[0] || null;
        if (target && s.bundle.length) { s.bundle.length = 0; }
      }
      if (!target) continue;
      const need = { ...target.order };
      for (const b of s.bundle) need[b.color]--;
      const next = Object.keys(need).find((k) => need[k] > 0);
      if (next && !s.nozzle) { s.pick(next); busy = 0.4; continue; }
      if (s.nozzle?.state === 'empty') { if (s.startInflate()) continue; }
      if (!next) { s.give(target.slot); target = null; busy = 0.4; }
    }
    profits.push(summarize(cfg, s.stats, 300).profit);
  }
  profits.sort((a, b) => a - b);
  const med = profits[10];
  console.log('    прибуток дня 1 (бот), медіана:', med, 'мін:', profits[0], 'макс:', profits[19]);
  assert.ok(med > 150 && med < 600, `медіана ${med}`);
  assert.ok(profits[0] > 0);
});
