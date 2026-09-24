// Виїзд на оформлення (ступінь 4, апгрейд «Машина»): арка з кульок за схемою кольорів.
// Чиста логіка без Phaser — тестується в node.
import { deriveParams, gradeFill, heliumCost } from './logic.js';

const pickOne = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Порядок заповнення: від обох країв до верху — арка «росте» симетрично
export function fillOrder(n) {
  const out = [];
  for (let i = 0, j = n - 1; i <= j; i++, j--) { out.push(i); if (j !== i) out.push(j); }
  return out;
}

// Схема кольорів арки (симетрична): смуги з 2–3 кольорів
function scheme(rng, n, colors) {
  const k = Math.min(colors.length, rng() < 0.5 ? 2 : 3);
  const pal = [...colors].sort(() => rng() - 0.5).slice(0, k);
  const pattern = pickOne(rng, ['alt', 'pairs', 'halves']);
  const half = Math.ceil(n / 2), left = [];
  for (let i = 0; i < half; i++) {
    if (pattern === 'alt') left.push(pal[i % k]);
    else if (pattern === 'pairs') left.push(pal[Math.floor(i / 2) % k]);
    else left.push(pal[Math.min(k - 1, Math.floor((i / half) * k))]);   // від краю до верху — смугами
  }
  return Array.from({ length: n }, (_, i) => left[Math.min(i, n - 1 - i)]);
}

// Нова бронь на виїзд. done — скільки виїздів уже було (арки поступово більшають)
export function makeBooking(cfg, rng, owned, day, done = 0) {
  const e = cfg.event;
  const open = deriveParams(cfg, owned).open;
  const colors = open.filter((k) => ['latex', 'confetti'].includes(cfg.items[k].kind));
  const size = e.sizes[Math.min(done, e.sizes.length - 1)];
  const slots = scheme(rng, size, colors);
  const kind = pickOne(rng, e.kinds);
  // день народження з відкритими цифрами — цифра по центру арки
  if (kind === 'birthday' && open.includes('digit')) slots[Math.floor(size / 2)] = 'digit';
  const need = {};
  for (const k of slots) need[k] = (need[k] || 0) + 1;
  const pay = size * e.payPerBalloon + e.setupFee + (need.digit ? e.digitBonus : 0);
  const age = need.digit ? 1 + Math.floor(rng() * 9) : null;
  return { day, kind, slots, need, pay, age, timeSec: Math.round(e.baseSec + e.secPerBalloon * size) };
}

// Чи вистачає товару на бронь
export function bookingShort(booking, stock) {
  return Object.entries(booking.need).filter(([k, n]) => (stock[k] || 0) < n).map(([k, n]) => ({ key: k, need: n, have: stock[k] || 0 }));
}

// Сам виїзд: надуваєш як у магазині, зав'язана кулька летить на найближче вільне місце свого кольору
export class EventShift {
  constructor(cfg, booking, { owned = [], stock = {} } = {}) {
    this.cfg = cfg;
    this.b = booking;
    this.p = deriveParams(cfg, owned);
    this.duration = booking.timeSec;
    this.t = 0;
    this.over = false;
    this.placed = booking.slots.map(() => false);
    this.order = fillOrder(booking.slots.length);
    this.stock = { ...stock };
    this.nozzle = null;
    this.helium = this.p.tank;          // у машині свій повний балон
    this.stats = { heliumUsed: 0, popped: 0, poppedValue: 0, wasted: 0, wastedValue: 0, placed: 0 };
    this.events = [];
  }

  get timeLeft() { return Math.max(0, this.duration - this.t); }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // Скільки ще потрібно кожного кольору
  remaining() {
    const r = {};
    this.b.slots.forEach((k, i) => { if (!this.placed[i]) r[k] = (r[k] || 0) + 1; });
    return r;
  }

