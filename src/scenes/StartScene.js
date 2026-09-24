import { W, C, txt, drawBalloon } from '../theme.js';
import { t, toggleLang } from '../i18n.js';
import { CONFIG } from '../config.js';
import { newRun, loadRun, saveRun } from '../run.js';
import { backdrop, floaters, button, card, soundToggle } from '../ui.js';

// Зв'язка кульок над назвою: вузлик унизу, кульки гойдаються
const BUNCH = [[-120, -150, 50, 0xff5fb8], [120, -150, 50, 0x4fa3ff], [-60, -225, 56, C.magenta], [62, -222, 54, 0xffc933], [0, -150, 60, C.purple], [-150, -250, 40, 0x3ccf6e], [150, -250, 42, 0xff8a3d]];

export class StartScene extends Phaser.Scene {
  constructor() { super('start'); }

  create() {
    backdrop(this);
    this.cameras.main.fadeIn(300, 255, 244, 250);
    floaters(this, 6, 0.25);

    const knot = this.add.container(W / 2, 400);
    const strings = this.add.graphics();
    knot.add(strings);
    BUNCH.forEach(([x, y, r, col], i) => {
      strings.lineStyle(2, C.greyDark, 1).lineBetween(0, 0, x, y + r);
      const b = this.add.graphics();
      drawBalloon(b, 0, 0, r, col);
      const c = this.add.container(x, y, [b]);
      knot.add(c);
      this.tweens.add({ targets: c, y: y - 8, duration: 1300 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    strings.fillStyle(C.magenta, 1).fillTriangle(-12, 14, 12, 14, 0, 0);
    knot.setScale(0.2).setAlpha(0);
    this.tweens.add({ targets: knot, scale: 1, alpha: 1, duration: 600, ease: 'Back.easeOut' });
    this.tweens.add({ targets: knot, angle: { from: -3, to: 3 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Назва: «MagicAir» великим, решта — нижче
    const [first, ...rest] = t('title').split(' ');
    const title = this.add.text(W / 2, 470, first, txt(84, C.magenta, { stroke: '#ffffff', strokeThickness: 12 })).setOrigin(0.5);
    this.add.text(W / 2, 545, rest.join(' '), txt(50, C.purple, { stroke: '#ffffff', strokeThickness: 8 })).setOrigin(0.5);
    this.add.text(W / 2, 600, t('subtitle'), txt(28, C.ink, { fontStyle: '700' })).setOrigin(0.5);
    this.tweens.add({ targets: title, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Як грати: картка з номерами кроків
    const steps = t('howto').split('\n').map((s) => s.replace(/^\d+\.\s*/, ''));
    const top = 650, rowH = 50, g = this.add.graphics();
    card(g, 50, top, W - 100, steps.length * rowH + 30);
    steps.forEach((s, i) => {
      const y = top + 40 + i * rowH;
      g.fillStyle(i % 2 ? C.purple : C.magenta, 1).fillCircle(96, y, 18);
      this.add.text(96, y, String(i + 1), txt(22, C.white)).setOrigin(0.5);
      this.add.text(130, y, s, txt(23, C.ink, { fontStyle: '700', wordWrap: { width: 510 } })).setOrigin(0, 0.5);
    });

    const saved = loadRun();
    const start = (run) => { this.registry.set('run', run); saveRun(run); this.scene.start('game'); };
    const btnY = top + steps.length * rowH + 110;

    if (saved) {
      // продовження — спершу підготовка (склад і апгрейди), а не одразу зміна
      button(this, W / 2, btnY, 520, 110, t('cont', { n: saved.day }), () => { this.registry.set('run', saved); this.scene.start('shop'); });
      // нова гра стирає прогрес — питаємо вдруге прямо на кнопці
      let sure = false;
      const again = button(this, W / 2, btnY + 130, 420, 84, t('newGame'), () => {
        if (!sure) { sure = true; again.label.setText(t('newGameSure')); again.setColor(C.red); return; }
        start(newRun(CONFIG));
      }, C.greyDark, 30);
    } else {
      const play = button(this, W / 2, btnY + 20, 460, 120, t('play'), () => start(newRun(CONFIG)));
      this.tweens.add({ targets: play, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    soundToggle(this, 60, 60);
    button(this, W - 90, 60, 130, 64, t('lang'), () => { toggleLang(); this.scene.restart(); }, C.purple, 26);
  }
}
