// Бот грає справжню логіку гри (src/logic.js) багато днів поспіль — перевірка економіки етапу 1.
// Запуск: node sim/bot_days.js
import { CONFIG } from '../src/config.js';
import { Shift, makeRng, summarize, deriveParams } from '../src/logic.js';
import { newRun, buyStock, buyUpgrade, upgradeState, endDay } from '../src/run.js';

export const SKILLS = {
  strong: { move: 0.35, aimSd: 0.04 },
  average: { move: 0.5, aimSd: 0.07 },
  weak: { move: 0.75, aimSd: 0.1 },
};

function gauss(rng) { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); }

// Одна зміна: бот обслуговує найстаршого клієнта, якого може обслужити
export function playShift(s, skill, rng) {
  const dt = 0.05;
  let busy = 0, target = null, aim = 0.7;
  const aimCenter = (s.p.greenMin + s.p.greenMax) / 2;
  while (!s.over) {
    s.update(dt);
    if ((busy -= dt) > 0) continue;
    const nz = s.nozzle;
    if (nz?.state === 'inflating') {
      if (nz.fill >= aim) { s.release(); busy = skill.move * 0.4; }
      continue;
    }
    if (nz?.state === 'ready') { s.tie(); busy = skill.move * 0.6; continue; }
    if (!target || !s.customers.includes(target)) {
      target = s.customers.filter((c) => c && !c.noStock).sort((a, b) => a.arrivedAt - b.arrivedAt)[0] || null;
      if (s.bundle.length) { while (s.bundle.length) s.discard(0); }
    }
    if (!target) continue;
    const need = { ...target.order };
    for (const b of s.bundle) need[b.key]--;
    const next = Object.keys(need).find((k) => need[k] > 0);
    if (next && !nz) {
      if (!s.pick(next)) { target = null; continue; }
      busy = skill.move; aim = aimCenter + gauss(rng) * skill.aimSd; continue;
    }
    if (nz?.state === 'empty') { s.startInflate(); continue; }
    if (!next) { s.give(target.slot); target = null; busy = skill.move; }
  }
}

// Скільки тримати на складі (≈ попит дня з запасом)
function stockTargets(open) {
  const t = { pink: 22, blue: 22, yellow: 22, confetti: 16, heart: 14, star: 14 };
  return Object.fromEntries(open.map((k) => [k, t[k]]));
}

function restockOrder(cfg, run) {
  const open = deriveParams(cfg, run.owned).open;
  const order = {};
  for (const [k, want] of Object.entries(stockTargets(open))) {
    const n = Math.max(0, want - (run.stock[k] || 0));
    if (n) order[k] = n;
  }
  return order;
}

const cost = (cfg, o) => Object.entries(o).reduce((s, [k, n]) => s + n * cfg.items[k].buy, 0);

// Між змінами: спершу апгрейди по порядку (якщо лишається на закупівлю), потім закупівля
function shop(cfg, run) {
  for (const u of cfg.upgrades) {
    const st = upgradeState(cfg, run, u.id);
    if (st === 'owned' || st === 'locked') continue;
    const reserve = cost(cfg, restockOrder(cfg, run));
    if (run.money - u.price >= reserve) run = buyUpgrade(cfg, run, u.id) || run;
    break; // строго по порядку, як у симуляторі
  }
  let order = restockOrder(cfg, run);
  while (Object.keys(order).length && cost(cfg, order) > run.money) {
    const k = Object.keys(order).sort((a, b) => order[b] - order[a])[0];
    if (--order[k] <= 0) delete order[k];
  }
  return buyStock(cfg, run, order) || run;
}

export function runDays(skillName, seed, days = 20, cfg = CONFIG) {
  const rng = makeRng(seed * 7919 + 1);
  let run = newRun(cfg);
  const dayOf = {}, profits = [];
  for (let d = 1; d <= days; d++) {
    const s = new Shift(cfg, { rng, owned: run.owned, stock: run.stock });
    playShift(s, SKILLS[skillName], rng);
    const sum = summarize(cfg, s.stats, run.money);
    profits.push(sum.profit);
    run = endDay(run, sum, s.stock);
    const before = new Set(run.owned);
    run = shop(cfg, run);
    for (const id of run.owned) if (!before.has(id)) dayOf[id] = d;
  }
  return { dayOf, profits, run };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

if (process.argv[1] && process.argv[1].endsWith('bot_days.js')) {
  for (const name of Object.keys(SKILLS)) {
    const days = {}, d1 = [], mins = [];
    for (let seed = 1; seed <= 40; seed++) {
      const r = runDays(name, seed);
      for (const [k, v] of Object.entries(r.dayOf)) (days[k] ||= []).push(v);
      d1.push(r.profits[0]); mins.push(Math.min(...r.profits));
    }
    console.log(`\n=== ${name} — медіана дня покупки (40 прогонів) ===`);
    for (const u of CONFIG.upgrades) {
      const v = days[u.id] || [];
      console.log(`  ${u.id.padEnd(9)} день ${v.length ? median(v) : '—'}   (${v.length}/40)`);
    }
    console.log(`  прибуток дня 1: медіана ${median(d1)}; найгірший день за 20 днів: ${Math.min(...mins)}`);
  }
}
