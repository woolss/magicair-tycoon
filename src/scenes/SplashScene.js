import { W, H, C, txt, drawBalloon } from '../theme.js';
import { backdrop } from '../ui.js';

// Справжнє лого: коли буде файл — покласти в assets/ і вказати шлях тут
const LOGO_URL = null;
const COLS = [0xff5fb8, 0x4fa3ff, 0xffc933, C.purple, C.magenta, 0x3ccf6e, 0xff8a3d];

// Заставка при запуску: кульки злітають, лого «надувається», далі — меню. Тап — пропустити.
export class SplashScene extends Phaser.Scene {
  constructor() { super('splash'); }

  preload() {
    if (LOGO_URL) this.load.image('logo', LOGO_URL);
  }

  create() {
    backdrop(this, 0xf6b8ea, 0xfff4fa);
    this.done = false;

    // хмара кульок пролітає знизу вгору
    for (let i = 0; i < 18; i++) {
      const r = 22 + (i % 4) * 8, g = this.add.graphics();
      g.lineStyle(2, C.greyDark, 0.6).lineBetween(0, r * 1.05, 4, r * 2.6);
      drawBalloon(g, 0, 0, r, COLS[i % COLS.length]);
      g.setPosition(30 + Math.random() * (W - 60), H + 80 + Math.random() * 300);
      this.tweens.add({
        targets: g, y: -200 - Math.random() * 200, duration: 1700 + Math.random() * 900,
        delay: Math.random() * 500, ease: 'Sine.easeIn', onComplete: () => g.destroy(),
      });
      this.tweens.add({ targets: g, angle: { from: -10, to: 10 }, duration: 500 + i * 30, yoyo: true, repeat: -1 });
    }

    // лого: з'являється маленьким і «надувається» з пружинкою
    let logo;
    if (LOGO_URL && this.textures.exists('logo')) {
      logo = this.add.image(W / 2, H / 2 - 40, 'logo').setDepth(10);
      const k = Math.min(560 / logo.width, 360 / logo.height);
      logo.setData('s', k);
    } else {
      logo = this.add.text(W / 2, H / 2 - 40, 'MagicAir', txt(110, C.magenta, { stroke: '#ffffff', strokeThickness: 16 })).setOrigin(0.5).setDepth(10);
      logo.setData('s', 1);
    }
    const s = logo.getData('s');
    logo.setScale(0).setAlpha(0);
    this.tweens.add({ targets: logo, scale: s, alpha: 1, duration: 750, delay: 500, ease: 'Back.easeOut', easeParams: [2.2] });
    this.tweens.add({ targets: logo, scale: s * 1.04, duration: 700, delay: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // блиск-зірочки навколо лого
    this.time.delayedCall(900, () => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const p = this.add.star(W / 2, H / 2 - 40, 5, 5, 12, COLS[i % COLS.length]);
        this.tweens.add({
          targets: p, x: W / 2 + Math.cos(a) * 320, y: H / 2 - 40 + Math.sin(a) * 240, angle: 200, alpha: 0, scale: 0.4,
          duration: 900, ease: 'Cubic.easeOut', onComplete: () => p.destroy(),
        });
      }
    });

    this.time.delayedCall(2900, () => this.next());
    this.input.once('pointerdown', () => this.next());
  }

  next() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(300, 255, 244, 250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('start'));
  }
}
