import { W, C, txt, drawItem } from '../theme.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { Shift, makeRng, summarize, bundleCovers, heliumCost } from '../logic.js';
import { endDay, saveRun } from '../run.js';
import { P, SPOT, drawRoom, drawCounter, drawPerson, lookFor } from '../iso.js';
import { coinIcon, soundToggle } from '../ui.js';
import * as sfx from '../sfx.js';

const ITEM = (k) => CONFIG.items[k];
const BTN = { x: 606, y: 1168, r: 84 };        // кнопка «Тримай / Зав'язати»
const TRASH = { x: 458, y: 1168, r: 40 };      // кнопка «скинути зв'язку»
const PANEL = { y: 1064, h: 208 };             // нижня панель
const METER = { x: 664, top: 760, h: 210 };    // шкала надування — праворуч, над кнопкою
const HINT_Y = 1010;                            // плашка-підказка над панеллю

// Товари на панелі: до 3 — один ряд, більше — два ряди по 3 (великі, щоб легко влучати)
function barSlots(n) {
  return Array.from({ length: n }, (_, i) => n <= 3
    ? { x: 84 + i * 112, y: 1168, r: 46 }
    : { x: 84 + (i % 3) * 112, y: i < 3 ? 1118 : 1220, r: 44 });
}
const BUBBLE_Y = -168;                          // низ хмаринки над головою
const WALK = 5;                                 // швидкість ходьби, клітинок/с
const shadeDark = 0xa10e93;
const MONEY_ICON = { x: 48, y: 55 };             // куди летять монетки
const TICKET = { x: 544, y: 140, w: 162, h: 176 }; // чек онлайн-замовлення — праворуч угорі
const COURIER = { shirt: 0xff8a3d, pants: 0x2f2f44, skin: 0xf2c3a0, hair: 0x2b1a12 };
const SELLER = { shirt: 0xffffff, pants: 0x5b4a8a, skin: 0xf6c9a8, hair: 0x6b3b1f, apron: C.magenta };

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.run = this.registry.get('run');
    const opts = this.registry.get('opts') || {};
    const rng = opts.seed != null ? makeRng(opts.seed + this.run.day) : Math.random;
    this.shift = new Shift(CONFIG, { rng, shiftSec: opts.shift, owned: this.run.owned, stock: this.run.stock });
    this.keys = this.shift.p.open;
    this.people = new Map();
    this.pickAnim = null;
    this.flash = {};
    this.floatAt = {};
    this.shownMoney = this.run.money;             // каса на екрані «набігає» до справжньої
    this.heldCash = 0;                            // гроші, що ще летять монетками в касу
    this.lastSec = null;
    this.squashAt = -1e9;
    this.ending = false;
    this.couriers = [];

    this.cameras.main.setBackgroundColor(0x3b2250);

    // Сцена: зал → продавець → прилавок → кулька/зв'язка → люди → інтерфейс
    const { tankTop } = drawRoom(this);
    const seller = this.add.graphics().setDepth(1);
    drawPerson(seller, SELLER, false);
    const [sx, sy] = P(...SPOT.seller);
    seller.setPosition(sx, sy);
    this.add.text(sx, sy - 64, 'MagicAir', txt(10, C.white)).setOrigin(0.5).setDepth(1);
    drawCounter(this, tankTop);
    this.nozzle = P(...SPOT.nozzle);
    this.dyn = this.add.graphics().setDepth(3);
    this.nzG = this.add.graphics().setDepth(3);  // кулька на соплі — окремо, щоб пружинила
    this.bundleView = this.add.container(0, 0).setDepth(4);

    // Тап по кульці на соплі — те саме, що кнопка
    this.add.zone(this.nozzle[0], this.nozzle[1] - 80, 180, 180).setInteractive().setDepth(5)
      .on('pointerdown', () => this.pressMain());

    this.buildHud();
    this.buildBar();

    const up = () => this.shift.release();
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('gameout', up);

    this.renderBundle();
    this.buildTicket();
    soundToggle(this, 48, 178);
    this.events.once('shutdown', () => sfx.inflateStop());
    if (typeof window !== 'undefined') window.__scene = this;
  }

  // ---------- інтерфейс ----------
  pill(x, y, w, h, color = C.white) {
    const g = this.add.graphics().setDepth(100);
    const r = Math.min(w, h) / 2;
    g.fillStyle(0x3a1f45, 0.25).fillRoundedRect(x, y + 4, w, h, r);
    g.fillStyle(color, 1).fillRoundedRect(x, y, w, h, r);
    return g;
  }

  buildHud() {
    this.pill(20, 30, 210, 50);
    const g = this.add.graphics().setDepth(101);
    coinIcon(g, MONEY_ICON.x, MONEY_ICON.y, 15);
    this.moneyText = this.add.text(76, 55, '', txt(24, C.ink)).setOrigin(0, 0.5).setDepth(101);
    this.pill(20, 92, 210, 50);
    g.fillStyle(0x4f8dff, 1).fillRoundedRect(39, 102, 18, 30, 8).fillStyle(0x7c8a99, 1).fillRect(44, 97, 8, 6);
    this.heliumText = this.add.text(76, 117, '', txt(22, C.ink)).setOrigin(0, 0.5).setDepth(101);
    this.pill(W / 2 - 80, 28, 160, 72, C.purple);
    this.timerText = this.add.text(W / 2, 64, '', txt(42, C.white)).setOrigin(0.5).setDepth(101);
    this.pill(520, 30, 180, 50);
    this.add.text(610, 55, t('day', { n: this.run.day }), txt(24, C.ink)).setOrigin(0.5).setDepth(101);
    this.stars = this.add.graphics().setDepth(101);

    // шкала надування (зелена зона залежить від насоса)
    const p = this.shift.p, { x, top, h } = METER;
    const yOf = (f) => top + h - f * h;
    const m = this.pill(x - 26, top - 12, 52, h + 24);
    m.fillStyle(0xe6dcea, 1).fillRoundedRect(x - 14, top, 28, h, 14);
    m.fillStyle(C.green, 1).fillRect(x - 14, yOf(p.greenMax), 28, yOf(p.greenMin) - yOf(p.greenMax));
    m.fillStyle(C.red, 1).fillRect(x - 14, top + 6, 28, Math.max(0, yOf(p.greenMax) - top - 6));
    this.ui = this.add.graphics().setDepth(102);

    // підказка над панеллю
    this.hintBg = this.add.graphics().setDepth(100);
    this.hintText = this.add.text(300, HINT_Y + 22, '', txt(22, C.white)).setOrigin(0.5).setDepth(101);
  }

  buildBar() {
    const g = this.add.graphics().setDepth(100);
    g.fillStyle(0x3a1f45, 0.25).fillRoundedRect(10, PANEL.y + 4, 700, PANEL.h, 36);
    g.fillStyle(C.white, 0.97).fillRoundedRect(10, PANEL.y, 700, PANEL.h, 36);
    this.barGfx = this.add.graphics().setDepth(101);
    this.slots = barSlots(this.keys.length);
    this.stockTexts = this.slots.map((sl) => this.add.text(sl.x + sl.r * 0.62, sl.y + sl.r * 0.72, '', txt(17, C.white)).setOrigin(0.5).setDepth(103));
    this.keys.forEach((key, i) => {
      const sl = this.slots[i];
      this.add.zone(sl.x, sl.y, sl.r * 2 + 16, sl.r * 2 + 8).setInteractive().setDepth(104)
        .on('pointerdown', () => this.shift.pick(key));
    });
    // скинути всю зв'язку з прилавка
    this.trashGfx = this.add.graphics().setDepth(102);
    this.trashText = this.add.text(TRASH.x, TRASH.y - 6, '✕', txt(30, C.white)).setOrigin(0.5).setDepth(103);
    this.trashSub = this.add.text(TRASH.x, TRASH.y + TRASH.r + 14, t('trash'), txt(16, C.greyDark)).setOrigin(0.5).setDepth(103);
    this.add.circle(TRASH.x, TRASH.y, TRASH.r + 6).setInteractive().setDepth(104)
      .on('pointerdown', () => this.shift.discardAll());
    this.btnGfx = this.add.graphics().setDepth(102);
    this.btnText = this.add.text(BTN.x, BTN.y - 4, '', txt(30, C.white, { align: 'center' })).setOrigin(0.5).setDepth(103);
    this.btnSub = this.add.text(BTN.x, BTN.y + 28, '', txt(18, 0xffd6f4)).setOrigin(0.5).setDepth(103);
    this.add.circle(BTN.x, BTN.y, BTN.r + 12).setInteractive().setDepth(104)
      .on('pointerdown', () => this.pressMain());
  }

  // Кнопка / тап по кульці: тримаєш — надуваєш, готова — зав'язати
  pressMain() {
    const nz = this.shift.nozzle;
    if (!nz) return;
    if (nz.state === 'ready') this.shift.tie();
    else if (nz.state === 'empty' && this.shift.startInflate()) this.pickAnim = null;
  }

  // ---------- люди ----------
  spawn(cust) {
    const look = lookFor(cust.id);
    const c = this.add.container(0, 0);
    const front = this.add.graphics(); drawPerson(front, look, false);
    const back = this.add.graphics(); drawPerson(back, look, true);
    const hands = this.add.graphics();
    const tag = this.add.text(0, -196, t('queueTag'), txt(17, C.greyDark, { backgroundColor: '#ffffffe6', padding: { x: 12, y: 4 } })).setOrigin(0.5).setVisible(false);
    const bubble = this.add.container(0, BUBBLE_Y);
    const bar = this.add.graphics();
    c.add([front, back, hands, bubble, bar, tag]);
    this.drawBubble(bubble, cust);
    c.setInteractive(new Phaser.Geom.Rectangle(-60, -250, 120, 250), Phaser.Geom.Rectangle.Contains);
    const v = { id: cust.id, c, front, back, hands, bubble, bar, tag, cust, pos: [...SPOT.door], target: [...SPOT.door], slot: -1, state: 'in' };
    c.on('pointerdown', () => { if (v.slot >= 0) this.shift.give(v.slot); });
    this.people.set(cust.id, v);
    sfx.arrive();
    return v;
  }

  // Хмаринка замовлення: сітка по 2 в ряд (ширина не росте з асортиментом), кількість — бейджем
  drawBubble(b, cust) {
    const entries = Object.entries(cust.order);
    const cols = Math.min(2, entries.length), rows = Math.ceil(entries.length / 2);
    const CW = 38, CH = 38, w = 12 + cols * CW, h = 10 + rows * CH;
    const g = this.add.graphics();
    g.fillStyle(0x3a1f45, 0.2).fillRoundedRect(-w / 2, -h + 4, w, h, 16);
    g.fillStyle(C.white, 1).fillRoundedRect(-w / 2, -h, w, h, 16).fillTriangle(-9, -1, 9, -1, 0, 12);
    b.add(g);
    entries.forEach(([key, n], i) => {
      const row = Math.floor(i / cols), inRow = Math.min(cols, entries.length - row * cols);
      const ix = (i % cols - (inRow - 1) / 2) * CW, iy = -h + 5 + CH / 2 + row * CH;
      drawItem(g, ITEM(key), ix - 2, iy - 2, 12);
      if (n > 1) {
        g.fillStyle(C.magenta, 1).fillCircle(ix + 11, iy + 10, 9);
        b.add(this.add.text(ix + 11, iy + 10, String(n), txt(13, C.white)).setOrigin(0.5));
      }
    });
    if (cust.noStock) {
      g.lineStyle(7, C.red, 0.9).lineBetween(-w / 2 + 12, -h + 12, w / 2 - 12, -12).lineBetween(w / 2 - 12, -h + 12, -w / 2 + 12, -12);
    }
    b.w = w; b.h = h;
    b.setVisible(false);
  }

  syncPeople(dt) {
    const s = this.shift;
    const want = new Map();
    s.customers.forEach((c, i) => c && want.set(c.id, { cust: c, pos: SPOT.slots[i], slot: i }));
    s.queue.forEach((c, j) => want.set(c.id, { cust: c, pos: SPOT.queue[j], slot: -1 }));

    for (const [id, w] of want) {
      const v = this.people.get(id) || this.spawn(w.cust);
      v.target = w.pos; v.slot = w.slot; v.cust = w.cust;
      if (w.cust.noStock && !v.noStockDrawn) { v.bubble.removeAll(true); this.drawBubble(v.bubble, w.cust); v.noStockDrawn = true; }
    }
    for (const v of this.people.values()) {
      if (!want.has(v.id) && v.state !== 'leave') { v.state = 'leave'; v.slot = -1; v.target = SPOT.door; v.bubble.setVisible(false); v.bar.clear(); }
    }

    for (const v of [...this.people.values()]) {
      const dx = v.target[0] - v.pos[0], dy = v.target[1] - v.pos[1];
      const dist = Math.hypot(dx, dy);
      const step = Math.min(dist, WALK * dt);
      const moving = dist > 0.02;
      if (moving) { v.pos[0] += (dx / dist) * step; v.pos[1] += (dy / dist) * step; }
      const [sx, sy] = P(v.pos[0], v.pos[1]);
      let bob = moving ? -Math.abs(Math.sin(this.time.now / 90)) * 4 : 0, shake = 0;
      const kh = (this.time.now - (v.hopAt || -1e9)) / 420;    // радіє — підстрибує
      if (kh < 1) bob -= Math.sin(kh * Math.PI) * 34;
      const ks = (this.time.now - (v.shakeAt || -1e9)) / 400;  // сердиться — мотає
      if (ks < 1) shake = Math.sin(ks * Math.PI * 6) * 9 * (1 - ks);
      v.c.setPosition(sx + shake, sy + bob).setDepth(10 + sy / 2000);
      const faceUs = moving && dx + dy > 0;
      v.front.setVisible(faceUs); v.back.setVisible(!faceUs);
      v.bubble.setVisible(!moving && v.slot >= 0);
      v.tag.setVisible(!moving && v.slot < 0 && v.state !== 'leave' && v.target === SPOT.queue[0]);
      if (v.state === 'leave' && !moving) {
        this.people.delete(v.id);
        this.tweens.add({ targets: v.c, alpha: 0, duration: 250, onComplete: () => v.c.destroy() });
      }
    }
  }

  // ---------- події логіки ----------
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
    // шипіння гелію — поки кулька надувається
    const nz = s.nozzle;
    if (nz && nz.state === 'inflating') { sfx.inflateStart(); sfx.inflateLevel(nz.fill); } else sfx.inflateStop();
    this.syncPeople(deltaMs / 1000);
    this.moveCouriers(deltaMs / 1000);
    this.renderDynamic(deltaMs / 1000);
  }

  barPos(key) { const sl = this.slots[this.keys.indexOf(key)]; return [sl.x, sl.y]; }

  onEvent(e) {
    const s = this.shift;
    switch (e.type) {
      case 'leave': {
        const v = this.people.get(e.id);
        if (v) { this.floatText(v.c.x, v.c.y - 250, e.noStock ? t('noStock') : '☹', C.red); v.shakeAt = this.time.now; }
        sfx.leave();
        break;
      }
      case 'sale': {
        const v = this.people.get(e.id);
        if (v) {
          // клієнт іде з кульками
          const items = Object.entries(e.order).flatMap(([k, n]) => Array(n).fill(k));
          items.forEach((k, i) => {
            const bx = 34 + (i % 3) * 16, by = -150 - i * 14;
            v.hands.lineStyle(1.5, 0x7a6a80, 1).lineBetween(30, -58, bx, by + 16);
            drawItem(v.hands, ITEM(k), bx, by, 15);
          });
          this.floatText(v.c.x, v.c.y - 250, `+${e.value}` + (e.tip ? ` (+${e.tip})` : '') + ' ₴', C.green);
          v.hopAt = this.time.now;
          this.heartPop(v.c.x + 20, v.c.y - 200);
          this.flyCoins(v.c.x, v.c.y - 130, Math.min(8, 2 + Math.round((e.value + e.tip) / 20)), e.value + e.tip);
        }
        if (e.tip) sfx.tip();
        this.renderBundle();
        break;
      }
      case 'mismatch': {
        const v = [...this.people.values()].find((x) => x.slot === e.slot);
        if (v) {
          v.shakeAt = this.time.now;
          this.floatText(v.c.x, v.c.y - 250, t('mismatch'), C.red);
        }
        sfx.wrong();
        break;
      }
      case 'pick': { const [x, y] = this.barPos(e.key); this.pickAnim = { key: e.key, x, y, t: 0 }; sfx.pick(); break; }
      case 'outOfStock': { const [x, y] = this.barPos(e.key); this.floatText(x, y - 70, t('outOfStock'), C.red); this.flash[e.key] = this.time.now; sfx.wrong(); break; }
      case 'inflated': this.floatText(this.nozzle[0] + 20, this.nozzle[1] - 190, t('perfect'), C.green); this.squashAt = this.time.now; sfx.perfect(); break;
      case 'under': this.floatText(this.nozzle[0] + 30, this.nozzle[1] - 190, t('underMore'), C.purple); this.squashAt = this.time.now; sfx.under(); break;
      case 'pop':
        sfx.pop();
        this.cameras.main.shake(140, 0.006);
        this.burst(this.nozzle[0], this.nozzle[1] - 90, ITEM(e.key).color);
        this.floatText(this.nozzle[0] + 20, this.nozzle[1] - 190, `${t('pop')} −${e.loss} ₴`, C.red);
        this.flash[e.key] = this.time.now;
        break;
      case 'tie': {
        sfx.tie();
        this.renderBundle();
        const item = this.bundleView.list[this.bundleView.list.length - 1];
        if (item) {
          const tx = item.x, ty = item.y;
          item.setPosition(this.nozzle[0], this.nozzle[1] - 90).setScale(2);
          this.tweens.add({ targets: item, x: tx, y: ty, scale: 1, duration: 260, ease: 'Cubic.easeOut' });
        }
        break;
      }
      case 'discard': this.renderBundle(); sfx.discard(); break;
      case 'bundleFull': this.floatText(W / 2, 1000, t('bundleFull'), C.red); sfx.wrong(); break;
      case 'noHelium': this.floatText(130, 150, t('refill', { s: Math.ceil(s.refillLeft) }), C.red); sfx.noHelium(); break;
      case 'refilled': sfx.refilled(); break;
      case 'onlineNew': this.showTicket(e.order); sfx.phone(); break;
      case 'onlineMismatch':
        this.tweens.add({ targets: this.ticket, x: this.ticketX + 10, duration: 50, yoyo: true, repeat: 2 });
        this.floatText(TICKET.x + TICKET.w / 2, TICKET.y + TICKET.h + 30, t('mismatch'), C.red);
        sfx.wrong();
        break;
      case 'onlinePacked': this.hideTicket(true); this.sendCourier(e.value + e.tip, e.tip); sfx.pack(); break;
      case 'onlineMissed':
        this.hideTicket(false);
        this.floatText(W - 230, TICKET.y + TICKET.h + 30, t('cancelled'), C.red);
        sfx.leave();
        break;
      case 'end': {
        // кульки на соплі й у зв'язці повертаються на склад
        const back = { ...s.stock };
        if (s.nozzle) back[s.nozzle.key]++;
        for (const b of s.bundle) back[b.key]++;
        const sum = summarize(CONFIG, s.stats, this.run.money);
        const run = endDay(this.run, sum, back);
        this.registry.set('run', run);
        saveRun(run);
        this.showShiftOver(() => this.scene.start('summary', { day: this.run.day, sum }));
        break;
      }
    }
  }

  // Зв'язка на прилавку: вузлик і кульки віялом; тап по кульці — викинути
  renderBundle() {
    this.bundleView.removeAll(true);
    const b = this.shift.bundle;
    if (!b.length) return;
    const [bx, by] = P(...SPOT.bundle);
    const strings = this.add.graphics();
    this.bundleView.add(strings);
    strings.fillStyle(0xffc933, 1).fillRoundedRect(bx - 10, by - 8, 20, 10, 3);
    b.forEach((ball, i) => {
      const x = bx + (i - (b.length - 1) / 2) * 26, y = by - 62 - (i % 2) * 18;
      strings.lineStyle(1.5, 0x7a6a80, 1).lineBetween(bx, by - 6, x, y + 16);
      const g = this.add.graphics();
      const perfect = ball.quality === 'perfect';
      drawItem(g, ITEM(ball.key), 0, 0, perfect ? 16 : 13, perfect ? 1 : 0.7);
      const item = this.add.container(x, y, [g]).setSize(30, 40).setInteractive();
      item.on('pointerdown', () => this.shift.discard(i));
      this.bundleView.add(item);
    });
  }

  renderDynamic(dt = 0) {
    const s = this.shift;
    const g = this.dyn.clear();
    const ui = this.ui.clear();

    // HUD
    const left = Math.ceil(s.timeLeft);
    this.timerText.setText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    this.timerText.setColor(left <= 10 ? '#ffe066' : '#ffffff');
    if (left !== this.lastSec) {
      // останні 10 секунд — таймер пульсує й цокає
      if (this.lastSec != null && left <= 10 && left > 0) {
        sfx.tick();
        this.tweens.add({ targets: this.timerText, scale: { from: 1.3, to: 1 }, duration: 300, ease: 'Back.easeOut' });
      }
      this.lastSec = left;
    }
    const live = this.run.money + s.stats.revenue + s.stats.tips - heliumCost(CONFIG, s.stats.heliumUsed) - this.heldCash;
    this.shownMoney += (live - this.shownMoney) * Math.min(1, dt * 6);
    if (Math.abs(live - this.shownMoney) < 0.5) this.shownMoney = live;
    this.moneyText.setText(`${Math.round(this.shownMoney)} ₴`);
    this.heliumText.setText(s.refillLeft > 0 ? t('refill', { s: Math.ceil(s.refillLeft) }) : `${s.helium} / ${s.p.tank}`);
    this.heliumText.setColor(s.refillLeft > 0 ? '#ff4d5e' : '#3a2340');
    // рейтинг: частка обслужених клієнтів, 5 зірок
    const total = s.stats.served + s.stats.lost;
    const rating = total ? (5 * s.stats.served) / total : 5;
    this.stars.clear();
    for (let i = 0; i < 5; i++) {
      const pts = [];
      for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, rr = j % 2 ? 6.2 : 13; pts.push({ x: 548 + i * 31 + Math.cos(a) * rr, y: 110 + Math.sin(a) * rr }); }
      this.stars.fillStyle(i < Math.round(rating) ? 0xffc21a : 0xe6dcea, 1).fillPoints(pts, true);
    }

    // терпіння і підсвітка готового замовлення
    let readyFor = false;
    for (const v of this.people.values()) {
      if (v.slot < 0 || !v.bubble.visible) { v.bar.clear(); continue; }
      const c = v.cust;
      const pat = c.noStock ? CONFIG.customers.noStockLeaveSec : CONFIG.customers.patienceSec;
      const start = c.noStock ? c.leaveAt - pat : c.seatedAt;
      const f = Math.max(0, 1 - (s.t - start) / pat);
      const col = f > 0.5 ? C.green : f > 0.25 ? C.gold : C.red;
      v.bubble.angle = f < 0.25 && !c.noStock ? Math.sin(this.time.now / 55) * 5 : 0;   // скоро піде — хмаринка тремтить
      const { w, h } = v.bubble, top = BUBBLE_Y - h;
      v.bar.clear();
      if (s.bundle.length && !c.noStock && bundleCovers(c.order, s.bundle)) {
        v.bar.lineStyle(6, C.green, 0.6 + 0.4 * Math.sin(this.time.now / 120)).strokeRoundedRect(-w / 2 - 3, top - 3, w + 6, h + 6, 19);
        readyFor = true;
      }
      v.bar.fillStyle(C.white, 0.9).fillRoundedRect(-36, top - 16, 72, 9, 4.5)
        .fillStyle(col, 1).fillRoundedRect(-36, top - 16, Math.max(9, 72 * f), 9, 4.5);
    }

    // кулька на соплі
    const [nx, ny] = this.nozzle;
    const nz = s.nozzle;
    let hint = t('pickBalloon');
    if (this.pickAnim) {
      const k = this.pickAnim.t;
      drawItem(g, ITEM(this.pickAnim.key), this.pickAnim.x + (nx - this.pickAnim.x) * k, this.pickAnim.y + (ny - 30 - this.pickAnim.y) * k, 20);
      hint = '';
    }
    this.nzG.clear().setVisible(!!nz && !this.pickAnim);
    if (nz && !this.pickAnim) {
      const r = 14 + nz.fill * 62;
      if (nz.state === 'inflating') g.fillStyle(C.white, 0.22).fillCircle(nx, ny - 22 - r, r + 22);
      // пружинка: під час надування дрібно тремтить, після відпускання — сплющується й відскакує
      let sx = 1, sy = 1;
      const k = (this.time.now - this.squashAt) / 500;
      if (nz.state === 'inflating') { const w = Math.sin(this.time.now / 35) * 0.035; sx += w; sy -= w; }
      else if (k < 1) { const w = Math.sin(k * Math.PI * 3) * 0.2 * (1 - k); sx += w; sy -= w; }
      else if (nz.state === 'ready') { const w = Math.sin(this.time.now / 260) * 0.02; sx -= w; sy += w; }
      drawItem(this.nzG, ITEM(nz.key), 0, -r, r);
      this.nzG.setPosition(nx, ny - 22).setScale(sx, sy);
    }
    if (!this.pickAnim && nz) {
      hint = nz.state === 'ready' ? t('tapToTie') : nz.state === 'empty' ? t('hold') : '';
    }
    // онлайн-чек: смужка часу й підсвітка, коли зв'язка підходить
    const tb = this.ticketBar.clear();
    let packReady = false;
    if (s.online) {
      const f = Math.max(0, (s.online.deadline - s.t) / CONFIG.online.timeSec);
      const { w, h } = TICKET;
      tb.fillStyle(0xe6dcea, 1).fillRoundedRect(14, h - 22, w - 28, 10, 5)
        .fillStyle(f > 0.5 ? C.green : f > 0.25 ? C.gold : C.red, 1).fillRoundedRect(14, h - 22, Math.max(10, (w - 28) * f), 10, 5);
      if (s.bundle.length && bundleCovers(s.online.order, s.bundle)) {
        tb.lineStyle(6, C.green, 0.6 + 0.4 * Math.sin(this.time.now / 120)).strokeRoundedRect(-3, -3, w + 6, h + 6, 20);
        packReady = true;
      }
      this.ticket.angle = f < 0.25 ? Math.sin(this.time.now / 55) * 3 : 0;
    }
    if (packReady && !nz) hint = t('packHint');
    if (readyFor && !nz) hint = t('giveHint');

    // підказка-плашка
    this.hintText.setText(hint);
    this.hintBg.clear();
    if (hint) {
      const w = this.hintText.width + 40;
      this.hintBg.fillStyle(hint === t('giveHint') || hint === t('packHint') ? C.green : C.purple, 1).fillRoundedRect(300 - w / 2, HINT_Y, w, 44, 22);
    }

    // маркер шкали
    const my = METER.top + METER.h - (nz ? nz.fill : 0) * METER.h;
    ui.fillStyle(C.ink, 1).fillRect(METER.x - 24, my - 3, 48, 6).fillTriangle(METER.x - 40, my - 10, METER.x - 40, my + 10, METER.x - 26, my);

    // нижня панель: товари із залишками
    const bg = this.barGfx.clear();
    this.keys.forEach((key, i) => {
      const { x, y, r: sr } = this.slots[i], n = s.stock[key];
      const flashing = this.time.now - (this.flash[key] || -1e9) < 500;
      bg.fillStyle(flashing ? 0xffd6dc : n ? 0xfff4fa : 0xf1eaf3, 1).fillCircle(x, y, sr);
      bg.lineStyle(3, n ? 0xfbc8e8 : 0xe3d8e8, 1).strokeCircle(x, y, sr);
      drawItem(bg, ITEM(key), x, y - 3, sr * 0.6, n ? 1 : 0.3);
      const bw = n > 9 ? 36 : 28, bx = x + sr * 0.62, by = y + sr * 0.72;
      bg.fillStyle(n ? C.purple : C.red, 1).fillRoundedRect(bx - bw / 2, by - 12, bw, 24, 12);
      this.stockTexts[i].setText(String(n));
    });
    // кнопка «скинути» — лише коли на прилавку є зв'язка
    const hasBundle = s.bundle.length > 0;
    this.trashGfx.clear();
    if (hasBundle) this.trashGfx.fillStyle(C.white, 1).fillCircle(TRASH.x, TRASH.y, TRASH.r + 6).fillStyle(C.greyDark, 1).fillCircle(TRASH.x, TRASH.y, TRASH.r);
    this.trashText.setVisible(hasBundle); this.trashSub.setVisible(hasBundle);

    // велика кнопка: сіра — обери кульку, маджента — тримай, зелена — зав'язати
    const pulse = 1 + 0.05 * Math.sin(this.time.now / 150);
    let col = C.grey, label = t('btnPick'), sub = '', r = BTN.r;
    if (nz && !this.pickAnim) {
      if (nz.state === 'empty') { col = C.magenta; label = t('btnHold'); sub = t(nz.fill > 0 ? 'btnMoreSub' : 'btnHoldSub'); r *= pulse; }
      else if (nz.state === 'inflating') { col = C.purple; label = t('btnHold'); sub = t('btnHoldSub'); r *= 0.93; }
      else { col = C.green; label = t('btnTie'); r *= pulse; }
    }
    this.btnGfx.clear().fillStyle(0x3a1f45, 0.25).fillCircle(BTN.x, BTN.y + 5, BTN.r + 12)
      .fillStyle(C.white, 1).fillCircle(BTN.x, BTN.y, BTN.r + 12).fillStyle(col, 1).fillCircle(BTN.x, BTN.y, r);
    this.btnText.setText(label).setFontSize(label.includes('\n') ? 24 : 28);
    this.btnSub.setText(sub);
  }

  // ---------- онлайн-замовлення ----------
  buildTicket() {
    const { x, y, w, h } = TICKET;
    this.ticket = this.add.container(W + 20, y).setDepth(110).setVisible(false);
    this.ticketBody = this.add.container(0, 0);
    this.ticketBar = this.add.graphics();
    this.ticket.add([this.ticketBody, this.ticketBar]);
    this.ticket.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => this.shift.pack());
    this.ticketX = x;
  }

  showTicket(order) {
    const { w, h } = TICKET, b = this.ticketBody;
    b.removeAll(true);
    const g = this.add.graphics();
    g.fillStyle(0x3a1f45, 0.25).fillRoundedRect(0, 5, w, h, 18);
    g.fillStyle(C.white, 1).fillRoundedRect(0, 0, w, h, 18);
    g.fillStyle(C.purple, 1).fillRoundedRect(0, 0, w, 40, { tl: 18, tr: 18, bl: 0, br: 0 });
    // телефончик у шапці
    g.fillStyle(C.white, 1).fillRoundedRect(14, 8, 16, 25, 4).fillStyle(C.purple, 1).fillRect(17, 12, 10, 15);
    b.add(g);
    b.add(this.add.text(40, 20, t('online'), txt(20, C.white)).setOrigin(0, 0.5));
    Object.entries(order).forEach(([key, n], i) => {
      const cx = 30 + (i % 3) * 51, cy = 70 + Math.floor(i / 3) * 46;
      drawItem(g, ITEM(key), cx, cy - 4, 13);
      b.add(this.add.text(cx + 14, cy + 12, `×${n}`, txt(15, C.ink)).setOrigin(0.5));
    });
    this.tweens.killTweensOf(this.ticket);
    this.ticket.setVisible(true).setAlpha(1).setAngle(0).setPosition(W + 20, TICKET.y);
    this.tweens.add({ targets: this.ticket, x: this.ticketX, duration: 380, ease: 'Back.easeOut' });
  }

  hideTicket(done) {
    this.tweens.killTweensOf(this.ticket);
    this.ticket.setAngle(0);
    this.tweens.add({
      targets: this.ticket, x: W + 20, y: done ? TICKET.y : TICKET.y + 40, alpha: done ? 1 : 0, duration: 350, ease: 'Cubic.easeIn',
      onComplete: () => this.ticket.setVisible(false).setAlpha(1).setY(TICKET.y),
    });
  }

  // Коробка на прилавку, кур'єр приходить, забирає, гроші летять у касу
  sendCourier(cash, tip) {
    this.heldCash += cash;                 // гроші «приїдуть» разом із кур'єром
    const [bx, by] = P(...SPOT.box);
    const box = this.add.container(bx, by).setDepth(4);
    const bg = this.add.graphics();
    [[-12, -44, 0xff5fb8], [4, -52, 0x4fa3ff], [16, -40, 0xffc933]].forEach(([x, y, col]) => drawItem(bg, { kind: 'latex', color: col }, x, y, 11));
    bg.fillStyle(0xa10e93, 1).fillRoundedRect(-24, -26, 48, 30, 5);
    bg.fillStyle(C.magenta, 1).fillRoundedRect(-24, -30, 48, 30, 5);
    bg.fillStyle(C.gold, 1).fillRect(-4, -30, 8, 30).fillRect(-24, -19, 48, 7);
    box.add(bg);
    box.setScale(0);
    this.tweens.add({ targets: box, scale: 1, duration: 250, ease: 'Back.easeOut' });

    const c = this.add.container(0, 0);
    const front = this.add.graphics(); drawPerson(front, COURIER, false);
    const back = this.add.graphics(); drawPerson(back, COURIER, true);
    // кепка й термосумка кур'єра
    front.fillStyle(0xff8a3d, 1).slice(0, -129, 26, Math.PI, 0, false).fillPath().fillRoundedRect(-4, -134, 34, 8, 4);
    front.fillStyle(0xd96a20, 1).fillRect(-24, -104, 6, 50).fillRect(18, -104, 6, 50);
    back.fillStyle(0xff8a3d, 1).slice(0, -129, 26, Math.PI, 0, false).fillPath();
    back.fillStyle(0xd96a20, 1).fillRoundedRect(-28, -116, 56, 58, 8).fillStyle(0xffffff, 0.9).fillRect(-18, -92, 36, 6);
    const hands = this.add.container(0, 0);
    c.add([front, back, hands]);
    this.couriers.push({ c, front, back, hands, box, cash, tip, pos: [...SPOT.courierFrom], target: SPOT.courier, phase: 'in', waitUntil: 0 });
  }

  moveCouriers(dt) {
    for (const k of [...this.couriers]) {
      const dx = k.target[0] - k.pos[0], dy = k.target[1] - k.pos[1];
      const dist = Math.hypot(dx, dy), moving = dist > 0.02;
      if (moving) { const st = Math.min(dist, WALK * dt); k.pos[0] += (dx / dist) * st; k.pos[1] += (dy / dist) * st; }
      const [sx, sy] = P(k.pos[0], k.pos[1]);
      const bob = moving ? -Math.abs(Math.sin(this.time.now / 90)) * 4 : 0;
      k.c.setPosition(sx, sy + bob).setDepth(10 + sy / 2000);
      const faceUs = !moving || dx + dy > 0;
      k.front.setVisible(faceUs); k.back.setVisible(!faceUs);
      if (k.phase === 'in' && !moving) {
        // забирає коробку з прилавка
        k.phase = 'take';
        const [hx, hy] = [sx - 34, sy - 70];
        this.tweens.add({
          targets: k.box, x: hx, y: hy, duration: 300, ease: 'Sine.easeInOut',
          onComplete: () => {
            k.box.setPosition(-34, -70); k.hands.add(k.box);
            this.heldCash -= k.cash;
            this.flyCoins(sx, sy - 160, Math.min(8, 3 + Math.round(k.cash / 40)), k.cash);
            if (k.tip) sfx.tip();
            k.phase = 'out'; k.target = SPOT.courierFrom;
          },
        });
      } else if (k.phase === 'out' && !moving) {
        this.couriers.splice(this.couriers.indexOf(k), 1);
        k.c.destroy();
      }
    }
  }

  floatText(x, y, str, color) {
    const now = this.time.now;
    if (now - (this.floatAt[str] || 0) < 800) return;
    this.floatAt[str] = now;
    const tx = this.add.text(x, y, str, txt(32, color, { stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: tx, y: y - 60, alpha: 0, duration: 1000, onComplete: () => tx.destroy() });
  }

  // Лопнула: клапті гуми розлітаються й падають, білий спалах-кільце
  burst(x, y, color) {
    const ring = this.add.circle(x, y, 30).setStrokeStyle(8, 0xffffff, 0.9).setDepth(6);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4, d = 70 + Math.random() * 70;
      const p = this.add.triangle(x, y, 0, 0, 16 + Math.random() * 10, 4, 6, 14, color).setDepth(6);
      const vx = Math.cos(a) * d, vy = Math.sin(a) * d - 40, spin = (Math.random() - 0.5) * 900;
      this.tweens.addCounter({
        from: 0, to: 1, duration: 650,
        onUpdate: (tw) => { const k = tw.getValue(); p.setPosition(x + vx * k, y + vy * k + 220 * k * k).setAngle(spin * k).setAlpha(1 - k * k); },
        onComplete: () => p.destroy(),
      });
    }
  }

  // Монетки летять від клієнта в касу
  flyCoins(x, y, n, cash) {
    this.heldCash += cash;
    for (let i = 0; i < n; i++) {
      const part = i < n - 1 ? Math.floor(cash / n) : cash - Math.floor(cash / n) * (n - 1);
      const g = this.add.graphics().setDepth(120);
      coinIcon(g, 0, 0, 13);
      g.setPosition(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 30).setScale(0);
      const x0 = g.x, y0 = g.y, cx = (x0 + MONEY_ICON.x) / 2 + 80, cy = Math.min(y0, MONEY_ICON.y) - 120;
      this.tweens.add({ targets: g, scale: 1, duration: 120, delay: i * 70 });
      this.tweens.addCounter({
        from: 0, to: 1, duration: 520, delay: 120 + i * 70, ease: 'Sine.easeIn',
        onUpdate: (tw) => {
          const k = tw.getValue(), m = 1 - k;   // крива Безьє через точку над сценою
          g.setPosition(m * m * x0 + 2 * m * k * cx + k * k * MONEY_ICON.x, m * m * y0 + 2 * m * k * cy + k * k * MONEY_ICON.y);
        },
        onComplete: () => {
          g.destroy();
          this.heldCash -= part;       // каса підростає з кожною монеткою
          sfx.coin();
          this.tweens.killTweensOf(this.moneyText);
          this.moneyText.setScale(1);
          this.tweens.add({ targets: this.moneyText, scale: 1.18, duration: 70, yoyo: true });
        },
      });
    }
  }

  // Сердечко над задоволеним клієнтом
  heartPop(x, y) {
    const g = this.add.graphics().setDepth(59);
    drawItem(g, { kind: 'heart', color: 0xff3b6b }, 0, 0, 20);
    g.setPosition(x, y).setScale(0);
    this.tweens.add({ targets: g, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: g, y: y - 70, alpha: 0, duration: 900, delay: 200, onComplete: () => g.destroy() });
  }

  // Кінець зміни: плашка «Зміну завершено!», потім підсумок
  showShiftOver(next) {
    if (this.ending) return;
    this.ending = true;
    sfx.inflateStop();
    sfx.shiftOver();
    const dim = this.add.rectangle(W / 2, 640, W, 1280, 0x2a1238, 0).setDepth(300).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.45, duration: 300 });
    const tx = this.add.text(0, 0, t('shiftOver'), txt(46, C.white)).setOrigin(0.5);
    const w = tx.width + 90, bg = this.add.graphics();
    bg.fillStyle(shadeDark, 1).fillRoundedRect(-w / 2, -48, w, 104, 52).fillStyle(C.magenta, 1).fillRoundedRect(-w / 2, -52, w, 104, 52);
    const box = this.add.container(W / 2, 600, [bg, tx]).setDepth(301).setScale(0);
    this.tweens.add({ targets: box, scale: 1, duration: 420, ease: 'Back.easeOut' });
    this.time.delayedCall(1500, next);
  }
}
