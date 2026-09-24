import { W, C, txt, drawItem } from '../theme.js';
import { t, itemName, upName, upDesc } from '../i18n.js';
import { CONFIG } from '../config.js';
import { deriveParams } from '../logic.js';
import { buyStock, buyUpgrade, upgradeState, stockCost, stockRoom, saveRun } from '../run.js';
import { makeBooking, bookingShort } from '../event.js';
import { backdrop, button, card, coinIcon, upIcon, soundToggle, countUp } from '../ui.js';
import * as sfx from '../sfx.js';

const STEP = 5; // закупівля по 5 штук
const TABS = { stock: 147, upgrades: 360, shop: 573 };
const TAB_W = 212;
const TAB_LABEL = { stock: 'tabStock', upgrades: 'tabUpgrades', shop: 'tabShop' };
const STAGE3 = ['shop', 'digits', 'helper', 'ads', 'car'];   // вкладка «Магазин»

// Між змінами: закупівля товару і апгрейди
export class ShopScene extends Phaser.Scene {
  constructor() { super('shop'); }

  create() {
    backdrop(this);
    this.tab = 'stock';
    this.pending = {};
    this.content = this.add.container(0, 0);

    const g = this.add.graphics();
    g.fillStyle(C.purple, 1).fillRect(0, 0, W, 110);
    for (let x = 0; x < W; x += 60) g.fillCircle(x + 30, 110, 30);
    this.titleText = this.add.text(30, 58, '', txt(30, C.white)).setOrigin(0, 0.5);
    // каса: біла пігулка з монеткою
    g.fillStyle(0x3a1f45, 0.2).fillRoundedRect(W - 230, 30, 200, 58, 29);
    g.fillStyle(C.white, 1).fillRoundedRect(W - 230, 26, 200, 58, 29);
    coinIcon(g, W - 200, 55, 17);
    this.moneyText = this.add.text(W - 48, 55, `${this.run.money} ₴`, txt(30, C.ink)).setOrigin(1, 0.5);
    this.shownMoney = this.run.money;

    // вкладки: сегментований перемикач
    const tg = this.add.graphics();
    card(tg, 40, 168, W - 80, 76, 38);
    this.tabHi = this.add.graphics();
    this.tabTexts = {};
    for (const [id, x] of Object.entries(TABS)) {
      this.tabTexts[id] = this.add.text(x, 206, t(TAB_LABEL[id]), txt(27, C.purple)).setOrigin(0.5);
      this.add.zone(x, 206, TAB_W, 76).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.tab === id) return;
        sfx.click();
        this.tab = id; this.render();
      });
    }

    this.startBtn = button(this, W / 2, 1180, 520, 110, '', () => {
      saveRun(this.run);
      this.scene.start('game');
    });
    soundToggle(this, W - 60, 1180 - 120, 150, -68);

    this.render();
    this.maybeOffer();
  }

  // Машина куплена і настав час — пропонуємо бронь на виїзд сьогодні після зміни
  maybeOffer() {
    let run = this.run;
    if (!run.owned.includes('car')) return;
    if (run.booking && run.booking.day < run.day) run = this.run = { ...run, booking: null, nextEventDay: run.day };  // не доїхали — бронь згоріла
    if (run.booking || (run.nextEventDay || 0) > run.day) return;
    const offer = makeBooking(CONFIG, Math.random, run.owned, run.day, run.eventsDone || 0);
    this.showOffer(offer);
  }

  showOffer(b) {
    const layer = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(W / 2, 640, W, 1280, 0x2a1238, 0.5).setInteractive();
    const g = this.add.graphics();
    const top = 250, h = 760;
    card(g, 50, top, W - 100, h, 32);
    g.fillStyle(C.purple, 1).fillRoundedRect(50, top, W - 100, 90, { tl: 32, tr: 32, bl: 0, br: 0 });
    upIcon(g, 'car', 118, top + 50, 30);
    layer.add([dim, g]);
    const T = (x, y, str, style, ox = 0.5) => { const o = this.add.text(x, y, str, style).setOrigin(ox, 0.5); layer.add(o); return o; };
    T(W / 2 + 30, top + 45, t('eventOffer'), txt(34, C.white));
    T(W / 2, top + 130, t('ev_' + b.kind), txt(34, C.purple));
    T(W / 2, top + 175, `${t('eventWhen')} · ${t('eventArch', { n: b.slots.length })}`, txt(22, C.greyDark, { fontStyle: '700' }));
    // міні-арка за схемою
    const n = b.slots.length, cx = W / 2, cy = top + 330, R = 120;
    g.lineStyle(4, 0xc9c3d2, 1).beginPath().arc(cx, cy, R, Math.PI, 0, false).strokePath();
    b.slots.forEach((k, i) => {
      const a = Math.PI - (i * Math.PI) / (n - 1), x = cx + Math.cos(a) * R, y = cy - Math.sin(a) * R;
      if (k === 'digit') g.fillStyle(0xffc21a, 1).fillCircle(x, y, 12);
      else drawItem(g, CONFIG.items[k], x, y, 11);
    });
    // що потрібно і чи є на складі
    const run = this.run, need = Object.entries(b.need);
    need.forEach(([k, cnt], i) => {
      const x = W / 2 + (i - (need.length - 1) / 2) * 120, y = top + 420, have = run.stock[k] || 0, ok = have >= cnt;
      g.fillStyle(ok ? 0xe3f8ea : 0xffe0e4, 1).fillRoundedRect(x - 52, y - 34, 104, 88, 18);
      if (k === 'digit') g.fillStyle(0xffc21a, 1).fillCircle(x, y - 6, 16);
      else drawItem(g, CONFIG.items[k], x, y - 6, 16);
      T(x, y + 32, `×${cnt}`, txt(22, ok ? C.green : C.red));
    });
    const short = bookingShort(b, run.stock).length > 0;
    T(W / 2, top + 505, t('eventPay', { v: b.pay }) + '   ·   ' + t('eventTime', { s: b.timeSec }), txt(28, C.ink));
    if (short) T(W / 2, top + 555, t('eventStock'), txt(20, C.red, { fontStyle: '700', align: 'center', wordWrap: { width: 540 } }));
    const close = () => this.tweens.add({ targets: layer, alpha: 0, duration: 200, onComplete: () => layer.destroy() });
    const take = button(this, W / 2 - 130, top + 660, 240, 96, t('eventTake'), () => {
      this.run = { ...this.run, booking: b };
      sfx.upgrade(); close();
    }, C.green, 34);
    const skip = button(this, W / 2 + 130, top + 660, 240, 96, t('eventSkip'), () => {
      this.run = { ...this.run, booking: null, nextEventDay: this.run.day + CONFIG.event.gapDays[0] };
      close();
    }, C.greyDark, 30);
    layer.add([take, skip]);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 250 });
    sfx.phone();
  }

  get run() { return this.registry.get('run'); }
  set run(r) { this.registry.set('run', r); saveRun(r); }

  // Каса «перелічується» до нового значення
  updateMoney() {
    const to = this.run.money;
    if (to === this.shownMoney) return;
    const from = this.shownMoney;
    this.shownMoney = to;
    if (this.moneyTween) this.moneyTween.stop();
    this.moneyTween = countUp(this, this.moneyText, to, { from, duration: 450, fmt: (n) => `${n} ₴`, sound: false });
    this.tweens.add({ targets: this.moneyText, scale: 1.15, duration: 120, yoyo: true });
  }

  render() {
    this.content.removeAll(true);
    const run = this.run;
    this.titleText.setText(t('shopTitle', { n: run.day }));
    this.startBtn.label.setText(t('startDay', { n: run.day }));
    this.tabHi.clear().fillStyle(C.magenta, 1).fillRoundedRect(TABS[this.tab] - TAB_W / 2 + 4, 174, TAB_W - 8, 64, 32);
    for (const [id, tx] of Object.entries(this.tabTexts)) tx.setColor(id === this.tab ? '#ffffff' : '#b338b5');
    if (this.tab === 'stock') this.renderStock(run);
    else this.renderUpgrades(run, CONFIG.upgrades.filter((u) => (this.tab === 'shop') === STAGE3.includes(u.id)));
  }

  cardAt(y, h) {
    const g = this.add.graphics();
    card(g, 30, y - h / 2, W - 60, h, 24);
    this.content.add(g);
    return g;
  }

  renderStock(run) {
    const open = deriveParams(CONFIG, run.owned).open;
    const rowH = open.length > 6 ? 94 : 108;           // 7 товарів — картки щільніші
    open.forEach((key, i) => {
      const y = 320 + i * rowH, it = CONFIG.items[key];
      const g = this.cardAt(y, rowH - 12);
      g.fillStyle(0xfff0fb, 1).fillCircle(90, y, 38);
      drawItem(g, it, 90, y - 3, 24);
      const have = run.stock[key] || 0, n = this.pending[key] || 0;
      this.content.add(this.add.text(145, y - 24, itemName(key), txt(26, C.ink)).setOrigin(0, 0.5));
      this.content.add(this.add.text(145, y + 6, `${t('inStock', { n: have })} · ${t('perPiece', { p: it.buy })}`, txt(19, C.greyDark, { fontStyle: '700' })).setOrigin(0, 0.5));
      // смужка заповнення полиці: є + замовлено
      const bw = 200, fillW = (v) => Math.round((bw * Math.min(v, CONFIG.stockMax)) / CONFIG.stockMax);
      g.fillStyle(0xf1e4f1, 1).fillRoundedRect(145, y + 26, bw, 10, 5);
      if (have + n) g.fillStyle(C.pinkSoft, 1).fillRoundedRect(145, y + 26, Math.max(10, fillW(have + n)), 10, 5);
      if (have) g.fillStyle(have < 10 ? C.red : C.purple, 1).fillRoundedRect(145, y + 26, Math.max(10, fillW(have)), 10, 5);
      const room = stockRoom(CONFIG, run, key) - n;
      this.content.add(button(this, 470, y, 72, 64, `−${STEP}`, () => { this.pending[key] = Math.max(0, n - STEP); this.render(); }, n > 0 ? C.purple : C.grey, 26));
      this.content.add(this.add.text(548, y, n ? `+${n}` : '0', txt(30, n ? C.magenta : C.greyDark)).setOrigin(0.5));
      this.content.add(button(this, 626, y, 72, 64, `+${STEP}`, () => { this.pending[key] = n + Math.min(STEP, room); this.render(); }, room > 0 ? C.purple : C.grey, 26));
    });

    const cost = stockCost(CONFIG, this.pending);
    const ok = cost > 0 && cost <= run.money;
    const y = 320 + open.length * rowH - 10;
    this.content.add(this.add.text(W / 2, y, t('total', { v: cost }), txt(32, cost > run.money ? C.red : C.ink)).setOrigin(0.5));
    if (cost > run.money) this.content.add(this.add.text(W / 2, y + 40, t('notEnough'), txt(22, C.red)).setOrigin(0.5));
    this.content.add(button(this, W / 2, y + 100, 320, 86, t('buy'), () => {
      const next = buyStock(CONFIG, this.run, this.pending);
      if (!next) { sfx.wrong(); return; }
      this.run = next;
      this.pending = {};
      sfx.buy();
      this.render();
      this.updateMoney();
    }, ok ? C.green : C.grey, 34));
  }

  renderUpgrades(run, list) {
    list.forEach((u, i) => {
      const y = 320 + i * 108;
      const st = upgradeState(CONFIG, run, u.id);
      const g = this.cardAt(y, 96);
      g.fillStyle(st === 'owned' ? 0xe3f8ea : 0xfff0fb, 1).fillCircle(90, y, 38);
      upIcon(g, u.id, 88, y + 2, 28);
      const name = this.add.text(145, y - 18, upName(u.id), txt(26, C.ink)).setOrigin(0, 0.5);
      const desc = this.add.text(145, y + 18, upDesc(u.id), txt(20, C.greyDark, { fontStyle: '700', wordWrap: { width: 355 } })).setOrigin(0, 0.5);
      if (desc.height > 34) {
        // довгий опис — у два рядки дрібніше, назва вище, щоб не залазило під кнопку
        desc.setFontSize(18).setLineSpacing(-3).setOrigin(0, 0).setY(y - 6);
        name.setY(y - 26);
      }
      this.content.add([name, desc]);
      if (st === 'owned') {
        g.fillStyle(C.green, 1).fillCircle(120, y - 26, 14);
        g.lineStyle(4, C.white, 1).beginPath().moveTo(113, y - 26).lineTo(118, y - 20).lineTo(127, y - 32).strokePath();
        this.content.add(this.add.text(610, y, t('owned'), txt(28, C.green)).setOrigin(0.5));
      } else if (st === 'locked') {
        this.content.add(this.add.text(610, y, t('needs', { name: upName(u.req) }), txt(19, C.greyDark, { align: 'center', wordWrap: { width: 150 } })).setOrigin(0.5));
      } else {
        this.content.add(button(this, 600, y, 160, 68, `${u.price} ₴`, () => {
          const next = buyUpgrade(CONFIG, this.run, u.id);
          if (!next) { sfx.wrong(); this.floatNote(600, y - 50, t('notEnough')); return; }
          this.run = next;
          sfx.upgrade();
          this.render();
          this.updateMoney();
          this.sparkle(90, y);
        }, st === 'available' ? C.magenta : C.grey, 28));
      }
    });
    const y = 320 + list.length * 108 - 10;
    this.content.add(this.add.text(W / 2, y, t(this.tab === 'shop' ? 'soonCar' : 'soon'), txt(22, C.greyDark, { fontStyle: '700' })).setOrigin(0.5));
  }

  floatNote(x, y, str) {
    const tx = this.add.text(x, y, str, txt(24, C.red, { stroke: '#ffffff', strokeThickness: 5 })).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: tx, y: y - 40, alpha: 0, duration: 900, onComplete: () => tx.destroy() });
  }

  // Іскри навколо щойно купленого апгрейда
  sparkle(x, y) {
    const cols = [C.gold, C.magenta, C.green, 0x4fa3ff];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const p = this.add.star(x, y, 5, 4, 10, cols[i % cols.length]).setDepth(20);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 90, y: y + Math.sin(a) * 70, angle: 180, alpha: 0, scale: 0.4, duration: 600, ease: 'Cubic.easeOut', onComplete: () => p.destroy() });
    }
  }
}
