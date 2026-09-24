// Чиста логіка зміни — без Phaser, тестується в node.
// Сцена лише читає стан, викликає дії і малює події з shift.events.

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pickOne = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Що дають куплені апгрейди: насос, потік клієнтів, балон, відкриті товари
export function deriveParams(cfg, owned = []) {
  let pump = 0, flow = 1, tank = cfg.helium.tank, online = false, shop = false, helper = false, birthday = cfg.orders.birthdayChance;
  const unlocked = new Set();
  for (const u of cfg.upgrades) {
    if (!owned.includes(u.id)) continue;
    const e = u.effect;
    if (e.pump != null) pump = Math.max(pump, e.pump);
    if (e.flow) flow *= e.flow;
    if (e.tank) tank = Math.max(tank, e.tank);
    if (e.unlock) unlocked.add(e.unlock);
    if (e.online) online = true;
    if (e.shop) shop = true;
    if (e.helper) helper = true;
    if (e.birthday) birthday = e.birthday;
  }
  const open = Object.keys(cfg.items).filter((k) => {
    const u = cfg.items[k].unlock;
    return !u || unlocked.has(u);
  });
  const p = cfg.pumps[pump];
  return {
    pump, fullSec: p.fullSec, greenMin: cfg.inflate.greenMin, greenMax: p.greenMax,
    gapSec: cfg.customers.baseGapSec / flow, tank, open, online, shop, helper, birthday,
    patienceSec: shop ? cfg.shop.patienceSec : cfg.customers.patienceSec,
    rent: shop ? cfg.shop.rent : cfg.rent,
    salary: (cfg.salary || 0) + (helper ? cfg.helper.salary : 0),
  };
}

export function makeOrder(cfg, rng, open, birthday = cfg.orders.birthdayChance) {
  const o = cfg.orders;
  const has = (k) => open.includes(k);
  const latex = open.filter((k) => cfg.items[k].kind === 'latex');
  const order = {};
  const add = (k, n) => { order[k] = (order[k] || 0) + n; };
  const n = randInt(rng, o.latexMin, o.latexMax);
  for (let i = 0; i < n; i++) add(pickOne(rng, latex), 1);
  if (has('confetti') && rng() < o.confettiChance) add('confetti', randInt(rng, 1, 2));
  if (has('heart') && rng() < o.foilChance) {
    const m = randInt(rng, 1, 2);
    for (let i = 0; i < m; i++) add(pickOne(rng, ['heart', 'star']), 1);
  }
  if (has('digit') && rng() < birthday) add('digit', 1);   // день народження
  return order;
}

// Онлайн-замовлення: більший набір — латекс 2–4, фольга 1–2, іноді конфеті
export function makeOnlineOrder(cfg, rng, open) {
  const o = cfg.online, order = {};
  const add = (k, n) => { order[k] = (order[k] || 0) + n; };
  const latex = open.filter((k) => cfg.items[k].kind === 'latex');
  const n = randInt(rng, o.latexMin, o.latexMax);
  for (let i = 0; i < n; i++) add(pickOne(rng, latex), 1);
  if (open.includes('heart')) {
    const m = randInt(rng, o.foilMin, o.foilMax);
    for (let i = 0; i < m; i++) add(pickOne(rng, ['heart', 'star']), 1);
  }
  if (open.includes('confetti') && rng() < o.confettiChance) add('confetti', 1);
  return order;
}

export function bundleMatches(order, bundle) {
  const have = {};
  for (const b of bundle) have[b.key] = (have[b.key] || 0) + 1;
  const keys = new Set([...Object.keys(order), ...Object.keys(have)]);
  for (const k of keys) if ((order[k] || 0) !== (have[k] || 0)) return false;
  return true;
}

// Чи є в зв'язці все, що потрібно клієнту (зайві кульки лишаються на прилавку)
export function bundleCovers(order, bundle) {
  const have = {};
  for (const b of bundle) have[b.key] = (have[b.key] || 0) + 1;
  return Object.entries(order).every(([k, n]) => (have[k] || 0) >= n);
}

export function gradeFill(p, fill) {
  if (fill > p.greenMax) return 'popped';
  if (fill >= p.greenMin) return 'perfect';
  return 'under';
}

export function balloonPrice(cfg, b) {
  const p = cfg.items[b.key].sell;
  return b.quality === 'perfect' ? p : Math.round(p * cfg.inflate.underSellMul);
}

export function heliumCost(cfg, units) {
  return Math.round((units * cfg.helium.tankPrice) / cfg.helium.tank);
}

