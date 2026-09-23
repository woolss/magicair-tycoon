// Стан гри між змінами: день, каса, склад, куплені апгрейди. Закупівля, апгрейди, збереження.
import { deriveParams } from './logic.js';

const SAVE_KEY = 'magicair-tycoon-v1';

export function newRun(cfg) {
  return { day: 1, money: cfg.startMoney, stock: { ...cfg.startStock }, owned: [] };
}

// Скільки коштує замовлення {key: n}
export function stockCost(cfg, order) {
  return Object.entries(order).reduce((s, [k, n]) => s + n * cfg.items[k].buy, 0);
}

// Скільки ще влазить на полицю
export function stockRoom(cfg, run, key) {
  return cfg.stockMax - (run.stock[key] || 0);
}

// Купити товар. Повертає новий run або null (нема грошей / місця / товар закритий).
export function buyStock(cfg, run, order) {
  const open = deriveParams(cfg, run.owned).open;
  for (const [k, n] of Object.entries(order)) {
    if (n < 0 || !open.includes(k) || n > stockRoom(cfg, run, k)) return null;
  }
  const cost = stockCost(cfg, order);
  if (cost > run.money) return null;
  const stock = { ...run.stock };
  for (const [k, n] of Object.entries(order)) stock[k] = (stock[k] || 0) + n;
  return { ...run, money: run.money - cost, stock };
}

export function upgradeState(cfg, run, id) {
  const u = cfg.upgrades.find((x) => x.id === id);
  if (run.owned.includes(id)) return 'owned';
  if (u.req && !run.owned.includes(u.req)) return 'locked';
  return run.money >= u.price ? 'available' : 'expensive';
}

export function buyUpgrade(cfg, run, id) {
  if (upgradeState(cfg, run, id) !== 'available') return null;
  const u = cfg.upgrades.find((x) => x.id === id);
  return { ...run, money: run.money - u.price, owned: [...run.owned, id] };
}

// Після зміни: нова каса і склад, наступний день
export function endDay(run, sum, stockAfter) {
  return { ...run, day: run.day + 1, money: sum.moneyAfter, stock: { ...run.stock, ...stockAfter } };
}

// Збереження в браузері. Може не працювати (приватний режим) — тоді гра просто не пам'ятає.
export function loadRun(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw);
    if (typeof r.day !== 'number' || typeof r.money !== 'number' || !r.stock || !Array.isArray(r.owned)) return null;
    return r;
  } catch (_) { return null; }
}

export function saveRun(run, storage = globalThis.localStorage) {
  try { storage && storage.setItem(SAVE_KEY, JSON.stringify(run)); } catch (_) { /* нема сховища */ }
}

export function clearRun(storage = globalThis.localStorage) {
  try { storage && storage.removeItem(SAVE_KEY); } catch (_) { /* нема сховища */ }
}
