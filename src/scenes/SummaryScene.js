import { W, C, txt } from '../theme.js';
import { t } from '../i18n.js';
import { backdrop, floaters, button, card, coinIcon, confettiRain, countUp } from '../ui.js';
import * as sfx from '../sfx.js';

function star(g, x, y, r, color) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.fillStyle(color, 1).fillPoints(pts, true);
}

export class SummaryScene extends Phaser.Scene {
  constructor() { super('summary'); }

  init(data) { this.day = data.day; this.sum = data.sum; }

  create() {
    const s = this.sum;
    backdrop(this);
    floaters(this, 5, 0.2);
    const g = this.add.graphics();
    g.fillStyle(C.purple, 1).fillRect(0, 0, W, 110);
    g.fillStyle(C.purple, 1);
    for (let x = 0; x < W; x += 60) g.fillCircle(x + 30, 110, 30); // фестони під шапкою
    this.add.text(W / 2, 60, t('summaryTitle', { n: this.day }), txt(40, C.white)).setOrigin(0.5);

    // Зірки: порожні одразу, зароблені «вистрибують» по черзі
    [0, 1, 2].forEach((i) => {
      const x = W / 2 + (i - 1) * 140, y = 235, big = i === 1 ? 64 : 54;
      star(g, x, y + 4, big, 0xe6dcea);
      if (i >= s.stars) return;
      const sg = this.add.graphics();
      star(sg, 0, 4, big, 0xd99a00); star(sg, 0, 0, big, C.gold);
      star(sg, -big * 0.2, -big * 0.2, big * 0.3, 0xffe9a8);
      sg.setPosition(x, y).setScale(0);
      this.tweens.add({ targets: sg, scale: 1, duration: 380, delay: 250 + i * 260, ease: 'Back.easeOut', onStart: () => sfx.star(i) });
    });
    if (s.stars === 3) this.time.delayedCall(1000, () => confettiRain(this));

    // Рахунок дня: рядки з'являються й «набігають»
    const top = 320, rowH = 62;
    const rows = [
      [t('revenue'), s.revenue, '+', C.ink],
      [t('tips'), s.tips, '+', C.ink],
      [t('heliumCost'), s.helium, '−', C.greyDark],
      [t('rent'), s.rent, '−', C.greyDark],
      [t('salary'), s.salary, '−', C.greyDark],
    ];
    card(g, 50, top, W - 100, rows.length * rowH + 210);
    rows.forEach(([label, v, sign, col], i) => {
      const y = top + 45 + i * rowH, delay = 450 + i * 110;
      const l = this.add.text(90, y, label, txt(30, col, { fontStyle: '700' })).setOrigin(0, 0.5).setAlpha(0);
      const val = this.add.text(W - 90, y, '', txt(30, col)).setOrigin(1, 0.5).setAlpha(0);
      this.tweens.add({ targets: [l, val], alpha: 1, duration: 200, delay });
      countUp(this, val, v, { delay, duration: 350, fmt: (n) => `${sign}${n} ₴` });
    });
    const sepY = top + 20 + rows.length * rowH;
    g.fillStyle(C.pinkSoft, 1).fillRoundedRect(90, sepY, W - 180, 4, 2);

    const tAfter = 450 + rows.length * 110 + 150;
    const py = sepY + 55;
    const profitCol = s.profit >= 0 ? C.green : C.red;
    const pl = this.add.text(90, py, t('profit'), txt(38, C.ink)).setOrigin(0, 0.5).setAlpha(0);
    const pv = this.add.text(W - 90, py, '', txt(42, profitCol)).setOrigin(1, 0.5).setAlpha(0);
    this.tweens.add({ targets: [pl, pv], alpha: 1, duration: 200, delay: tAfter });
    countUp(this, pv, s.profit, { delay: tAfter, duration: 500, fmt: (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n)} ₴` });
    this.time.delayedCall(tAfter + 550, () => {
      this.tweens.add({ targets: pv, scale: 1.2, duration: 140, yoyo: true });
      if (s.profit > 0) sfx.coin(); else sfx.under();
    });

    // Каса: монетка + сума
    const my = py + 80;
    const mg = this.add.graphics().setAlpha(0);
    mg.fillStyle(0xfff0fb, 1).fillRoundedRect(70, my - 36, W - 140, 72, 36);
    coinIcon(mg, 115, my, 22);
    const ml = this.add.text(150, my, t('money'), txt(34, C.magenta)).setOrigin(0, 0.5).setAlpha(0);
    const mv = this.add.text(W - 100, my, '', txt(38, C.magenta)).setOrigin(1, 0.5).setAlpha(0);
    const tMoney = tAfter + 650;
    this.tweens.add({ targets: [mg, ml, mv], alpha: 1, duration: 200, delay: tMoney });
    countUp(this, mv, s.moneyAfter, { from: s.moneyBefore, delay: tMoney, duration: 600, fmt: (n) => `${n} ₴` });

    // Хто обслужений / пішов / лопнуло
    const sy = top + rows.length * rowH + 250;
    const chip = this.add.text(W / 2, sy, t('served', { a: s.served, b: s.lost, c: s.popped }), txt(24, C.purple, { fontStyle: '700', backgroundColor: '#ffffffcc', padding: { x: 20, y: 10 } })).setOrigin(0.5).setAlpha(0);
    const extra = [chip];
    if (s.poppedValue) extra.push(this.add.text(W / 2, sy + 58, t('poppedValue', { v: s.poppedValue }), txt(24, C.red, { fontStyle: '700' })).setOrigin(0.5).setAlpha(0));
    this.tweens.add({ targets: extra, alpha: 1, duration: 300, delay: tMoney + 400 });

    const next = button(this, W / 2, 1150, 520, 110, t('toShop'), () => this.scene.start('shop'));
    // гравець міг ще тапати в кінці зміни — не пропускаємо підсумок випадково
    next.disableInteractive().setAlpha(0);
    this.time.delayedCall(900, () => {
      next.setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: next, alpha: 1, duration: 250 });
    });
  }
}
