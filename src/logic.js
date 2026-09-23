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

export function makeOrder(cfg, rng) {
  const colors = Object.keys(cfg.colors);
  const n = randInt(rng, cfg.customers.orderMin, cfg.customers.orderMax);
  const order = {};
  for (let i = 0; i < n; i++) {
    const c = colors[Math.floor(rng() * colors.length)];
    order[c] = (order[c] || 0) + 1;
  }
  return order;
}

export function bundleMatches(order, bundle) {
  const have = {};
  for (const b of bundle) have[b.color] = (have[b.color] || 0) + 1;
  const keys = new Set([...Object.keys(order), ...Object.keys(have)]);
  for (const k of keys) if ((order[k] || 0) !== (have[k] || 0)) return false;
  return true;
}

export function gradeFill(cfg, fill) {
  if (fill > cfg.inflate.greenMax) return 'popped';
  if (fill >= cfg.inflate.greenMin) return 'perfect';
  return 'under';
}

export function balloonPrice(cfg, b) {
  const p = cfg.items.latex.sell;
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

export function summarize(cfg, st, moneyBefore) {
  const balloons = st.balloonsBought * cfg.items.latex.buy;
  const helium = heliumCost(cfg, st.heliumUsed);
  const rent = cfg.rent;
  const profit = st.revenue + st.tips - balloons - helium - rent;
  const moneyAfter = Math.max(0, moneyBefore + profit); // у мінус не йдемо
  return {
    revenue: st.revenue, tips: st.tips, balloons, helium, rent, profit,
    moneyBefore, moneyAfter,
    served: st.served, lost: st.lost, popped: st.popped,
    stars: starsFor(cfg, st.served, st.lost),
  };
}

export class Shift {
  constructor(cfg, { rng = Math.random, shiftSec } = {}) {
    this.cfg = cfg;
    this.rng = rng;
    this.duration = shiftSec ?? cfg.shiftSec;
    this.t = 0;
    this.over = false;
    this.customers = Array(cfg.customers.slots).fill(null);
    this.nextArrival = cfg.customers.firstAtSec;
    this.nextId = 1;
    this.nozzle = null;        // {color, fill, state: 'empty'|'inflating'|'ready', quality}
    this.bundle = [];          // [{color, quality}]
    this.helium = cfg.helium.tank;
    this.refillLeft = 0;
    this.events = [];
    this.stats = { revenue: 0, tips: 0, served: 0, lost: 0, popped: 0, balloonsBought: 0, heliumUsed: 0 };
  }

  get timeLeft() { return Math.max(0, this.duration - this.t); }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  drainEvents() { const e = this.events; this.events = []; return e; }

  update(dt) {
    if (this.over) return;
    this.t += dt;
    const c = this.cfg;

    // Прихід клієнтів
    while (this.t >= this.nextArrival && this.nextArrival < this.duration) {
      const slot = this.customers.indexOf(null);
      if (slot >= 0) {
        const cust = { id: this.nextId++, order: makeOrder(c, this.rng), arrivedAt: this.nextArrival, slot };
        this.customers[slot] = cust;
        this.emit('arrive', { slot, customer: cust });
      }
      this.nextArrival += -Math.log(1 - this.rng()) * c.customers.baseGapSec;
    }

    // Терпіння
    for (let i = 0; i < this.customers.length; i++) {
      const cust = this.customers[i];
      if (cust && this.t - cust.arrivedAt >= c.customers.patienceSec) {
        this.customers[i] = null;
        this.stats.lost++;
        this.emit('leave', { slot: i });
      }
    }

    // Надування
    const nz = this.nozzle;
    if (nz && nz.state === 'inflating') {
      nz.fill += dt / c.pump.fullSec;
      if (nz.fill >= 1) { nz.fill = 1; this.release(); }
    }

    // Новий балон
    if (this.refillLeft > 0) {
      this.refillLeft -= dt;
      if (this.refillLeft <= 0) {
        this.refillLeft = 0;
        this.helium = c.helium.tank;
        this.emit('refilled');
      }
    }

    if (this.t >= this.duration) {
      this.over = true;
      this.emit('end');
    }
  }

  // Тап по кульці на полиці
  pick(color) {
    if (this.over || this.nozzle) return false;
    this.nozzle = { color, fill: 0, state: 'empty', quality: null };
    this.stats.balloonsBought++;
    this.emit('pick', { color });
    return true;
  }

  // Натиснув і тримає
  startInflate() {
    const nz = this.nozzle;
    if (this.over || !nz || nz.state !== 'empty') return false;
    if (this.helium < this.cfg.items.latex.helium) {
      this.emit('noHelium');
      return false;
    }
    this.helium -= this.cfg.items.latex.helium;
    this.stats.heliumUsed += this.cfg.items.latex.helium;
    if (this.helium <= 0 && this.refillLeft <= 0) this.startRefill();
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
    const q = gradeFill(this.cfg, nz.fill);
    if (q === 'popped') {
      this.nozzle = null;
      this.stats.popped++;
      // лопнула — одразу видно втрату: кулька + її гелій
      const loss = this.cfg.items.latex.buy + heliumCost(this.cfg, this.cfg.items.latex.helium);
      this.emit('pop', { color: nz.color, loss });
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
    this.bundle.push({ color: nz.color, quality: nz.quality });
    this.nozzle = null;
    this.emit('tie', { index: this.bundle.length - 1 });
    return true;
  }

  // Тап по кульці у зв'язці — викинути
  discard(i) {
    if (i < 0 || i >= this.bundle.length) return false;
    this.bundle.splice(i, 1);
    this.emit('discard', { index: i });
    return true;
  }

  // Тап по клієнту — віддати зв'язку
  give(slot) {
    const cust = this.customers[slot];
    if (this.over || !cust || !this.bundle.length) return null;
    if (!bundleMatches(cust.order, this.bundle)) {
      this.emit('mismatch', { slot });
      return null;
    }
    const value = this.bundle.reduce((s, b) => s + balloonPrice(this.cfg, b), 0);
    const fast = this.t - cust.arrivedAt <= this.cfg.customers.tipIfWithinSec;
    const tip = fast ? Math.round(value * this.cfg.customers.tipMul) : 0;
    this.stats.revenue += value;
    this.stats.tips += tip;
    this.stats.served++;
    this.bundle = [];
    this.customers[slot] = null;
    this.emit('sale', { slot, value, tip });
    return { value, tip };
  }
}
