import { W, C, txt, drawItem } from '../theme.js';
import { t } from '../i18n.js';
import { CONFIG } from '../config.js';
import { Shift, makeRng, summarize, bundleMatches, heliumCost } from '../logic.js';
import { endDay, saveRun } from '../run.js';
import { P, SPOT, drawRoom, drawCounter, drawPerson, lookFor } from '../iso.js';

const ITEM = (k) => CONFIG.items[k];
const BTN = { x: 624, y: 1150, r: 76 };        // кнопка «Тримай / Зав'язати»
const BAR = { y: 1172, x0: 70, step: 82 };     // нижня панель товарів
const METER = { x: 664, top: 770, h: 220 };    // шкала надування — праворуч, над кнопкою
const BUBBLE_Y = -168;                          // низ хмаринки над головою
const WALK = 5;                                 // швидкість ходьби, клітинок/с
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
    g.fillStyle(C.green, 1).fillRoundedRect(32, 44, 32, 22, 4).fillStyle(C.white, 0.7).fillCircle(48, 55, 6);
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
    this.hintText = this.add.text(300, 1072, '', txt(22, C.white)).setOrigin(0.5).setDepth(101);
  }

  buildBar() {
    const g = this.add.graphics().setDepth(100);
    g.fillStyle(0x3a1f45, 0.25).fillRoundedRect(14, 1110, 692, 160, 36);
    g.fillStyle(C.white, 0.97).fillRoundedRect(14, 1106, 692, 160, 36);
    this.barGfx = this.add.graphics().setDepth(101);
    this.stockTexts = this.keys.map((_, i) => this.add.text(BAR.x0 + i * BAR.step + 22, BAR.y + 29, '', txt(16, C.white)).setOrigin(0.5).setDepth(103));
    this.keys.forEach((key, i) => {
      this.add.zone(BAR.x0 + i * BAR.step, BAR.y, 78, 90).setInteractive().setDepth(104)
        .on('pointerdown', () => this.shift.pick(key));
    });
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
    return v;
  }

  drawBubble(b, cust) {
    const entries = Object.entries(cust.order);
    const w = 30 + entries.length * 44, h = 76;
    const g = this.add.graphics();
    g.fillStyle(0x3a1f45, 0.2).fillRoundedRect(-w / 2, -h + 4, w, h, 22);
    g.fillStyle(C.white, 1).fillRoundedRect(-w / 2, -h, w, h, 22).fillTriangle(-10, -1, 10, -1, 0, 14);
    b.add(g);
    entries.forEach(([key, n], i) => {
      const ix = -w / 2 + 37 + i * 44;
      drawItem(g, ITEM(key), ix, -h + 30, 14);
      b.add(this.add.text(ix, -h + 64, `×${n}`, txt(16, C.ink)).setOrigin(0.5));
    });
    if (cust.noStock) {
      g.lineStyle(7, C.red, 0.9).lineBetween(-w / 2 + 14, -h + 12, w / 2 - 14, -12).lineBetween(w / 2 - 14, -h + 12, -w / 2 + 14, -12);
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
      const bob = moving ? -Math.abs(Math.sin(this.time.now / 90)) * 4 : 0;
      v.c.setPosition(sx, sy + bob).setDepth(10 + sy / 2000);
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
    this.syncPeople(deltaMs / 1000);
    this.renderDynamic();
  }

  barPos(key) { const i = this.keys.indexOf(key); return [BAR.x0 + i * BAR.step, BAR.y]; }

  onEvent(e) {
    const s = this.shift;
    switch (e.type) {
      case 'leave': {
        const v = this.people.get(e.id);
        if (v) this.floatText(v.c.x, v.c.y - 250, e.noStock ? t('noStock') : '☹', C.red);
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
        }
        this.renderBundle();
        break;
      }
      case 'mismatch': {
        const v = [...this.people.values()].find((x) => x.slot === e.slot);
        if (v) {
          this.tweens.add({ targets: v.c, x: v.c.x + 10, duration: 50, yoyo: true, repeat: 2 });
          this.floatText(v.c.x, v.c.y - 250, t('mismatch'), C.red);
        }
        break;
      }
      case 'pick': { const [x, y] = this.barPos(e.key); this.pickAnim = { key: e.key, x, y, t: 0 }; break; }
      case 'outOfStock': { const [x, y] = this.barPos(e.key); this.floatText(x, y - 70, t('outOfStock'), C.red); this.flash[e.key] = this.time.now; break; }
      case 'inflated': this.floatText(this.nozzle[0] + 20, this.nozzle[1] - 190, t(e.quality === 'perfect' ? 'perfect' : 'under'), e.quality === 'perfect' ? C.green : C.greyDark); break;
      case 'pop':
        this.burst(this.nozzle[0], this.nozzle[1] - 90, ITEM(e.key).color);
        this.floatText(this.nozzle[0] + 20, this.nozzle[1] - 190, `${t('pop')} −${e.loss} ₴`, C.red);
        this.flash[e.key] = this.time.now;
        break;
      case 'tie': {
        this.renderBundle();
        const item = this.bundleView.list[this.bundleView.list.length - 1];
        if (item) {
          const tx = item.x, ty = item.y;
          item.setPosition(this.nozzle[0], this.nozzle[1] - 90).setScale(2);
          this.tweens.add({ targets: item, x: tx, y: ty, scale: 1, duration: 260, ease: 'Cubic.easeOut' });
        }
        break;
      }
      case 'discard': this.renderBundle(); break;
      case 'bundleFull': this.floatText(W / 2, 1000, t('bundleFull'), C.red); break;
      case 'noHelium': this.floatText(130, 150, t('refill', { s: Math.ceil(s.refillLeft) }), C.red); break;
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

  renderDynamic() {
    const s = this.shift;
    const g = this.dyn.clear();
    const ui = this.ui.clear();

    // HUD
    const left = Math.ceil(s.timeLeft);
    this.timerText.setText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    this.timerText.setColor(left <= 10 ? '#ffe066' : '#ffffff');
    const live = this.run.money + s.stats.revenue + s.stats.tips - heliumCost(CONFIG, s.stats.heliumUsed);
    this.moneyText.setText(`${live} ₴`);
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
      const start = c.noStock ? c.leaveAt - pat : c.arrivedAt;
      const f = Math.max(0, 1 - (s.t - start) / pat);
      const col = f > 0.5 ? C.green : f > 0.25 ? C.gold : C.red;
      const { w, h } = v.bubble, top = BUBBLE_Y - h;
      v.bar.clear();
      if (s.bundle.length && bundleMatches(c.order, s.bundle)) {
        v.bar.lineStyle(6, C.green, 0.6 + 0.4 * Math.sin(this.time.now / 120)).strokeRoundedRect(-w / 2 - 3, top - 3, w + 6, h + 6, 24);
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
    } else if (nz) {
      const r = 14 + nz.fill * 62;
      const sad = nz.state === 'ready' && nz.quality === 'under';
      if (nz.state === 'inflating') g.fillStyle(C.white, 0.22).fillCircle(nx, ny - 22 - r, r + 22);
      drawItem(g, ITEM(nz.key), nx + (sad ? 8 : 0), ny - 22 - r + (sad ? 8 : 0), r, sad ? 0.75 : 1);
      hint = nz.state === 'ready' ? t('tapToTie') : nz.state === 'empty' ? t('hold') : '';
    }
    if (readyFor && !nz) hint = t('giveHint');

    // підказка-плашка
    this.hintText.setText(hint);
    this.hintBg.clear();
    if (hint) {
      const w = this.hintText.width + 40;
      this.hintBg.fillStyle(hint === t('giveHint') ? C.green : C.purple, 1).fillRoundedRect(300 - w / 2, 1050, w, 44, 22);
    }

    // маркер шкали
    const my = METER.top + METER.h - (nz ? nz.fill : 0) * METER.h;
    ui.fillStyle(C.ink, 1).fillRect(METER.x - 24, my - 3, 48, 6).fillTriangle(METER.x - 40, my - 10, METER.x - 40, my + 10, METER.x - 26, my);

    // нижня панель: товари із залишками
    const bg = this.barGfx.clear();
    this.keys.forEach((key, i) => {
      const x = BAR.x0 + i * BAR.step, y = BAR.y, n = s.stock[key];
      const flashing = this.time.now - (this.flash[key] || -1e9) < 500;
      bg.fillStyle(flashing ? 0xffd6dc : n ? 0xfff4fa : 0xf1eaf3, 1).fillCircle(x, y, 34);
      bg.lineStyle(3, n ? 0xfbc8e8 : 0xe3d8e8, 1).strokeCircle(x, y, 34);
      drawItem(bg, ITEM(key), x, y - 2, 20, n ? 1 : 0.3);
      const bw = n > 9 ? 34 : 26;
      bg.fillStyle(n ? C.purple : C.red, 1).fillRoundedRect(x + 22 - bw / 2, y + 18, bw, 22, 11);
      this.stockTexts[i].setText(String(n));
    });

    // велика кнопка: сіра — обери кульку, маджента — тримай, зелена — зав'язати
    const pulse = 1 + 0.05 * Math.sin(this.time.now / 150);
    let col = C.grey, label = t('btnPick'), sub = '', r = BTN.r;
    if (nz && !this.pickAnim) {
      if (nz.state === 'empty') { col = C.magenta; label = t('btnHold'); sub = t('btnHoldSub'); r *= pulse; }
      else if (nz.state === 'inflating') { col = C.purple; label = t('btnHold'); sub = t('btnHoldSub'); r *= 0.93; }
      else { col = C.green; label = t('btnTie'); r *= pulse; }
    }
    this.btnGfx.clear().fillStyle(0x3a1f45, 0.25).fillCircle(BTN.x, BTN.y + 5, BTN.r + 12)
      .fillStyle(C.white, 1).fillCircle(BTN.x, BTN.y, BTN.r + 12).fillStyle(col, 1).fillCircle(BTN.x, BTN.y, r);
    this.btnText.setText(label).setFontSize(label.includes('\n') ? 24 : 28);
    this.btnSub.setText(sub);
  }

  floatText(x, y, str, color) {
    const now = this.time.now;
    if (now - (this.floatAt[str] || 0) < 800) return;
    this.floatAt[str] = now;
    const tx = this.add.text(x, y, str, txt(32, color, { stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: tx, y: y - 60, alpha: 0, duration: 1000, onComplete: () => tx.destroy() });
  }

  burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const p = this.add.circle(x, y, 9, color).setDepth(6);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 110, y: y + Math.sin(a) * 110, alpha: 0, scale: 0.3, duration: 450, onComplete: () => p.destroy() });
    }
  }
}
