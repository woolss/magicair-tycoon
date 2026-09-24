import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { Shift, makeRng, bundleMatches, bundleCovers, gradeFill, summarize, heliumCost, starsFor, deriveParams, makeOrder } from '../src/logic.js';
import { newRun, buyStock, buyUpgrade, upgradeState, endDay, loadRun, saveRun, clearRun } from '../src/run.js';

const cfg = CONFIG;
const ALL = cfg.upgrades.map((u) => u.id);
const FULL = { pink: 50, blue: 50, yellow: 50, confetti: 50, heart: 50, star: 50 };
const shift = (seed, opts = {}) => new Shift(cfg, { rng: makeRng(seed), stock: FULL, ...opts });

function inflateTo(s, fill) {
  s.startInflate();
  s.update(fill * s.p.fullSec);
  return s.release();
}

test('надування: недодув / ідеально / лопнула', () => {
  const p = deriveParams(cfg, []);
  assert.equal(gradeFill(p, 0.3), 'under');
  assert.equal(gradeFill(p, 0.7), 'perfect');
  assert.equal(gradeFill(p, 0.9), 'popped');
  const s = shift(1);
  s.pick('pink');
  assert.equal(inflateTo(s, 0.7), 'perfect');
  s.tie();
  s.pick('blue');
  assert.equal(inflateTo(s, 0.95), 'popped');
  assert.equal(s.nozzle, null);
  assert.equal(s.stats.popped, 1);
  assert.equal(s.stats.poppedValue, 5 + heliumCost(cfg, 1));
});

test('перетримав до 1.0 — лопається сама', () => {
  const s = shift(1);
  s.pick('pink'); s.startInflate();
  s.update(s.p.fullSec + 0.1);
  assert.equal(s.nozzle, null);
  assert.equal(s.stats.popped, 1);
});

test('насос швидший — зелене вікно в секундах не менше', () => {
  const win = (owned) => { const p = deriveParams(cfg, owned); return (p.greenMax - p.greenMin) * p.fullSec; };
  const base = win([]);
  assert.ok(Math.abs(win(['pump2']) - base) < 0.02);
  assert.ok(Math.abs(win(['pump2', 'pump3']) - base) < 0.02);
  assert.ok(deriveParams(cfg, ['pump2']).fullSec < deriveParams(cfg, []).fullSec);
});

test('апгрейди: вивіска — частіше клієнти, балон 200, товари відкриваються', () => {
  const p0 = deriveParams(cfg, []);
  assert.deepEqual(p0.open, ['pink', 'blue', 'yellow']);
  const p = deriveParams(cfg, ALL);
  assert.equal(p.gapSec, cfg.customers.baseGapSec / 1.15);
  assert.equal(p.tank, 200);
  assert.deepEqual(p.open, ['pink', 'blue', 'yellow', 'confetti', 'heart', 'star', 'digit']);
  // замовлення з закритим асортиментом — лише латекс
  const rng = makeRng(4);
  for (let i = 0; i < 50; i++) {
    const o = makeOrder(cfg, rng, p0.open);
    assert.ok(Object.keys(o).every((k) => p0.open.includes(k)));
  }
});

test('зв\'язка має збігтися з замовленням точно', () => {
  assert.ok(bundleMatches({ pink: 2, heart: 1 }, [{ key: 'pink' }, { key: 'heart' }, { key: 'pink' }]));
  assert.ok(!bundleMatches({ pink: 2 }, [{ key: 'pink' }]));
  assert.ok(!bundleMatches({ pink: 1 }, [{ key: 'pink' }, { key: 'blue' }]));
});

test('продаж: ціна, чайові за швидкість', () => {
  const s = shift(3);
  s.update(cfg.customers.firstAtSec);
  const cust = s.customers[0];
  assert.ok(cust);
  for (const [key, n] of Object.entries(cust.order)) {
    for (let i = 0; i < n; i++) { s.pick(key); inflateTo(s, 0.7); s.tie(); }
  }
  const total = Object.values(cust.order).reduce((a, b) => a + b, 0);
  const expected = total * 15;
  const r = s.give(0);
  assert.equal(r.value, expected);
  assert.equal(r.tip, Math.round(expected * cfg.customers.tipMul));
  assert.equal(s.stats.served, 1);
  assert.equal(s.bundle.length, 0);
});