export function starsFor(cfg, served, lost) {
  const total = served + lost;
  const r = total ? served / total : 1;
  return r >= cfg.stars[1] ? 3 : r >= cfg.stars[0] ? 2 : 1;
}

// Підсумок дня. Кульки вже оплачені на закупівлі — тут лише гроші дня.
export function summarize(cfg, st, moneyBefore) {
  const helium = heliumCost(cfg, st.heliumUsed);
  const rent = st.rent ?? cfg.rent;
  const salary = st.salary ?? (cfg.salary || 0);
  const profit = st.revenue + st.tips - helium - rent - salary;
  const moneyAfter = Math.max(0, moneyBefore + profit); // каса не нижче 0
  return {
    revenue: st.revenue, tips: st.tips, helium, rent, salary, profit,
    moneyBefore, moneyAfter,
    served: st.served, lost: st.lost, popped: st.popped, poppedValue: st.poppedValue,
    onlineDone: st.onlineDone || 0, onlineMissed: st.onlineMissed || 0,
    stars: starsFor(cfg, st.served, st.lost),
  };
}

export class Shift {
  constructor(cfg, { rng = Math.random, shiftSec, owned = [], stock = {} } = {}) {
    this.cfg = cfg;
    this.rng = rng;
    this.p = deriveParams(cfg, owned);
    this.duration = shiftSec ?? cfg.shiftSec;
    this.t = 0;
    this.over = false;
    this.customers = Array(cfg.customers.slots).fill(null);
    this.queue = [];           // чекають, поки звільниться місце
    this.nextArrival = cfg.customers.firstAtSec;
    this.nextId = 1;
    this.nozzle = null;        // {key, fill, state: 'empty'|'inflating'|'ready', quality}
    this.bundle = [];          // [{key, quality}]
    this.stock = {};
    for (const k of this.p.open) this.stock[k] = stock[k] || 0;
    this.helium = this.p.tank;
    this.refillLeft = 0;
    this.events = [];
    this.stats = { revenue: 0, tips: 0, served: 0, lost: 0, popped: 0, poppedValue: 0, heliumUsed: 0, onlineDone: 0, onlineMissed: 0,
      rent: this.p.rent, salary: this.p.salary, helperServed: 0 };
    this.helper = this.p.helper ? { cust: null, doneAt: 0, taken: null } : null;  // другий продавець
    this.online = null;        // поточне онлайн-замовлення {id, order, at, deadline} — лише одне
    this.nextOnline = this.p.online ? cfg.online.firstAtSec : Infinity;
  }

  get timeLeft() { return Math.max(0, this.duration - this.t); }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  drainEvents() { const e = this.events; this.events = []; return e; }

  // Чи вистачає товару на це замовлення (склад + вже зібране + кулька на соплі)
  canFulfil(order) {
    const have = { ...this.stock };
    for (const b of this.bundle) have[b.key] = (have[b.key] || 0) + 1;
    if (this.nozzle) have[this.nozzle.key] = (have[this.nozzle.key] || 0) + 1;
    return Object.entries(order).every(([k, n]) => (have[k] || 0) >= n);
  }

  seat(slot, cust) {
    cust.slot = slot;
    cust.seatedAt = this.t; // терпіння біля прилавка рахуємо з цього моменту
    if (!this.canFulfil(cust.order)) {
      cust.noStock = true;
      cust.leaveAt = this.t + this.cfg.customers.noStockLeaveSec;
    }
    this.customers[slot] = cust;
    this.emit('arrive', { slot, customer: cust });
  }

