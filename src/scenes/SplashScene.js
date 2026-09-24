import { W, H, C, drawBalloon } from '../theme.js';
import { backdrop } from '../ui.js';

// Лого MagicAir з трьох векторних частин (однаковий кадр 960×560, тож лягають одна на одну)
const PARTS = ['ele', 'ball', 'text'];
const KNOT = [0.2115, 0.4054];            // вузлик кульки — точка, з якої вона надувається
const COLS = [0xff5fb8, 0x4fa3ff, 0xffc933, C.purple, C.magenta, 0x3ccf6e, 0xff8a3d];
const LX = W / 2, LY = H / 2 - 40, SCALE = 0.62;

// Заставка: слоник вистрибує, кулька в хоботі надувається, вискакує напис, далі — меню. Тап — пропустити.
export class SplashScene extends Phaser.Scene {
  constructor() { super('splash'); }

  preload() {
    for (const p of PARTS) this.load.svg(`logo-${p}`, `assets/logo-${p}.svg`, { width: 960, height: 560 });
    this.load.svg('logo-word', 'assets/logo-word.svg', { width: 922, height: 235 });   // для неонової вивіски
    for (const k of ['point', 'shop', 'venue']) this.load.image(`bg-${k}`, `assets/bg-${k}.jpg`);   // арт-фони
    this.load.image('counter', 'assets/counter.png');   // арт-прилавок із соплом і касою
    for (const k of ['seller', 'helper', 'courier', 'courierb', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c1b', 'c2b', 'c3b', 'c4b', 'c5b', 'c6b']) this.load.image(`ch-${k}`, `assets/ch-${k}.png`);   // арт-персонажі (…b — спиною)
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

    const logo = this.add.container(LX, LY).setDepth(10).setScale(SCALE);
    const img = (k) => this.add.image(0, 0, `logo-${k}`);
    const ele = img('ele'), text = img('text');
    // кулька крутиться й росте від вузлика
    const ball = img('ball').setOrigin(...KNOT);
    ball.setPosition((KNOT[0] - 0.5) * 960, (KNOT[1] - 0.5) * 560);
    logo.add([ele, ball, text]);

    // 1) слоник вистрибує знизу
    ele.setAlpha(0).setY(60);
    this.tweens.add({ targets: ele, alpha: 1, y: 0, duration: 380, delay: 300, ease: 'Back.easeOut' });

    // 2) кулька надувається: трохи «перебирає», стискається і заспокоюється
    ball.setScale(0.05);
    this.tweens.chain({
      targets: ball,
      tweens: [
        { scaleX: 1.12, scaleY: 1.08, duration: 520, delay: 650, ease: 'Sine.easeOut' },
        { scaleX: 0.95, scaleY: 1.03, duration: 130, ease: 'Sine.easeInOut' },
        { scaleX: 1, scaleY: 1, duration: 160, ease: 'Sine.easeOut' },
      ],
    });
    // потім легенько гойдається на нитці
    this.tweens.add({ targets: ball, angle: { from: -5, to: 5 }, duration: 1100, delay: 1460, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 3) напис вискакує з пружинкою
    text.setScale(0).setAlpha(0);
    this.tweens.add({ targets: text, scale: 1, alpha: 1, duration: 520, delay: 1300, ease: 'Back.easeOut', easeParams: [2] });
    this.tweens.add({ targets: logo, scale: SCALE * 1.03, duration: 700, delay: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // блиск-зірочки, коли все зібралось
    this.time.delayedCall(1500, () => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const p = this.add.star(LX, LY, 5, 5, 12, COLS[i % COLS.length]).setDepth(9);
        this.tweens.add({
          targets: p, x: LX + Math.cos(a) * 330, y: LY + Math.sin(a) * 250, angle: 200, alpha: 0, scale: 0.4,
          duration: 900, ease: 'Cubic.easeOut', onComplete: () => p.destroy(),
        });
      }
    });

    this.time.delayedCall(3300, () => this.next());
    this.input.once('pointerdown', () => this.next());
  }

  next() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(300, 255, 244, 250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('start'));
  }
}