test('фольга: дорожча, 3 од. гелію', () => {
  const s = shift(3, { owned: ['foil'] });
  s.pick('heart');
  assert.equal(inflateTo(s, 0.7), 'perfect');
  assert.equal(s.helium, 100 - 3);
  s.tie();
  s.customers[0] = { id: 99, order: { heart: 1 }, arrivedAt: s.t, slot: 0 };
  assert.equal(s.give(0).value, 55);
});

test('склад: кулька береться зі складу, пусто — не взяти', () => {
  const s = new Shift(cfg, { rng: makeRng(1), stock: { pink: 1 } });
  assert.equal(s.stock.blue, 0);
  assert.ok(s.pick('pink'));
  assert.equal(s.stock.pink, 0);
  inflateTo(s, 0.7); s.tie();
  assert.equal(s.pick('pink'), false);
  assert.equal(s.pick('blue'), false);
  assert.ok(s.drainEvents().some((e) => e.type === 'outOfStock'));
  assert.equal(s.pick('heart'), false); // закритий товар
});

test('нема товару на замовлення — клієнт іде за 3 с', () => {
  const s = new Shift(cfg, { rng: makeRng(3), stock: {} });
  s.update(cfg.customers.firstAtSec);
  assert.ok(s.customers[0].noStock);
  s.update(cfg.customers.noStockLeaveSec + 0.01);
  assert.equal(s.customers[0], null);
  assert.equal(s.stats.lost, 1);
  assert.ok(s.drainEvents().some((e) => e.type === 'leave' && e.noStock));
});

test('черга: коли місця зайняті, клієнти чекають і заходять на вільне', () => {
  const s = shift(5);
  s.customers = s.customers.map((_, i) => ({ id: 100 + i, order: { pink: 1 }, arrivedAt: 0, slot: i }));
  s.nextArrival = 0.1;
  s.update(0.2);
  assert.equal(s.queue.length, 1);
  s.customers[1] = null;
  s.update(0.01);
  assert.equal(s.queue.length, 0);
  assert.ok(s.customers[1] && s.customers[1].id >= 1);
});

test('клієнт іде, коли терпіння скінчилось', () => {
  const s = shift(5);
  s.update(cfg.customers.firstAtSec);
  const id = s.customers[0].id;
  s.update(cfg.customers.patienceSec + 0.01);
  assert.ok(!s.customers.some((c) => c && c.id === id));
  assert.ok(s.stats.lost >= 1);
});

test('гелій: закінчився → 15 с чекаєш, потім повний балон', () => {
  const s = shift(7);
  s.helium = 1;
  s.pick('pink');
  assert.ok(s.startInflate());
  assert.equal(s.helium, 0);
  assert.equal(s.refillLeft, cfg.helium.refillSec);
  s.update(0.7 * s.p.fullSec); s.release(); s.tie();
  s.pick('pink');
  assert.equal(s.startInflate(), false);
  s.update(cfg.helium.refillSec);
  assert.equal(s.helium, cfg.helium.tank);
  assert.ok(s.startInflate());
});

test('підсумок: цілі числа, оренда, каса не нижче 0', () => {
  assert.equal(heliumCost(cfg, 100), 120);
  assert.equal(heliumCost(cfg, 7), 8);
  const bad = summarize(cfg, { revenue: 0, tips: 0, served: 0, lost: 5, popped: 3, poppedValue: 18, heliumUsed: 3 }, 10);
  assert.equal(bad.rent, 90);
  assert.equal(bad.salary, 50);
  assert.equal(bad.profit, -144);
  assert.equal(bad.moneyAfter, 0);
  const ok = summarize(cfg, { revenue: 300, tips: 20, served: 10, lost: 0, popped: 0, poppedValue: 0, heliumUsed: 20 }, 300);
  assert.equal(ok.profit, 300 + 20 - 24 - 90 - 50);
  assert.equal(ok.moneyAfter, 456);
  assert.equal(starsFor(cfg, 9, 1), 3);
  assert.equal(starsFor(cfg, 7, 3), 2);
  assert.equal(starsFor(cfg, 1, 3), 1);
});

test('закупівля: гроші, місце на полиці, закриті товари', () => {
  let r = newRun(cfg);
  assert.equal(r.money, cfg.startMoney);
  const r2 = buyStock(cfg, r, { pink: 10 });
  assert.equal(r2.money, cfg.startMoney - 50);
  assert.equal(r2.stock.pink, 30);
  assert.equal(buyStock(cfg, r, { pink: cfg.stockMax }), null);  // не влізе
  assert.equal(buyStock(cfg, r, { heart: 1 }), null);             // фольга закрита
  assert.equal(buyStock(cfg, { ...r, money: 4 }, { pink: 1 }), null);
});

