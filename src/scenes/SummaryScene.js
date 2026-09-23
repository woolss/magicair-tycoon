import { W, C, txt } from '../theme.js';
import { t } from '../i18n.js';
import { button } from './StartScene.js';

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
    this.cameras.main.setBackgroundColor(C.bg);
    const g = this.add.graphics();
    g.fillStyle(C.purple, 1).fillRect(0, 0, W, 110);
    this.add.text(W / 2, 55, t('summaryTitle', { n: this.day }), txt(40, C.white)).setOrigin(0.5);

    [0, 1, 2].forEach((i) => star(g, W / 2 + (i - 1) * 130, 230, 55, i < s.stars ? C.gold : C.grey));

    const rows = [
      [t('revenue'), `+${s.revenue}`, C.ink],
      [t('tips'), `+${s.tips}`, C.ink],
      [t('heliumCost'), `−${s.helium}`, C.greyDark],
      [t('rent'), `−${s.rent}`, C.greyDark],
    ];
    let y = 370;
    for (const [label, val, col] of rows) {
      this.add.text(100, y, label, txt(34, col, { fontStyle: '700' })).setOrigin(0, 0.5);
      this.add.text(W - 100, y, `${val} ₴`, txt(34, col)).setOrigin(1, 0.5);
      y += 64;
    }
    g.fillStyle(C.pinkSoft, 1).fillRect(100, y - 20, W - 200, 4);
    y += 30;
    const profitCol = s.profit >= 0 ? C.green : C.red;
    this.add.text(100, y, t('profit'), txt(40, C.ink)).setOrigin(0, 0.5);
    this.add.text(W - 100, y, `${s.profit >= 0 ? '+' : '−'}${Math.abs(s.profit)} ₴`, txt(40, profitCol)).setOrigin(1, 0.5);
    y += 76;
    this.add.text(100, y, t('money'), txt(40, C.magenta)).setOrigin(0, 0.5);
    this.add.text(W - 100, y, `${s.moneyAfter} ₴`, txt(40, C.magenta)).setOrigin(1, 0.5);
    y += 90;
    this.add.text(W / 2, y, t('served', { a: s.served, b: s.lost, c: s.popped }), txt(26, C.greyDark, { fontStyle: '700' })).setOrigin(0.5);
    if (s.poppedValue) this.add.text(W / 2, y + 44, t('poppedValue', { v: s.poppedValue }), txt(26, C.red, { fontStyle: '700' })).setOrigin(0.5);

    const next = button(this, W / 2, 1120, 520, 110, t('toShop'), () => this.scene.start('shop'));
    // гравець міг ще тапати по полиці в кінці зміни — не пропускаємо підсумок випадково
    next.disableInteractive().setAlpha(0.5);
    this.time.delayedCall(900, () => next.setInteractive({ useHandCursor: true }).setAlpha(1));
  }
}
