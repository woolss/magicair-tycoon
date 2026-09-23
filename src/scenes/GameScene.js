import { W, C, txt, drawItem } from '../theme.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { Shift, makeRng, summarize, bundleMatches, heliumCost } from '../logic.js';
import { endDay, saveRun } from '../run.js';

const SLOT_X = [130, 360, 590];
const NOZZLE = { x: 360, y: 1010 };
const METER = { x: 600, top: 710, bottom: 1030, w: 46 };
const TANK = { x: 70, y: 730, w: 110, h: 290 };
const BTN = { x: 490, y: 960, r: 62 }; // кнопка «Надути / Зав'язати»
const ITEM = (k) => CONFIG.items[k];

// Полиця: до 3 товарів — один ряд, більше — два ряди
function shelfLayout(n) {
  const xs = [150, 360, 570];
  if (n <= 3) return Array.from({ length: n }, (_, i) => ({ x: [170, 360, 550][i], y: 1170, bg: 78, r: 42 }));
  return Array.from({ length: n }, (_, i) => ({ x: xs[i % 3], y: i < 3 ? 1130 : 1230, bg: 47, r: 28 }));
}

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.run = this.registry.get('run');
    const opts = this.registry.get('opts') || {};
    const rng = opts.seed != null ? makeRng(opts.seed + this.run.day) : Math.random;
    this.shift = new Shift(CONFIG, { rng, shiftSec: opts.shift, owned: this.run.owned, stock: this.run.stock });
    this.keys = this.shift.p.open;
    this.shelf = shelfLayout(this.keys.length);
    this.custViews = Array(CONFIG.customers.slots).fill(null);
    this.pickAnim = null;
    this.flash = {};

    this.cameras.main.setBackgroundColor(C.bg);
    this.drawStatic();

    // HUD
    this.add.text(30, 45, t('day', { n: this.run.day }), txt(34, C.white)).setOrigin(0, 0.5);
    this.queueText = this.add.text(30, 88, '', txt(22, C.pinkSoft)).setOrigin(0, 0.5);
    this.timerText = this.add.text(W / 2, 55, '', txt(56, C.white)).setOrigin(0.5);
    this.moneyText = this.add.text(W - 30, 55, '', txt(34, C.white)).setOrigin(1, 0.5);

    this.dyn = this.add.graphics();
    this.hintText = this.add.text(NOZZLE.x + 40, 690, '', txt(30, C.purple, { stroke: '#fff4fa', strokeThickness: 10 })).setOrigin(0.5).setDepth(2);
    this.heliumText = this.add.text(TANK.x + TANK.w / 2, TANK.y + TANK.h + 22, '', txt(24, C.ink)).setOrigin(0.5);
    this.refillText = this.add.text(TANK.x + TANK.w / 2, TANK.y + TANK.h / 2, '', txt(24, C.red, { align: 'center', wordWrap: { width: 150 } })).setOrigin(0.5);
    this.btnText = this.add.text(BTN.x, BTN.y, '', txt(26, C.white, { align: 'center' })).setOrigin(0.5).setDepth(2);
    this.stockTexts = this.shelf.map((s) => this.add.text(s.x + s.bg * 0.62, s.y + s.bg * 0.62, '', txt(s.bg > 60 ? 26 : 22, C.white, { backgroundColor: '#b338b5', padding: { x: 8, y: 2 } })).setOrigin(0.5).setDepth(2));
    this.floatAt = {};

    this.bundleView = this.add.container(0, 0);

    // Робоча зона: натиснув — надуваєш, тап по готовій — зав'язати
    const work = this.add.zone(W / 2, 865, W, 410).setInteractive();
    work.on('pointerdown', () => {
      const nz = this.shift.nozzle;
      if (!nz) return;
      if (nz.state === 'ready') this.shift.tie();
      else if (nz.state === 'empty' && this.shift.startInflate()) this.pickAnim = null;
    });
    const up = () => this.shift.release();
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', up);

    // Полиця
    this.keys.forEach((key, i) => {
      const s = this.shelf[i];
      const z = this.add.zone(s.x, s.y, s.bg * 2.1, s.bg * 2.1).setInteractive();
      z.on('pointerdown', () => this.shift.pick(key));
    });

    this.renderBundle();
    if (typeof window !== 'undefined') window.__scene = this;
  }

  drawStatic() {
    const g = this.add.graphics();
    // HUD
    g.fillStyle(C.purple, 1).fillRect(0, 0, W, 110);
    // прилавок
    g.fillStyle(C.counter, 1).fillRect(0, 548, W, 104);
    g.fillStyle(C.pinkSoft, 1).fillRect(0, 540, W, 12);
    // балон з гелієм
    g.fillStyle(C.grey, 1).fillRoundedRect(TANK.x, TANK.y, TANK.w, TANK.h, 30);
    g.fillStyle(C.greyDark, 1).fillRect(TANK.x + 40, TANK.y - 28, 30, 30);
    // трубка до сопла
    g.lineStyle(10, C.greyDark, 1);
    g.beginPath();
    g.moveTo(TANK.x + 55, TANK.y - 28);
    g.lineTo(TANK.x + 55, TANK.y - 45);
    g.lineTo(250, TANK.y - 45);
    g.lineTo(250, NOZZLE.y + 30);
    g.lineTo(NOZZLE.x, NOZZLE.y + 30);
    g.strokePath();
    g.fillStyle(C.greyDark, 1).fillRect(NOZZLE.x - 16, NOZZLE.y, 32, 40);
    // шкала надування (зелена зона залежить від насоса)
    const p = this.shift.p;
    const { x, top, bottom, w } = METER;
    const yOf = (f) => bottom - f * (bottom - top);
    g.fillStyle(C.grey, 1).fillRoundedRect(x - w / 2, top, w, bottom - top, 14);
    g.fillStyle(C.green, 1).fillRect(x - w / 2, yOf(p.greenMax), w, yOf(p.greenMin) - yOf(p.greenMax));
    g.fillStyle(C.red, 0.85).fillRect(x - w / 2, top + 8, w, Math.max(0, yOf(p.greenMax) - top - 8));
    // полиця
    g.fillStyle(0xf6e6f4, 1).fillRect(0, 1075, W, 205);
    g.fillStyle(C.pinkSoft, 1).fillRect(0, 1075, W, 10);
    this.shelfGfx = this.add.graphics();
  }

  update() {
    // реальний час, а не згладжений Phaser-ом: на слабкому телефоні зміна не сповільнюється
    const deltaMs = Math.min(this.game.loop.rawDelta, 250);
    const s = this.shift;
    s.update(deltaMs / 1000);
    for (const e of s.drainEvents()) this.onEvent(e);
    if (!this.scene.isActive()) return;
    if (this.pickAnim) {
      this.pickAnim.t += deltaMs / 180;
      if (this.pickAnim.t >= 1) this.pickAnim = null;
    }
    this.renderDynamic();
  }

  shelfPos(key) { return this.shelf[this.keys.indexOf(key)]; }

  onEvent(e) {
    const s = this.shift;
    switch (e.type) {
      case 'arrive': this.addCustomer(e.slot, e.customer); break;
      case 'leave':
        if (e.noStock) this.floatText(SLOT_X[e.slot], 300, t('noStock'), C.red);
        this.removeCustomer(e.slot, false);
        break;
      case 'sale':
        this.floatText(SLOT_X[e.slot], 380, `+${e.value}` + (e.tip ? ` (+${e.tip})` : ''), C.green);
        this.removeCustomer(e.slot, true);
        this.renderBundle();
        break;
      case 'mismatch': {
        const v = this.custViews[e.slot];
        if (v) this.tweens.add({ targets: v, x: SLOT_X[e.slot] + 12, duration: 50, yoyo: true, repeat: 2 });
        this.floatText(SLOT_X[e.slot], 300, t('mismatch'), C.red);
        break;
      }
      case 'pick': { const sp = this.shelfPos(e.key); this.pickAnim = { key: e.key, x: sp.x, y: sp.y, t: 0 }; break; }
      case 'outOfStock': { const sp = this.shelfPos(e.key); this.floatText(sp.x, sp.y - 60, t('outOfStock'), C.red); this.flash[e.key] = this.time.now; break; }
      case 'inflated': this.floatText(NOZZLE.x, 790, t(e.quality === 'perfect' ? 'perfect' : 'under'), e.quality === 'perfect' ? C.green : C.greyDark); break;
      case 'pop':
        this.burst(NOZZLE.x, 880, ITEM(e.key).color);
        this.floatText(NOZZLE.x, 780, `${t('pop')} −${e.loss} ₴`, C.red);
        this.flash[e.key] = this.time.now;
        break;
      case 'tie': {
        // кулька видимо летить на прилавок у зв'язку
        this.renderBundle();
        const item = this.bundleView.list[e.index];
        if (item) {
          const tx = item.x, ty = item.y;
          item.setPosition(NOZZLE.x, NOZZLE.y - 90).setScale(1.8);
          this.tweens.add({ targets: item, x: tx, y: ty, scale: 1, duration: 280, ease: 'Cubic.easeOut' });
        }
        break;
      }
      case 'discard': this.renderBundle(); break;
      case 'bundleFull': this.floatText(W / 2, 520, t('bundleFull'), C.red); break;
      case 'noHelium': this.floatText(TANK.x + 60, 700, t('refill', { s: Math.ceil(s.refillLeft) }), C.red); break;
      case 'end': {
        // кульки на соплі й у зв'язці повертаються на склад
        const back = { ...s.stock };
        if (s.nozzle) back[s.nozzle.key]++;
        for (const b of s.bundle) back[b.key]++;
        const sum = summarize(CONFIG, s.stats, this.run.money);
        const run = endDay(this.run, sum, back);
        this.registry.set('run', run);
        saveRun(run);
        this.scene.start('summary', { day: this.run.day, sum });
        break;
      }
    }
  }

  addCustomer(slot, cust) {
    const x = SLOT_X[slot];
    const c = this.add.container(x, 340);
    const g = this.add.graphics();
    const skin = [0xc9b3cc, 0xb8c4d9, 0xd9c4b3][cust.id % 3];
    // тіло + голова
    g.fillStyle(skin, 1).fillRoundedRect(-70, 70, 140, 130, 50);
    g.fillCircle(0, 30, 48);
    g.fillStyle(C.ink, 1).fillCircle(-16, 24, 5).fillCircle(16, 24, 5);
    // хмаринка із замовленням: по 3 в ряд
    const entries = Object.entries(cust.order);
    const rows = Math.ceil(entries.length / 3);
    const h = 40 + rows * 62, top = -55 - h;
    g.fillStyle(C.white, 1).fillRoundedRect(-100, top, 200, h, 26);
    g.fillTriangle(-14, -58, 14, -58, 0, -30);
    const icons = [];
    entries.forEach(([key, n], i) => {
      const row = Math.floor(i / 3), inRow = Math.min(3, entries.length - row * 3);
      const ix = (i % 3 - (inRow - 1) / 2) * 60, iy = top + 42 + row * 62;
      drawItem(g, ITEM(key), ix, iy, 16);
      icons.push(this.add.text(ix, iy + 30, `×${n}`, txt(22, C.ink)).setOrigin(0.5));
    });
    if (cust.noStock) {
      g.lineStyle(8, C.red, 0.9);
      g.lineBetween(-60, top + 15, 60, top + h - 15);
      g.lineBetween(60, top + 15, -60, top + h - 15);
    }
    const bar = this.add.graphics();
    c.add([g, ...icons, bar]);
    c.bar = bar;
    c.cust = cust;
    c.bubble = { top, h };
    c.setSize(210, 420).setInteractive();
    c.on('pointerdown', () => this.shift.give(slot));
    c.setAlpha(0).y -= 30;
    this.tweens.add({ targets: c, alpha: 1, y: 340, duration: 250 });
    this.custViews[slot] = c;
  }

  removeCustomer(slot, happy) {
    const c = this.custViews[slot];
    if (!c) return;
    this.custViews[slot] = null;
    c.disableInteractive();
    this.tweens.add({ targets: c, alpha: 0, y: happy ? 300 : 380, duration: 300, onComplete: () => c.destroy() });
    if (!happy) this.floatText(SLOT_X[slot], 250, '☹', C.red);
  }

  renderBundle() {
    this.bundleView.removeAll(true);
    const b = this.shift.bundle;
    const step = 80, x0 = W / 2 - ((b.length - 1) * step) / 2;
    b.forEach((ball, i) => {
      const g = this.add.graphics();
      const perfect = ball.quality === 'perfect';
      drawItem(g, ITEM(ball.key), 0, perfect ? 0 : 8, perfect ? 30 : 24, perfect ? 1 : 0.7);
      const item = this.add.container(x0 + i * step, 588, [g]).setSize(76, 96).setInteractive();
      item.on('pointerdown', () => this.shift.discard(i));
      this.bundleView.add(item);
    });
  }

  renderDynamic() {
    const s = this.shift;
    const g = this.dyn.clear();

    // HUD
    const left = Math.ceil(s.timeLeft);
    this.timerText.setText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    this.timerText.setColor(left <= 10 ? '#ffe066' : '#ffffff');
    // каса наживо: продажі мінус гелій (кульки вже оплачені на закупівлі, оренда — в кінці дня)
    const live = this.run.money + s.stats.revenue + s.stats.tips - heliumCost(CONFIG, s.stats.heliumUsed);
    this.moneyText.setText(`${live} ₴`);
    this.queueText.setText(s.queue.length ? t('queue', { n: s.queue.length }) : '');

    // полиця із залишками
    const sg = this.shelfGfx.clear();
    this.keys.forEach((key, i) => {
      const sp = this.shelf[i];
      const n = s.stock[key];
      const flashing = this.time.now - (this.flash[key] || -1e9) < 500;
      sg.fillStyle(flashing ? 0xffd6dc : C.white, 1).fillCircle(sp.x, sp.y, sp.bg);
      drawItem(sg, ITEM(key), sp.x, sp.y - sp.r * 0.15, sp.r, n > 0 ? 1 : 0.25);
      this.stockTexts[i].setText(String(n)).setBackgroundColor(n > 0 ? '#b338b5' : '#ff4d5e');
    });

    // терпіння
    let readyFor = false;
    this.custViews.forEach((c) => {
      if (!c) return;
      const pat = c.cust.noStock ? CONFIG.customers.noStockLeaveSec : CONFIG.customers.patienceSec;
      const start = c.cust.noStock ? c.cust.leaveAt - pat : c.cust.arrivedAt;
      const f = Math.max(0, 1 - (s.t - start) / pat);
      const col = f > 0.5 ? C.green : f > 0.25 ? C.gold : C.red;
      c.bar.clear();
      if (s.bundle.length && bundleMatches(c.cust.order, s.bundle)) {
        const { top, h } = c.bubble;
        c.bar.lineStyle(8, C.green, 0.6 + 0.4 * Math.sin(this.time.now / 120)).strokeRoundedRect(-106, top - 6, 212, h + 12, 30);
        readyFor = true;
      }
      c.bar.fillStyle(C.grey, 1).fillRoundedRect(-80, 214, 160, 16, 8)
        .fillStyle(col, 1).fillRoundedRect(-80, 214, Math.max(16, 160 * f), 16, 8);
    });

    // гелій
    const hf = s.helium / s.p.tank;
    g.fillStyle(s.refillLeft > 0 ? C.greyDark : C.pinkSoft, 1);
    const hh = (TANK.h - 20) * hf;
    if (hh > 0) g.fillRoundedRect(TANK.x + 10, TANK.y + TANK.h - 10 - hh, TANK.w - 20, hh, 20);
    this.heliumText.setText(`${t('helium')}: ${s.helium}`);
    this.refillText.setText(s.refillLeft > 0 ? t('refill', { s: Math.ceil(s.refillLeft) }) : '');

    // кулька на соплі
    const nz = s.nozzle;
    let hint = t('pickBalloon');
    if (this.pickAnim) {
      const k = this.pickAnim.t;
      const x = this.pickAnim.x + (NOZZLE.x - this.pickAnim.x) * k;
      const y = this.pickAnim.y + (NOZZLE.y - 20 - this.pickAnim.y) * k;
      drawItem(g, ITEM(this.pickAnim.key), x, y, 22);
      hint = '';
    } else if (nz) {
      const r = 20 + nz.fill * 80;
      const sad = nz.state === 'ready' && nz.quality === 'under';
      drawItem(g, ITEM(nz.key), NOZZLE.x + (sad ? 10 : 0), NOZZLE.y - r * 1.05 + (sad ? 10 : 0), r, sad ? 0.75 : 1);
      hint = nz.state === 'ready' ? t('tapToTie') : nz.state === 'empty' ? t('hold') : '';
    }
    if (readyFor && !nz) hint = t('giveHint');
    this.hintText.setText(hint);

    // кнопка: сіра — немає кульки, маджента — тримай, зелена — зав'язати
    const pulse = 1 + 0.06 * Math.sin(this.time.now / 150);
    let bCol = C.grey, bLabel = t('btnPick'), br = BTN.r;
    if (nz && !this.pickAnim) {
      if (nz.state === 'empty') { bCol = C.magenta; bLabel = t('btnHold'); br = BTN.r * pulse; }
      else if (nz.state === 'inflating') { bCol = C.purple; bLabel = t('btnHold'); br = BTN.r * 0.92; }
      else { bCol = C.green; bLabel = t('btnTie'); br = BTN.r * pulse; }
    }
    g.fillStyle(C.white, 1).fillCircle(BTN.x, BTN.y, br + 8);
    g.fillStyle(bCol, 1).fillCircle(BTN.x, BTN.y, br);
    this.btnText.setText(bLabel);

    // маркер шкали
    const f = nz ? nz.fill : 0;
    const my = METER.bottom - f * (METER.bottom - METER.top);
    g.fillStyle(C.ink, 1).fillRect(METER.x - METER.w / 2 - 8, my - 3, METER.w + 16, 6);
    g.fillTriangle(METER.x - METER.w / 2 - 26, my - 14, METER.x - METER.w / 2 - 26, my + 14, METER.x - METER.w / 2 - 8, my);
  }

  floatText(x, y, str, color) {
    const now = this.time.now;
    if (now - (this.floatAt[str] || 0) < 800) return;
    this.floatAt[str] = now;
    const tx = this.add.text(x, y, str, txt(38, color, { stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0.5).setDepth(3);
    this.tweens.add({ targets: tx, y: y - 70, alpha: 0, duration: 900, onComplete: () => tx.destroy() });
  }

  burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const p = this.add.circle(x, y, 10, color);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 130, y: y + Math.sin(a) * 130, alpha: 0, scale: 0.3, duration: 450, onComplete: () => p.destroy() });
    }
  }
}
