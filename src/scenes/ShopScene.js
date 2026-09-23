import { W, C, txt, drawItem } from '../theme.js';
import { t, itemName, upName, upDesc } from '../i18n.js';
import { CONFIG } from '../config.js';
import { deriveParams } from '../logic.js';
import { buyStock, buyUpgrade, upgradeState, stockCost, stockRoom, saveRun } from '../run.js';
import { button } from './StartScene.js';

const STEP = 5; // закупівля по 5 штук

// Між змінами: закупівля товару і апгрейди
export class ShopScene extends Phaser.Scene {
  constructor() { super('shop'); }

  create() {
    this.cameras.main.setBackgroundColor(C.bg);
    this.tab = 'stock';
    this.pending = {};
    this.content = this.add.container(0, 0);

    const g = this.add.graphics();
    g.fillStyle(C.purple, 1).fillRect(0, 0, W, 110);
    this.titleText = this.add.text(30, 55, '', txt(32, C.white)).setOrigin(0, 0.5);
    this.moneyText = this.add.text(W - 30, 55, '', txt(34, C.white)).setOrigin(1, 0.5);

    this.tabs = {
      stock: button(this, 190, 160, 300, 70, t('tabStock'), () => { this.tab = 'stock'; this.render(); }, C.magenta, 30),
      upgrades: button(this, 530, 160, 300, 70, t('tabUpgrades'), () => { this.tab = 'upgrades'; this.render(); }, C.magenta, 30),
    };

    this.startBtn = button(this, W / 2, 1190, 520, 110, '', () => {
      saveRun(this.run);
      this.scene.start('game');
    });

    this.render();
  }

  get run() { return this.registry.get('run'); }
  set run(r) { this.registry.set('run', r); saveRun(r); }

  render() {
    this.content.removeAll(true);
    const run = this.run;
    this.titleText.setText(t('shopTitle', { n: run.day }));
    this.moneyText.setText(`${run.money} ₴`);
    this.startBtn.list[1].setText(t('startDay', { n: run.day }));
    for (const [id, b] of Object.entries(this.tabs)) {
      b.list[0].clear().fillStyle(id === this.tab ? C.magenta : C.greyDark, 1).fillRoundedRect(-150, -35, 300, 70, 35);
    }
    if (this.tab === 'stock') this.renderStock(run); else this.renderUpgrades(run);
  }

  card(y, h) {
    const g = this.add.graphics();
    g.fillStyle(C.white, 1).fillRoundedRect(30, y - h / 2, W - 60, h, 24);
    this.content.add(g);
    return g;
  }

  renderStock(run) {
    const open = deriveParams(CONFIG, run.owned).open;
    open.forEach((key, i) => {
      const y = 250 + i * 112;
      const g = this.card(y, 100);
      drawItem(g, CONFIG.items[key], 90, y - 4, 28);
      const it = CONFIG.items[key];
      this.content.add(this.add.text(145, y - 20, itemName(key), txt(28, C.ink)).setOrigin(0, 0.5));
      this.content.add(this.add.text(145, y + 20, `${t('inStock', { n: run.stock[key] || 0 })} · ${t('perPiece', { p: it.buy })}`, txt(21, C.greyDark, { fontStyle: '700' })).setOrigin(0, 0.5));
      const n = this.pending[key] || 0;
      const room = stockRoom(CONFIG, run, key) - n;
      this.content.add(button(this, 470, y, 72, 64, `−${STEP}`, () => { this.pending[key] = Math.max(0, n - STEP); this.render(); }, n > 0 ? C.purple : C.grey, 26));
      this.content.add(this.add.text(548, y, n ? `+${n}` : '0', txt(30, n ? C.magenta : C.greyDark)).setOrigin(0.5));
      this.content.add(button(this, 626, y, 72, 64, `+${STEP}`, () => { this.pending[key] = n + Math.min(STEP, room); this.render(); }, room > 0 ? C.purple : C.grey, 26));
    });

    const cost = stockCost(CONFIG, this.pending);
    const ok = cost > 0 && cost <= run.money;
    const y = 250 + open.length * 112 + 10;
    this.content.add(this.add.text(W / 2, y, t('total', { v: cost }), txt(32, cost > run.money ? C.red : C.ink)).setOrigin(0.5));
    if (cost > run.money) this.content.add(this.add.text(W / 2, y + 44, t('notEnough'), txt(24, C.red)).setOrigin(0.5));
    this.content.add(button(this, W / 2, y + 98, 320, 90, t('buy'), () => {
      const next = buyStock(CONFIG, this.run, this.pending);
      if (!next) return;
      this.run = next;
      this.pending = {};
      this.render();
    }, ok ? C.green : C.grey, 36));
  }

  renderUpgrades(run) {
    CONFIG.upgrades.forEach((u, i) => {
      const y = 250 + i * 112;
      this.card(y, 100);
      this.content.add(this.add.text(60, y - 20, upName(u.id), txt(28, C.ink)).setOrigin(0, 0.5));
      this.content.add(this.add.text(60, y + 20, upDesc(u.id), txt(22, C.greyDark, { fontStyle: '700' })).setOrigin(0, 0.5));
      const st = upgradeState(CONFIG, run, u.id);
      if (st === 'owned') {
        this.content.add(this.add.text(620, y, t('owned'), txt(30, C.green)).setOrigin(0.5));
      } else if (st === 'locked') {
        this.content.add(this.add.text(620, y, t('needs', { name: upName(u.req) }), txt(20, C.greyDark, { align: 'center', wordWrap: { width: 150 } })).setOrigin(0.5));
      } else {
        this.content.add(button(this, 610, y, 150, 70, `${u.price} ₴`, () => {
          const next = buyUpgrade(CONFIG, this.run, u.id);
          if (!next) return;
          this.run = next;
          this.render();
        }, st === 'available' ? C.magenta : C.grey, 28));
      }
    });
    const y = 250 + CONFIG.upgrades.length * 112;
    this.content.add(this.add.text(W / 2, y, t('soon'), txt(24, C.greyDark, { fontStyle: '700' })).setOrigin(0.5));
  }
}
