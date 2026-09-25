import { W, H, C, txt, drawItem, drawBalloon, itemArt, artSlot } from '../theme.js';
import { t, itemName } from '../i18n.js';
import { CONFIG } from '../config.js';
import { EventShift } from '../event.js';
import { saveRun } from '../run.js';
import { backdrop, button, card, coinIcon, confettiRain, countUp } from '../ui.js';
import * as sfx from '../sfx.js';

const ITEM = (k) => CONFIG.items[k];
const ARCH = { x: W / 2, y: 690, r: 270 };      // центр і радіус арки
const NOZ = { x: W / 2, y: 1000 };               // де надувається кулька
const BTN = { x: 606, y: 1168, r: 84 };
const PANEL = { y: 1064, h: 208 };
const METER = { x: 664, top: 760, h: 210 };

// Виїзд на оформлення: арка з кульок за схемою. Колір обираєш сам — кулька летить на своє місце.
export class EventScene extends Phaser.Scene {
  constructor() { super('event'); }

  create() {
    this.run = this.registry.get('run');
    this.b = this.run.booking;
    this.ev = new EventShift(CONFIG, this.b, { owned: this.run.owned, stock: this.run.stock });
    this.keys = [...new Set(this.b.slots)].sort((a, c) => this.b.slots.indexOf(a) - this.b.slots.indexOf(c));
    this.started = false;
    this.pickAnim = null;
    this.floatAt = {};
    this.flash = {};

    backdrop(this, 0xdff0ff, 0xfff4fa);
    sfx.musicSet('game');
    this.drawVenue();
    this.drawArch();
    this.slotView = this.b.slots.map(() => null);
    this.nzG = this.add.graphics().setDepth(20);
    this.flyG = this.add.container(0, 0).setDepth(25);
    this.buildHud();
    this.buildBar();
    const up = () => this.ev.release();
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.intro();
    if (typeof window !== 'undefined') window.__event = this;
  }