test('апгрейди: ціна, умова, двічі не купиш', () => {
  let r = { ...newRun(cfg), money: 2000 };
  assert.equal(upgradeState(cfg, r, 'pump3'), 'locked');
  r = buyUpgrade(cfg, r, 'pump2');
  assert.equal(r.money, 1880);
  assert.equal(upgradeState(cfg, r, 'pump2'), 'owned');
  assert.equal(buyUpgrade(cfg, r, 'pump2'), null);
  assert.equal(upgradeState(cfg, r, 'pump3'), 'available');
  assert.equal(upgradeState(cfg, { ...r, money: 10 }, 'pump3'), 'expensive');
});

test('збереження: зберіг — завантажив — стер', () => {
  const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  const r = endDay(newRun(cfg), { moneyAfter: 777 }, { pink: 3 });
  saveRun(r, storage);
  assert.deepEqual(loadRun(storage), r);
  assert.equal(loadRun(storage).day, 2);
  clearRun(storage);
  assert.equal(loadRun(storage), null);
  const broken = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
  assert.equal(loadRun(broken), null);
  saveRun(r, broken); // не падає
});

test('зміна закінчується за таймером', () => {
  const s = shift(9);
  for (let i = 0; i < 1900; i++) s.update(0.1);
  assert.ok(s.over);
  assert.ok(s.drainEvents().some((e) => e.type === 'end'));
});

test('недодута кулька не зав\'язується — її можна додути без нового гелію', () => {
  const s = shift(1);
  s.pick('pink');
  assert.equal(inflateTo(s, 0.4), 'under');
  assert.equal(s.nozzle.state, 'empty');
  assert.equal(s.tie(), false);
  const he = s.helium;
  assert.ok(s.startInflate());
  assert.equal(s.helium, he);             // гелій не списався вдруге
  s.update(0.25 * s.p.fullSec);
  assert.equal(s.release(), 'perfect');
  assert.ok(s.tie());
  assert.equal(s.bundle[0].quality, 'perfect');
});

test('клієнт забирає своє, зайві кульки лишаються на прилавку', () => {
  assert.ok(bundleCovers({ pink: 1 }, [{ key: 'pink' }, { key: 'blue' }]));
  assert.ok(!bundleCovers({ pink: 2 }, [{ key: 'pink' }, { key: 'blue' }]));
  const s = shift(3);
  s.bundle = [{ key: 'blue', quality: 'perfect' }, { key: 'pink', quality: 'perfect' }, { key: 'pink', quality: 'perfect' }];
  s.customers[0] = { id: 99, order: { pink: 1 }, arrivedAt: 0, seatedAt: 0, slot: 0 };
  assert.equal(s.give(0).value, 15);
  assert.deepEqual(s.bundle.map((b) => b.key), ['blue', 'pink']);
  assert.ok(s.discardAll());
  assert.equal(s.bundle.length, 0);
});

test('терпіння біля прилавка рахується з моменту, коли клієнт підійшов', () => {
  const s = shift(5);
  s.customers = s.customers.map((_, i) => ({ id: 100 + i, order: { pink: 1 }, arrivedAt: 0, seatedAt: 0, slot: i }));
  s.nextArrival = 0.1;
  s.update(0.2);                       // новий клієнт став у чергу
  const q = s.queue[0];
  s.update(20);                        // 20 с простояв у черзі
  s.customers[0] = null;
  s.update(0.01);                      // підійшов до прилавка
  const c = s.customers.find((x) => x && x.id === q.id);
  assert.ok(c);
  s.update(cfg.customers.patienceSec - 1);
  assert.ok(s.customers.some((x) => x && x.id === q.id)); // ще чекає — повне терпіння від підходу
});

test('онлайн-замовлення: лише з апгрейдом, одне за раз', () => {
  const none = shift(2, { owned: ['foil'] });
  none.update(cfg.online.firstAtSec + 1);
  assert.equal(none.online, null);
  const s = shift(2, { owned: ['foil', 'online'] });
  s.update(cfg.online.firstAtSec + 0.1);
  assert.ok(s.online);
  const id = s.online.id;
  const n = Object.values(s.online.order).reduce((a, b) => a + b, 0);
  assert.ok(n >= cfg.online.latexMin + cfg.online.foilMin);
  assert.ok(Object.keys(s.online.order).some((k) => k === 'heart' || k === 'star'));
  s.update(10);
  assert.equal(s.online.id, id);            // друге не з'являється, поки є перше
});

