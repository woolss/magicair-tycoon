import { W, C, txt, drawBalloon } from '../theme.js';
import { t, toggleLang } from '../i18n.js';
import { CONFIG } from '../config.js';
import { newRun, loadRun, saveRun } from '../run.js';

export class StartScene extends Phaser.Scene {
  constructor() { super('start'); }

  create() {
    this.cameras.main.setBackgroundColor(C.bg);
    const g = this.add.graphics();
    drawBalloon(g, 200, 300, 60, CONFIG.items.pink.color);
    drawBalloon(g, 360, 250, 70, C.magenta);
    drawBalloon(g, 520, 300, 60, CONFIG.items.blue.color);

    this.add.text(W / 2, 440, t('title'), txt(64, C.magenta)).setOrigin(0.5);
    this.add.text(W / 2, 510, t('subtitle'), txt(32, C.purple)).setOrigin(0.5);
    this.add.text(W / 2, 720, t('howto'), txt(28, C.ink, { fontStyle: '600', align: 'left', wordWrap: { width: 600 }, lineSpacing: 10 })).setOrigin(0.5);

    const saved = loadRun();
    const start = (run) => { this.registry.set('run', run); saveRun(run); this.scene.start('game'); };

    if (saved) {
      button(this, W / 2, 1000, 520, 110, t('cont', { n: saved.day }), () => start(saved));
      // нова гра стирає прогрес — питаємо вдруге прямо на кнопці
      let sure = false;
      const again = button(this, W / 2, 1140, 420, 84, t('newGame'), () => {
        if (!sure) { sure = true; again.list[1].setText(t('newGameSure')); return; }
        start(newRun(CONFIG));
      }, C.greyDark, 32);
    } else {
      button(this, W / 2, 1000, 460, 110, t('play'), () => start(newRun(CONFIG)));
    }

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