  update(dt) {
    if (this.over) return;
    this.t += dt;
    const c = this.cfg;

    // Прихід клієнтів: на вільне місце, інакше в чергу, інакше пройшов повз
    while (this.t >= this.nextArrival && this.nextArrival < this.duration) {
      const cust = { id: this.nextId++, order: makeOrder(c, this.rng, this.p.open, this.p.birthday), arrivedAt: this.nextArrival };
      if (cust.order.digit) cust.age = 1 + Math.floor(this.rng() * 9);   // яку цифру намалювати
      const slot = this.customers.indexOf(null);
      if (slot >= 0) this.seat(slot, cust);
      else if (this.queue.length < c.customers.queueMax) { this.queue.push(cust); this.emit('queue'); }
      this.nextArrival += -Math.log(1 - this.rng()) * this.p.gapSec;
    }

    // Терпіння: і біля прилавка, і в черзі
    for (let i = 0; i < this.customers.length; i++) {
      const cust = this.customers[i];
      if (!cust) continue;
      if (cust.helper) continue;   // його вже обслуговує помічник
      const gone = cust.noStock ? this.t >= cust.leaveAt : this.t - cust.seatedAt >= this.p.patienceSec;
      if (gone) {
        this.customers[i] = null;
        this.stats.lost++;
        this.emit('leave', { slot: i, id: cust.id, noStock: !!cust.noStock, order: cust.order });
      }
    }
    const before = this.queue.length;
    this.queue = this.queue.filter((q) => this.t - q.arrivedAt < c.customers.queuePatienceSec);
    if (this.queue.length !== before) { this.stats.lost += before - this.queue.length; this.emit('queue'); }

    // Черга заходить на вільні місця
    for (let i = 0; i < this.customers.length && this.queue.length; i++) {
      if (!this.customers[i]) { this.seat(i, this.queue.shift()); this.emit('queue'); }
    }

    // Другий продавець: бере найстаршого клієнта, якому треба до maxBalloons кульок (будь-яких), і за serveSec віддає сам
    const hp = this.helper;
    if (hp && hp.cust && this.t >= hp.doneAt) {
      const cust = hp.cust, slot = this.customers.indexOf(cust);
      const value = hp.taken.reduce((s, k) => s + c.items[k].sell, 0);
      hp.cust = null; hp.taken = null;
      if (slot >= 0) {
        this.customers[slot] = null;
        this.stats.revenue += value; this.stats.served++; this.stats.helperServed++;
        this.emit('sale', { slot, id: cust.id, order: cust.order, value, tip: 0, helper: true });
      }
    }
    if (hp && !hp.cust) {
      const simple = (o) => Object.values(o).reduce((a, b) => a + b, 0) <= c.helper.maxBalloons;
      const cust = this.customers.filter((x) => x && !x.noStock && !x.helper && simple(x.order)
        && Object.entries(x.order).every(([k, n]) => this.stock[k] >= n)).sort((a, b) => a.seatedAt - b.seatedAt)[0];
      if (cust) {
        cust.helper = true;
        hp.cust = cust; hp.doneAt = this.t + c.helper.serveSec; hp.startAt = this.t;
        hp.taken = Object.entries(cust.order).flatMap(([k, n]) => Array(n).fill(k));
        for (const k of hp.taken) this.stock[k]--;                 // бере товар зі складу одразу
        const he = hp.taken.reduce((sum, k) => sum + c.items[k].helium, 0);
        this.stats.heliumUsed += he;                                // гелій зі спільного балона (фольга — більше)
        this.helium = Math.max(0, this.helium - he);
        this.emit('helperTake', { id: cust.id });
      }
    }

    // Онлайн-замовлення: одне за раз; не встиг — скасовується
    const on = c.online;
    if (this.online && this.t >= this.online.deadline) {
      this.stats.lost++; this.stats.onlineMissed++;
      this.emit('onlineMissed', { id: this.online.id });
      this.online = null;
      this.nextOnline = this.t + on.gapMinSec + this.rng() * (on.gapMaxSec - on.gapMinSec);
    }
    if (!this.online && this.t >= this.nextOnline && this.t < this.duration - on.lastAtSec) {
      const order = makeOnlineOrder(c, this.rng, this.p.open);
      if (this.canFulfil(order)) {
        this.online = { id: this.nextId++, order, at: this.t, deadline: this.t + on.timeSec };
        this.emit('onlineNew', { id: this.online.id, order });
      } else this.nextOnline = this.t + on.retrySec;
    }

    // Надування
    const nz = this.nozzle;
    if (nz && nz.state === 'inflating') {
      nz.fill += dt / this.p.fullSec;
      if (nz.fill >= 1) { nz.fill = 1; this.release(); }
    }

    // Новий балон
    if (this.refillLeft > 0) {
      this.refillLeft -= dt;
      if (this.refillLeft <= 0) {
        this.refillLeft = 0;
        this.helium = this.p.tank;
        this.emit('refilled');
      }
    }

    if (this.t >= this.duration) {
      this.over = true;
      this.emit('end');
    }
  }

  // Тап по товару на полиці
  pick(key) {
    if (this.over || this.nozzle || !(key in this.stock)) return false;
    if (this.stock[key] <= 0) { this.emit('outOfStock', { key }); return false; }
    this.stock[key]--;
    this.nozzle = { key, fill: 0, state: 'empty', quality: null };
    this.emit('pick', { key });
    return true;
  }