  // ---------- сцена свята ----------
  drawVenue() {
    if (this.textures.exists('bg-venue')) { this.add.image(0, 0, 'bg-venue').setOrigin(0).setDisplaySize(W, W * 1.5).setDepth(0); return; }
    const g = this.add.graphics().setDepth(0);
    // підлога
    g.fillStyle(0xf6e3d0, 1).fillRect(0, 900, W, 400);
    g.fillStyle(0xe8cfb8, 1).fillRect(0, 900, W, 8);
    // гірлянда-прапорці вгорі
    const cols = [C.magenta, 0x4fa3ff, C.gold, C.green];
    for (let i = 0; i < 12; i++) {
      const x = 20 + i * 60, y = 190 + Math.sin((i / 11) * Math.PI) * 26;
      g.fillStyle(cols[i % 4], 1).fillTriangle(x, y, x + 44, y, x + 22, y + 34);
    }
    g.lineStyle(2, C.greyDark, 1).beginPath();
    for (let i = 0; i <= 12; i++) { const x = 20 + i * 60, y = 190 + Math.sin((i / 11) * Math.PI) * 26; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.strokePath();
  }

  slotPos(i) {
    const n = this.b.slots.length, a = Math.PI - (i * Math.PI) / (n - 1);
    return [ARCH.x + Math.cos(a) * ARCH.r, ARCH.y - Math.sin(a) * ARCH.r];
  }

  get balloonR() { const n = this.b.slots.length; return Math.min(30, ((Math.PI * ARCH.r) / (n - 1)) * 0.56); }

  drawArch() {
    const g = this.add.graphics().setDepth(2);
    // каркас: дуга і дві стійки
    g.lineStyle(10, 0xc9c3d2, 1).beginPath().arc(ARCH.x, ARCH.y, ARCH.r, Math.PI, 0, false).strokePath();
    g.fillStyle(0xc9c3d2, 1).fillRect(ARCH.x - ARCH.r - 5, ARCH.y, 10, 230).fillRect(ARCH.x + ARCH.r - 5, ARCH.y, 10, 230);
    g.fillStyle(0xa79fb3, 1).fillRoundedRect(ARCH.x - ARCH.r - 34, ARCH.y + 222, 68, 18, 6).fillRoundedRect(ARCH.x + ARCH.r - 34, ARCH.y + 222, 68, 18, 6);
    // місця під кульки: пунктир потрібного кольору
    this.ghost = this.add.graphics().setDepth(3);
    this.ghostTexts = [];
    this.drawGhosts();
  }

  drawGhosts() {
    const g = this.ghost.clear(), r = this.balloonR;
    this.ghostTexts.forEach((x) => x.destroy());
    this.ghostTexts = [];
    this.b.slots.forEach((k, i) => {
      if (this.ev.placed[i]) return;
      const [x, y] = this.slotPos(i);
      const col = k === 'digit' ? 0xffc21a : k === 'confetti' ? 0xb9b0c4 : ITEM(k).color;
      g.fillStyle(col, 0.22).fillCircle(x, y, r);
      g.lineStyle(3, col, 0.9).strokeCircle(x, y, r);
      if (k === 'digit') this.ghostTexts.push(this.add.text(x, y, String(this.b.age || 7), txt(r * 1.3, 0xffc21a)).setOrigin(0.5).setAlpha(0.45).setDepth(3));
    });
  }

  placeBalloon(key, slot) {
    const [x, y] = this.slotPos(slot), r = this.balloonR;
    const c = this.add.container(NOZ.x, NOZ.y - 80).setDepth(10);
    const g = this.add.graphics();
    const art = itemArt(this, ITEM(key), 0, 0, r, 1, this.b.age || 7);
    if (art) c.add(art);
    else if (key === 'digit') c.add(this.add.text(0, 0, String(this.b.age || 7), txt(r * 1.6, 0xffc21a, { stroke: '#b37400', strokeThickness: 6 })).setOrigin(0.5));
    else { drawItem(g, ITEM(key), 0, 0, r); c.add(g); }
    c.setScale(1.6);
    this.tweens.add({
      targets: c, x, y, scale: 1, duration: 380, ease: 'Cubic.easeOut',
      onComplete: () => {
        this.drawGhosts();
        this.tweens.add({ targets: c, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      },
    });
    this.slotView[slot] = c;
  }

  // ---------- інтерфейс ----------
  pill(x, y, w, h, color = C.white) {
    const g = this.add.graphics().setDepth(100);
    g.fillStyle(0x3a1f45, 0.25).fillRoundedRect(x, y + 4, w, h, h / 2).fillStyle(color, 1).fillRoundedRect(x, y, w, h, h / 2);
    return g;
  }

  buildHud() {
    this.pill(20, 30, 230, 50);
    this.progText = this.add.text(135, 55, '', txt(24, C.ink)).setOrigin(0.5).setDepth(101);
    this.pill(W / 2 - 80, 28, 160, 72, C.purple);
    this.timerText = this.add.text(W / 2, 64, '', txt(42, C.white)).setOrigin(0.5).setDepth(101);
    this.pill(490, 30, 210, 50);
    const g = this.add.graphics().setDepth(101);
    coinIcon(g, 518, 55, 15);
    this.add.text(545, 55, `${this.b.pay} ₴`, txt(24, C.ink)).setOrigin(0, 0.5).setDepth(101);
    this.add.text(W / 2, 128, t('ev_' + this.b.kind), txt(26, C.purple, { stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0.5).setDepth(101);
    // шкала надування
    const p = this.ev.p, { x, top, h } = METER, yOf = (f) => top + h - f * h;
    const m = this.pill(x - 26, top - 12, 52, h + 24);
    m.fillStyle(0xe6dcea, 1).fillRoundedRect(x - 14, top, 28, h, 14);
    m.fillStyle(C.green, 1).fillRect(x - 14, yOf(p.greenMax), 28, yOf(p.greenMin) - yOf(p.greenMax));
    m.fillStyle(C.red, 1).fillRect(x - 14, top + 6, 28, Math.max(0, yOf(p.greenMax) - top - 6));
    this.ui = this.add.graphics().setDepth(102);
    this.hintBg = this.add.graphics().setDepth(100);
    this.hintText = this.add.text(300, 1032, '', txt(22, C.white)).setOrigin(0.5).setDepth(101);
  }

  buildBar() {
    const g = this.add.graphics().setDepth(100);
    g.fillStyle(0x3a1f45, 0.25).fillRoundedRect(10, PANEL.y + 4, 700, PANEL.h, 36);
    g.fillStyle(C.white, 0.97).fillRoundedRect(10, PANEL.y, 700, PANEL.h, 36);
    this.barGfx = this.add.graphics().setDepth(101);
    const n = this.keys.length;
    this.slots = this.keys.map((k, i) => n <= 3 ? { x: 84 + i * 112, y: 1168, r: 46 } : { x: 84 + (i % 3) * 112, y: i < 3 ? 1118 : 1220, r: 44 });
    this.badgeTexts = this.slots.map((sl) => this.add.text(sl.x + sl.r * 0.62, sl.y + sl.r * 0.72, '', txt(17, C.white)).setOrigin(0.5).setDepth(103));
    this.barArt = this.keys.map((key, i) => { const sl = this.slots[i], a = itemArt(this, ITEM(key), sl.x, sl.y - 3, sl.r * 0.6, 1, this.b.age || 7); return a && a.setDepth(102); });
    this.badgeGfx = this.add.graphics().setDepth(102.5);
    this.keys.forEach((key, i) => {
      const sl = this.slots[i];
      this.add.zone(sl.x, sl.y, sl.r * 2 + 16, sl.r * 2 + 8).setInteractive().setDepth(104).on('pointerdown', () => this.started && this.ev.pick(key));
    });
    this.btnGfx = this.add.graphics().setDepth(102);
    this.btnText = this.add.text(BTN.x, BTN.y - 4, '', txt(28, C.white, { align: 'center' })).setOrigin(0.5).setDepth(103);
    this.add.circle(BTN.x, BTN.y, BTN.r + 12).setInteractive().setDepth(104).on('pointerdown', () => this.pressMain());
    this.add.zone(NOZ.x, NOZ.y - 70, 170, 170).setInteractive().setDepth(21).on('pointerdown', () => this.pressMain());
  }

  pressMain() {
    const nz = this.ev.nozzle;
    if (!this.started || !nz) return;
    if (nz.state === 'ready') this.ev.tie();
    else if (nz.state === 'empty' && this.ev.startInflate()) this.pickAnim = null;
  }

  // Заставка: машина з кульками проїжджає — «виїжджаємо»
  intro() {
    const van = this.add.container(-260, 560).setDepth(300);
    const g = this.add.graphics();
    [[-30, -120, C.magenta], [0, -140, 0x4fa3ff], [30, -122, C.gold], [-5, -105, C.green]].forEach(([x, y, col]) => {
      g.lineStyle(2, C.greyDark, 1).lineBetween(x, y + 16, 0, -60); drawBalloon(g, x, y, 20, col);
    });
    g.fillStyle(C.white, 1).fillRoundedRect(-110, -62, 170, 80, 14).fillRoundedRect(50, -40, 70, 58, 12);
    g.fillStyle(C.magenta, 1).fillRect(-110, -12, 230, 12);
    g.fillStyle(0xaee0ff, 1).fillRoundedRect(66, -32, 42, 24, 5);
    g.fillStyle(0x3a2340, 1).fillCircle(-70, 22, 18).fillCircle(80, 22, 18).fillStyle(0xc9c3d2, 1).fillCircle(-70, 22, 8).fillCircle(80, 22, 8);
    van.add(g);
    van.add(this.add.text(-25, -40, 'MagicAir', txt(18, C.magenta)).setOrigin(0.5));
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0xfff4fa, 0.85).setDepth(299);
    const title = this.add.text(W / 2, 700, t('ev_' + this.b.kind), txt(44, C.purple)).setOrigin(0.5).setDepth(300).setAlpha(0);
    const sub = this.add.text(W / 2, 760, t('eventArch', { n: this.b.slots.length }), txt(28, C.ink, { fontStyle: '700' })).setOrigin(0.5).setDepth(300).setAlpha(0);
    this.tweens.add({ targets: [title, sub], alpha: 1, duration: 300, delay: 300 });
    this.tweens.add({ targets: van, x: W + 260, duration: 1700, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: van, y: 552, duration: 120, yoyo: true, repeat: 6 });
    this.time.delayedCall(1900, () => {
      this.tweens.add({ targets: [dim, title, sub], alpha: 0, duration: 300, onComplete: () => { dim.destroy(); title.destroy(); sub.destroy(); van.destroy(); } });
      this.started = true;
    });
  }

  floatText(x, y, str, color) {
    const now = this.time.now;
    if (now - (this.floatAt[str] || 0) < 700) return;
    this.floatAt[str] = now;
    const tx = this.add.text(x, y, str, txt(32, color, { stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: tx, y: y - 60, alpha: 0, duration: 1000, onComplete: () => tx.destroy() });
  }

  update() {
    if (!this.started || this.ev.over && this.ended) return;
    const dt = Math.min(this.game.loop.rawDelta, 250) / 1000;
    const ev = this.ev;
    ev.update(dt);
    for (const e of ev.drainEvents()) this.onEvent(e);
    if (this.pickAnim) { this.pickAnim.t += dt / 0.18; if (this.pickAnim.t >= 1) this.pickAnim = null; }
    const nz = ev.nozzle;
    if (nz && nz.state === 'inflating') { sfx.inflateStart(); sfx.inflateLevel(nz.fill); } else sfx.inflateStop();
    this.render();
  }

  onEvent(e) {
    switch (e.type) {
      case 'pick': { const sl = this.slots[this.keys.indexOf(e.key)]; this.pickAnim = { key: e.key, x: sl.x, y: sl.y, t: 0 }; sfx.pick(); break; }
      case 'outOfStock': this.floatText(W / 2, 980, t('outOfStock'), C.red); this.flash[e.key] = this.time.now; sfx.wrong(); break;
      case 'inflated': this.floatText(NOZ.x + 120, NOZ.y - 150, t('perfect'), C.green); sfx.perfect(); break;
      case 'under': this.floatText(NOZ.x + 120, NOZ.y - 150, t('underMore'), C.purple); sfx.under(); break;
      case 'pop': sfx.pop(); this.cameras.main.shake(140, 0.006); this.floatText(NOZ.x, NOZ.y - 170, `${t('pop')} −${e.loss} ₴`, C.red); break;
      case 'placed': sfx.tie(); this.placeBalloon(e.key, e.slot); break;
      case 'wasted': {
        // зайва кулька відлітає вгору
        sfx.wrong();
        let g = itemArt(this, ITEM(e.key), 0, 0, 26, 1, this.b.age || 7);
        if (!g) { g = this.add.graphics(); drawItem(g, ITEM(e.key), 0, 0, 26); }
        g.setDepth(30).setPosition(NOZ.x, NOZ.y - 80);
        this.tweens.add({ targets: g, y: -80, x: NOZ.x + 120, angle: 25, duration: 1400, ease: 'Sine.easeIn', onComplete: () => g.destroy() });
        this.floatText(NOZ.x, NOZ.y - 170, t('wasted'), C.red);
        break;
      }
      case 'end': this.finish(e.result); break;
    }
  }

  render() {
    const ev = this.ev, rem = ev.remaining();
    const left = Math.ceil(ev.timeLeft);
    this.timerText.setText(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`).setColor(left <= 10 ? '#ffe066' : '#ffffff');
    if (left !== this.lastSec) { if (this.lastSec != null && left <= 10 && left > 0) sfx.tick(); this.lastSec = left; }
    this.progText.setText(t('archProgress', { a: ev.stats.placed, b: this.b.slots.length }));

    // кулька на соплі
    const g = this.nzG.clear(), nz = ev.nozzle;
    let hint = t('pickColor');
    if (this.pickAnim) {
      const k = this.pickAnim.t, px = this.pickAnim.x + (NOZ.x - this.pickAnim.x) * k, py = this.pickAnim.y + (NOZ.y - 30 - this.pickAnim.y) * k;
      if (!artSlot(this, 'pick', ITEM(this.pickAnim.key), px, py, 20 / 50, 20, false, this.b.age || 7)) drawItem(g, ITEM(this.pickAnim.key), px, py, 20);
      hint = '';
    } else artSlot(this, 'pick', null);
    if (!nz || this.pickAnim) artSlot(this, 'nz', null);
    if (nz && !this.pickAnim) {
      const r = 14 + nz.fill * 62;
      g.fillStyle(0x7c8a99, 1).fillRoundedRect(NOZ.x - 8, NOZ.y - 22, 16, 22, 4);
      if (artSlot(this, 'nz', ITEM(nz.key), NOZ.x, NOZ.y - 22, r / 50, 20, true, this.b.age || 7)) { /* арт-кулька */ }
      else if (nz.key === 'digit') g.fillStyle(0xffc21a, 1).fillCircle(NOZ.x, NOZ.y - 22 - r, r * 0.8);
      else drawItem(g, ITEM(nz.key), NOZ.x, NOZ.y - 22 - r, r);
      hint = nz.state === 'ready' ? t('tapToTie') : nz.state === 'empty' ? t('hold') : '';
    }
    this.hintText.setText(hint);
    this.hintBg.clear();
    if (hint) { const w = this.hintText.width + 40; this.hintBg.fillStyle(C.purple, 1).fillRoundedRect(300 - w / 2, 1010, w, 44, 22); }

    // шкала
    const my = METER.top + METER.h - (nz ? nz.fill : 0) * METER.h;
    this.ui.clear().fillStyle(C.ink, 1).fillRect(METER.x - 24, my - 3, 48, 6).fillTriangle(METER.x - 40, my - 10, METER.x - 40, my + 10, METER.x - 26, my);

    // панель кольорів: бейдж — скільки ще треба; 0 — зелена галочка
    const bg = this.barGfx.clear(), bdg = this.badgeGfx.clear();
    this.keys.forEach((key, i) => {
      const { x, y, r } = this.slots[i], need = rem[key] || 0;
      const flashing = this.time.now - (this.flash[key] || -1e9) < 500;
      bg.fillStyle(flashing ? 0xffd6dc : 0xfff4fa, 1).fillCircle(x, y, r).lineStyle(3, need ? 0xfbc8e8 : 0xbfeccd, 1).strokeCircle(x, y, r);
      if (this.barArt[i]) this.barArt[i].setAlpha(need ? 1 : 0.45);
      else if (key === 'digit') bg.fillStyle(0xffc21a, 1).fillCircle(x, y - 3, r * 0.5);
      else drawItem(bg, ITEM(key), x, y - 3, r * 0.6, need ? 1 : 0.45);
      const bx = x + r * 0.62, by = y + r * 0.72;
      bdg.fillStyle(need ? C.magenta : C.green, 1).fillRoundedRect(bx - 16, by - 12, 32, 24, 12);
      this.badgeTexts[i].setText(need ? String(need) : '✓');
    });

    // велика кнопка
    const pulse = 1 + 0.05 * Math.sin(this.time.now / 150);
    let col = C.grey, label = t('btnPick'), r = BTN.r;
    if (nz && !this.pickAnim) {
      if (nz.state === 'empty') { col = C.magenta; label = t('btnHold'); r *= pulse; }
      else if (nz.state === 'inflating') { col = C.purple; label = t('btnHold'); r *= 0.93; }
      else { col = C.green; label = t('btnTie'); r *= pulse; }
    }
    this.btnGfx.clear().fillStyle(0x3a1f45, 0.25).fillCircle(BTN.x, BTN.y + 5, BTN.r + 12)
      .fillStyle(C.white, 1).fillCircle(BTN.x, BTN.y, BTN.r + 12).fillStyle(col, 1).fillCircle(BTN.x, BTN.y, r);
    this.btnText.setText(label).setFontSize(label.includes('\n') ? 24 : 28);
  }

  // Кінець: «фото» арки, зірки, оплата — гроші й склад зберігаємо
  finish(res) {
    if (this.ended) return;
    this.ended = true;
    sfx.inflateStop();
    const run = this.run, gap = CONFIG.event.gapDays;
    const next = {
      ...run,
      money: Math.max(0, run.money + res.profit),
      stock: { ...run.stock, ...this.ev.stock },
      booking: null,
      eventsDone: (run.eventsDone || 0) + 1,
      nextEventDay: this.b.day + gap[0] + Math.floor(Math.random() * (gap[1] - gap[0] + 1)),
    };
    this.registry.set('run', next);
    saveRun(next);

    if (res.done) {
      // спалах фотоапарата
      const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.9).setDepth(200);
      this.tweens.add({ targets: flash, alpha: 0, duration: 450, onComplete: () => flash.destroy() });
      sfx.shiftOver();
      if (res.stars === 3) confettiRain(this, 50, 190);
    } else sfx.leave();

    this.time.delayedCall(res.done ? 1600 : 400, () => this.showResult(res, run.money, next.money));
  }

  showResult(res, before, after) {
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x2a1238, 0.25).setDepth(250).setInteractive();
    const g = this.add.graphics().setDepth(251);
    const top = 600, h = 500;   // нижче, щоб над карткою було видно готову арку
    card(g, 60, top, W - 120, h, 32);
    const add = (o) => o.setDepth(252);
    add(this.add.text(W / 2, top + 50, res.done ? t('eventDone') : t('eventFail', { a: res.placed, b: res.total }), txt(38, res.done ? C.purple : C.red)).setOrigin(0.5));
    // зірки
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 90, y = top + 118, s = this.add.graphics().setDepth(252);
      const pts = [];
      for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + (j * Math.PI) / 5, rr = j % 2 ? 16 : 36; pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }); }
      s.fillStyle(i < res.stars ? C.gold : 0xe6dcea, 1).fillPoints(pts, true);
      s.setPosition(x, y).setScale(0);
      this.tweens.add({ targets: s, scale: 1, duration: 320, delay: 200 + i * 220, ease: 'Back.easeOut', onStart: () => i < res.stars && sfx.star(i) });
    }
    const rows = [[t('eventPayRow'), res.pay, '+'], [t('tips'), res.tip, '+'], [t('heliumCost'), res.helium, '−']];
    rows.forEach(([label, v, sign], i) => {
      const y = top + 200 + i * 52;
      add(this.add.text(110, y, label, txt(30, C.ink, { fontStyle: '700' })).setOrigin(0, 0.5));
      const val = add(this.add.text(W - 110, y, '', txt(30, C.ink)).setOrigin(1, 0.5));
      countUp(this, val, v, { delay: 700 + i * 120, duration: 350, fmt: (n) => `${sign}${n} ₴` });
    });
    g.fillStyle(C.pinkSoft, 1).fillRoundedRect(110, top + 340, W - 220, 4, 2);
    add(this.add.text(110, top + 385, t('profit'), txt(36, C.ink)).setOrigin(0, 0.5));
    const pv = add(this.add.text(W - 110, top + 385, '', txt(40, res.profit >= 0 ? C.green : C.red)).setOrigin(1, 0.5));
    countUp(this, pv, res.profit, { delay: 1100, duration: 450, fmt: (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n)} ₴` });
    const mv = add(this.add.text(W / 2, top + 452, '', txt(30, C.magenta)).setOrigin(0.5));
    countUp(this, mv, after, { from: before, delay: 1500, duration: 500, fmt: (n) => `${t('money')}: ${n} ₴` });
    const btn = button(this, W / 2, 1180, 520, 110, t('toShop'), () => this.scene.start('shop')).setDepth(253).setAlpha(0);
    btn.disableInteractive();
    this.time.delayedCall(1200, () => { btn.setInteractive({ useHandCursor: true }); this.tweens.add({ targets: btn, alpha: 1, duration: 250 }); });
    this.time.delayedCall(1150, () => sfx.coin());
    void dim;
  }
}
