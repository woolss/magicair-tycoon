import { W, H, C, txt, drawBalloon } from '../theme.js';
import { t, toggleLang } from '../i18n.js';
import { CONFIG } from '../config.js';

export class StartScene extends Phaser.Scene {
  constructor() { super('start'); }

  create() {
    this.cameras.main.setBackgroundColor(C.bg);
    const g = this.add.graphics();
    drawBalloon(g, 200, 330, 60, CONFIG.colors.pink);
    drawBalloon(g, 360, 280, 70, C.magenta);
    drawBalloon(g, 520, 330, 60, CONFIG.colors.blue);

    this.add.text(W / 2, 470, t('title'), txt(64, C.magenta)).setOrigin(0.5);
    this.add.text(W / 2, 540, t('subtitle'), txt(32, C.purple)).setOrigin(0.5);
    this.add.text(W / 2, 720, t('howto'), txt(28, C.ink, { fontStyle: '600', align: 'left', wordWrap: { width: 600 }, lineSpacing: 10 })).setOrigin(0.5);

    button(this, W / 2, 960, 460, 110, t('play'), () => {
      const day = this.registry.get('day') ?? 1;
      const money = this.registry.get('money') ?? CONFIG.startMoney;
      this.scene.start('game', { day, money });
    });

    button(this, W - 90, 60, 130, 64, t('lang'), () => { toggleLang(); this.scene.restart(); }, C.purple, 26);
  }
}

export function button(scene, x, y, w, h, label, onClick, color = C.magenta, size = 40) {
  const bg = scene.add.graphics();
  bg.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const tx = scene.add.text(0, 0, label, txt(size, C.white)).setOrigin(0.5);
  const box = scene.add.container(x, y, [bg, tx]).setSize(w, h).setInteractive({ useHandCursor: true });
  box.on('pointerdown', () => {
    scene.tweens.add({ targets: box, scale: 0.95, duration: 60, yoyo: true });
    onClick();
  });
  return box;
}