test('онлайн: упакував — оплата + доставка, зайві кульки лишаються', () => {
  const s = shift(2, { owned: ['foil', 'online'] });
  s.update(cfg.online.firstAtSec + 0.1);
  s.online.order = { pink: 2, heart: 1 };
  s.bundle = [{ key: 'pink', quality: 'perfect' }, { key: 'blue', quality: 'perfect' }];
  assert.equal(s.pack(), null);             // не вистачає — не пакується
  assert.ok(s.drainEvents().some((e) => e.type === 'onlineMismatch'));
  s.bundle.push({ key: 'pink', quality: 'perfect' }, { key: 'heart', quality: 'perfect' });
  const r = s.pack();
  assert.equal(r.value, 15 + 15 + 55 + cfg.online.fee);
  assert.equal(r.tip, Math.round(85 * cfg.customers.tipMul));
  assert.deepEqual(s.bundle.map((b) => b.key), ['blue']);
  assert.equal(s.online, null);
  assert.equal(s.stats.onlineDone, 1);
  assert.equal(s.stats.served, 1);
});

test('онлайн: не встиг — замовлення скасовується, рейтинг падає', () => {
  const s = shift(2, { owned: ['foil', 'online'] });
  s.customers = s.customers.map(() => null);
  s.nextArrival = Infinity;                 // без живих клієнтів
  s.update(cfg.online.firstAtSec + 0.1);
  assert.ok(s.online);
  s.update(cfg.online.timeSec);
  assert.equal(s.online, null);
  assert.equal(s.stats.onlineMissed, 1);
  assert.equal(s.stats.lost, 1);
  assert.equal(s.stats.revenue, 0);
});

test('магазин: оренда 150, терпіння довше, потік клієнтів не росте', () => {
  const p0 = deriveParams(cfg, ['foil']), p = deriveParams(cfg, ['foil', 'shop']);
  assert.equal(p.rent, 150);
  assert.equal(p.patienceSec, cfg.shop.patienceSec);
  assert.equal(p.gapSec, p0.gapSec);
  const s = shift(4, { owned: ['foil', 'shop'] });
  s.update(1);
  const sum = summarize(cfg, s.stats, 0);
  assert.equal(sum.rent, 150);
});

test('цифри: день народження — звичайне замовлення + одна цифра', () => {
  const open = deriveParams(cfg, ['foil', 'shop', 'digits']).open;
  assert.ok(open.includes('digit'));
  const rng = makeRng(11);
  let bd = 0;
  for (let i = 0; i < 400; i++) {
    const o = makeOrder(cfg, rng, open, 0.2);
    if (o.digit) { bd++; assert.equal(o.digit, 1); }
  }
  assert.ok(bd > 40 && bd < 130);                       // ≈20%
  assert.ok(deriveParams(cfg, ['foil', 'shop', 'digits', 'ads']).birthday > 0.2);
});

test('другий продавець: сам віддає замовлення до 3 кульок будь-якого типу, зарплата помічника', () => {
  const s = shift(6, { owned: ['foil', 'shop', 'helper'] });
  assert.equal(s.stats.salary, cfg.salary + cfg.helper.salary);
  s.nextArrival = Infinity;
  s.customers[0] = { id: 90, order: { pink: 1, blue: 1, heart: 1 }, arrivedAt: 0, seatedAt: 0, slot: 0 };
  s.customers[1] = { id: 91, order: { pink: 2, star: 2 }, arrivedAt: 0, seatedAt: 0, slot: 1 };
  const pink = s.stock.pink, heart = s.stock.heart;
  s.update(0.1);
  assert.ok(s.customers[0].helper);                     // 3 кульки, з фольгою — бере помічник
  assert.equal(s.stock.pink, pink - 1);
  assert.equal(s.stock.heart, heart - 1);
  assert.equal(s.stats.heliumUsed, 1 + 1 + cfg.items.heart.helium);   // фольга бере більше гелію
  s.update(cfg.helper.serveSec);
  assert.equal(s.customers[0], null);
  assert.equal(s.stats.helperServed, 1);
  assert.equal(s.stats.revenue, 2 * cfg.items.pink.sell + cfg.items.heart.sell);
  s.update(0.1);
  assert.ok(!s.customers[1].helper);                    // 4 кульки — не бере
});