  update(dt) {
    if (this.over) return;
    this.t += dt;
    const nz = this.nozzle;
    if (nz && nz.state === 'inflating') {
      nz.fill += dt / this.p.fullSec;
      if (nz.fill >= 1) { nz.fill = 1; this.release(); }
    }
    if (this.t >= this.duration) this.finish();
  }

  pick(key) {
    if (this.over) return false;
    // ще не почав дути — можна передумати й узяти інший колір
    const nz = this.nozzle;
    if (nz && !(nz.state === 'empty' && !nz.paid)) return false;
    if (nz && nz.key === key) return false;
    if (!(this.stock[key] > 0)) { this.emit('outOfStock', { key }); return false; }
    if (nz) { this.stock[nz.key]++; this.nozzle = null; }
    this.stock[key]--;
    this.nozzle = { key, fill: 0, state: 'empty' };
    this.emit('pick', { key });
    return true;
  }

  startInflate() {
    const nz = this.nozzle;
    if (this.over || !nz || nz.state !== 'empty') return false;
    if (!nz.paid) {
      const he = this.cfg.items[nz.key].helium;
      if (this.helium < he) { this.emit('noHelium'); return false; }
      this.helium -= he; this.stats.heliumUsed += he; nz.paid = true;
    }
    nz.state = 'inflating';
    return true;
  }

  release() {
    const nz = this.nozzle;
    if (!nz || nz.state !== 'inflating') return null;
    const q = gradeFill(this.p, nz.fill);
    if (q === 'popped') {
      this.nozzle = null;
      this.stats.popped++;
      const loss = this.cfg.items[nz.key].buy + heliumCost(this.cfg, this.cfg.items[nz.key].helium);
      this.stats.poppedValue += loss;
      this.emit('pop', { key: nz.key, loss });
    } else if (q === 'under') { nz.state = 'empty'; this.emit('under'); }
    else { nz.state = 'ready'; this.emit('inflated'); }
    return q;
  }

  // Зав'язати: кулька летить на найближче (від країв) вільне місце свого кольору; такого нема — зайва
  tie() {
    const nz = this.nozzle;
    if (this.over || !nz || nz.state !== 'ready') return false;
    this.nozzle = null;
    const slot = this.order.find((i) => !this.placed[i] && this.b.slots[i] === nz.key);
    if (slot == null) {
      this.stats.wasted++;
      this.stats.wastedValue += this.cfg.items[nz.key].buy + heliumCost(this.cfg, this.cfg.items[nz.key].helium);
      this.emit('wasted', { key: nz.key });
      return true;
    }
    this.placed[slot] = true;
    this.stats.placed++;
    this.emit('placed', { key: nz.key, slot });
    if (this.stats.placed === this.b.slots.length) this.finish();
    return true;
  }

  finish() {
    if (this.over) return;
    this.over = true;
    if (this.nozzle) this.stock[this.nozzle.key]++;   // кулька на соплі повертається на склад
    this.nozzle = null;
    this.emit('end', { result: eventResult(this.cfg, this.b, this.stats, this.t) });
  }
}

// Підсумок виїзду: зібрав усе — повна оплата; ні — частка (клієнт незадоволений). Помилки — мінус зірки.
export function eventResult(cfg, booking, st, time) {
  const e = cfg.event, n = booking.slots.length;
  const done = st.placed === n;
  const mistakes = st.popped + st.wasted;
  const stars = !done ? 1 : mistakes <= e.mistakes3 ? 3 : mistakes <= e.mistakes2 ? 2 : 1;
  const base = done ? booking.pay : Math.round((booking.pay * e.partialMul * st.placed) / n);
  const tip = stars === 3 ? Math.round(booking.pay * e.tipMul) : 0;
  const helium = heliumCost(cfg, st.heliumUsed);
  return { done, placed: st.placed, total: n, stars, pay: base, tip, helium, popped: st.popped, wasted: st.wasted, profit: base + tip - helium, time: Math.round(time) };
}