  // Натиснув і тримає
  startInflate() {
    const nz = this.nozzle;
    if (this.over || !nz || nz.state !== 'empty') return false;
    // гелій списуємо один раз на кульку; додування — без нового списання
    if (!nz.paid) {
      const he = this.cfg.items[nz.key].helium;
      if (this.helium < he) {
        if (this.refillLeft <= 0) this.startRefill();
        this.emit('noHelium');
        return false;
      }
      this.helium -= he;
      this.stats.heliumUsed += he;
      nz.paid = true;
      if (this.helium <= 0 && this.refillLeft <= 0) this.startRefill();
    }
    nz.state = 'inflating';
    return true;
  }

  startRefill() {
    this.refillLeft = this.cfg.helium.refillSec;
    this.emit('refillStart');
  }

  // Відпустив палець
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
    } else if (q === 'under') {
      // недодута — не зав'язуємо, лишається на соплі: тримай ще раз, щоб додути
      nz.state = 'empty';
      this.emit('under', { fill: nz.fill });
    } else {
      nz.state = 'ready';
      nz.quality = q;
      this.emit('inflated', { quality: q });
    }
    return q;
  }

  // Тап по надутій кульці — зав'язати і в зв'язку
  tie() {
    const nz = this.nozzle;
    if (!nz || nz.state !== 'ready') return false;
    if (this.bundle.length >= this.cfg.bundleMax) { this.emit('bundleFull'); return false; }
    this.bundle.push({ key: nz.key, quality: nz.quality });
    this.nozzle = null;
    this.emit('tie', { index: this.bundle.length - 1 });
    return true;
  }

  // Кнопка «скинути» — прибрати всю зв'язку з прилавка
  discardAll() {
    if (!this.bundle.length) return false;
    this.bundle = [];
    this.emit('discard', { index: -1 });
    return true;
  }

  // Тап по кульці у зв'язці — викинути
  discard(i) {
    if (i < 0 || i >= this.bundle.length) return false;
    this.bundle.splice(i, 1);
    this.emit('discard', { index: i });
    return true;
  }

  // Тап по чеку онлайн-замовлення — упакувати зв'язку в коробку для кур'єра
  pack() {
    const ord = this.online;
    if (this.over || !ord || !this.bundle.length) return null;
    if (!bundleCovers(ord.order, this.bundle)) { this.emit('onlineMismatch'); return null; }
    const { taken, rest } = this.takeFromBundle(ord.order);
    const balloons = taken.reduce((s, b) => s + balloonPrice(this.cfg, b), 0);
    const on = this.cfg.online;
    const tip = this.t - ord.at <= on.tipIfWithinSec ? Math.round(balloons * this.cfg.customers.tipMul) : 0;
    const value = balloons + on.fee;
    this.stats.revenue += value;
    this.stats.tips += tip;
    this.stats.served++; this.stats.onlineDone++;
    this.bundle = rest;
    this.online = null;
    this.nextOnline = this.t + on.gapMinSec + this.rng() * (on.gapMaxSec - on.gapMinSec);
    this.emit('onlinePacked', { id: ord.id, order: ord.order, value, tip });
    return { value, tip };
  }

  // Зі зв'язки беремо лише потрібне замовленню, решта лишається на прилавку
  takeFromBundle(order) {
    const need = { ...order }, taken = [], rest = [];
    for (const b of this.bundle) {
      if (need[b.key] > 0) { need[b.key]--; taken.push(b); } else rest.push(b);
    }
    return { taken, rest };
  }

  // Тап по клієнту — віддати зв'язку
  give(slot) {
    const cust = this.customers[slot];
    if (this.over || !cust || !this.bundle.length || cust.helper) return null;
    if (!bundleCovers(cust.order, this.bundle)) {
      this.emit('mismatch', { slot });
      return null;
    }
    // клієнт забирає тільки своє, зайві кульки лишаються на прилавку
    const { taken, rest } = this.takeFromBundle(cust.order);
    const value = taken.reduce((s, b) => s + balloonPrice(this.cfg, b), 0);
    const fast = this.t - cust.seatedAt <= this.cfg.customers.tipIfWithinSec;
    const tip = fast ? Math.round(value * this.cfg.customers.tipMul) : 0;
    this.stats.revenue += value;
    this.stats.tips += tip;
    this.stats.served++;
    this.bundle = rest;
    this.customers[slot] = null;
    this.emit('sale', { slot, id: cust.id, order: cust.order, value, tip });
    return { value, tip };
  }
}
