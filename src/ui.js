// Спільні елементи екранів: фон, кнопки, іконки, кнопка звуку, конфеті.
import { W, H, C, txt, drawBalloon, drawItem } from './theme.js';
import { CONFIG } from './config.js';
import * as sfx from './sfx.js';

const Col = () => Phaser.Display.Color;

// Темніший/світліший відтінок кольору: k < 0 — темніше
export function shade(color, k) {
  const c = Col().IntegerToColor(color);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return Col().GetColor(f(c.red), f(c.green), f(c.blue));
}

// Фон: вертикальний градієнт смугами (працює і в Canvas, і в WebGL)
export function backdrop(scene, top = 0xffd9ef, bottom = 0xfff4fa) {
  const g = scene.add.graphics().setDepth(-10);
  const a = Col().IntegerToColor(top), b = Col().IntegerToColor(bottom), n = 40;
  for (let i = 0; i < n; i++) {
    const c = Col().Interpolate.ColorWithColor(a, b, n - 1, i);
    g.fillStyle(Col().GetColor(c.r, c.g, c.b), 1).fillRect(0, (i * H) / n, W, H / n + 1);
  }
  return g;
}

// Кульки, що повільно пливуть угору на фоні
export function floaters(scene, n = 7, alpha = 0.3) {
  const cols = [0xff5fb8, 0x4fa3ff, 0xffc933, C.purple, C.pinkSoft];
  for (let i = 0; i < n; i++) {
    const r = 16 + ((i * 7) % 5) * 5;
    const g = scene.add.graphics().setDepth(-9).setAlpha(alpha);
    g.lineStyle(2, C.greyDark, 0.7).lineBetween(0, r * 1.05, 4, r * 2.8);
    drawBalloon(g, 0, 0, r, cols[i % cols.length]);
    const fly = (fromY) => {
      g.setPosition(40 + Math.random() * (W - 80), fromY);
      scene.tweens.add({ targets: g, y: -140, duration: ((fromY + 140) / (H + 280)) * (16000 + Math.random() * 6000), onComplete: () => fly(H + 140) });
    };
    fly(Math.random() * H);
    scene.tweens.add({ targets: g, angle: { from: -7, to: 7 }, duration: 1600 + i * 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}

// Об'ємна кнопка-пігулка. box.setColor(c) — перефарбувати, box.label — напис.
export function button(scene, x, y, w, h, label, onClick, color = C.magenta, size = 40) {
  const r = h / 2, bg = scene.add.graphics();
  const draw = (col) => {
    bg.clear()
      .fillStyle(0x3a1f45, 0.16).fillRoundedRect(-w / 2, -h / 2 + 9, w, h, r)
      .fillStyle(shade(col, -0.25), 1).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r)
      .fillStyle(col, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r)
      .fillStyle(0xffffff, 0.14).fillRoundedRect(-w / 2 + r * 0.6, -h / 2 + h * 0.1, w - r * 1.2, h * 0.26, h * 0.13);
  };
  draw(color);
  const tx = scene.add.text(0, -1, label, txt(size, C.white, { stroke: hexStr(shade(color, -0.3)), strokeThickness: 2 })).setOrigin(0.5);
  const box = scene.add.container(x, y, [bg, tx]).setSize(w, h + 10).setInteractive({ useHandCursor: true });
  box.label = tx;
  box.setColor = (c) => { color = c; draw(c); tx.setStroke(hexStr(shade(c, -0.3)), 2); return box; };
  box.on('pointerdown', () => {
    sfx.click();
    scene.tweens.killTweensOf(box);
    box.setScale(1);
    scene.tweens.add({ targets: box, scale: 0.93, duration: 70, yoyo: true });
    onClick();
  });
  return box;
}
const hexStr = (n) => '#' + n.toString(16).padStart(6, '0');

// Біла картка з тінню
export function card(g, x, y, w, h, r = 24, color = C.white) {
  g.fillStyle(0x3a1f45, 0.1).fillRoundedRect(x, y + 6, w, h, r);
  g.fillStyle(color, 1).fillRoundedRect(x, y, w, h, r);
  return g;
}

// Монетка
export function coinIcon(g, x, y, r) {
  g.fillStyle(0xd99a00, 1).fillCircle(x, y + r * 0.12, r);
  g.fillStyle(0xffc933, 1).fillCircle(x, y, r);
  g.fillStyle(0xffe07a, 1).fillCircle(x, y, r * 0.68);
  g.fillStyle(0xd99a00, 1).fillRoundedRect(x - r * 0.12, y - r * 0.42, r * 0.24, r * 0.84, r * 0.12);
  g.fillStyle(0xffffff, 0.7).fillCircle(x - r * 0.42, y - r * 0.42, r * 0.16);
}

// Іконки апгрейдів (намальовані формами, без тексту)
export function upIcon(g, id, x, y, s = 30) {
  if (id === 'pump2' || id === 'pump3') {
    g.fillStyle(0x7c8a99, 1).fillRoundedRect(x - s * 0.55, y - s * 0.7, s * 1.1, s * 1.5, s * 0.2);
    g.fillStyle(0xffffff, 1).fillCircle(x, y - s * 0.12, s * 0.38);
    g.lineStyle(3, C.red, 1).lineBetween(x, y - s * 0.12, x + s * 0.22, y - s * 0.34);
    const n = id === 'pump2' ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const ax = x + s * 0.72 + i * s * 0.34;
      g.fillStyle(C.green, 1).fillTriangle(ax, y - s * 0.3, ax, y + s * 0.1, ax + s * 0.3, y - s * 0.1);
    }
    return;
  }
  if (id === 'sign') {
    g.fillStyle(0x3b2250, 1).fillRoundedRect(x - s, y - s * 0.6, s * 2, s * 1.2, s * 0.25);
    g.lineStyle(4, C.magenta, 1).strokeRoundedRect(x - s * 0.82, y - s * 0.44, s * 1.64, s * 0.88, s * 0.2);
    g.fillStyle(0xff9df0, 1).fillCircle(x - s * 0.35, y, s * 0.16).fillCircle(x + s * 0.05, y, s * 0.16).fillCircle(x + s * 0.45, y, s * 0.16);
    return;
  }
  if (id === 'confetti') { drawItem(g, CONFIG.items.confetti, x, y, s * 0.72); return; }
  if (id === 'foil') {
    drawItem(g, CONFIG.items.heart, x - s * 0.36, y + s * 0.1, s * 0.6);
    drawItem(g, CONFIG.items.star, x + s * 0.42, y - s * 0.12, s * 0.5);
    return;
  }
  if (id === 'online') {
    // телефон із кулькою на екрані
    g.fillStyle(0x3b2250, 1).fillRoundedRect(x - s * 0.45, y - s * 0.8, s * 0.9, s * 1.6, s * 0.18);
    g.fillStyle(0xfff4fa, 1).fillRoundedRect(x - s * 0.36, y - s * 0.64, s * 0.72, s * 1.2, s * 0.08);
    drawBalloon(g, x, y - s * 0.12, s * 0.26, C.magenta);
    g.fillStyle(C.green, 1).fillCircle(x + s * 0.45, y - s * 0.72, s * 0.2);
    return;
  }
  if (id === 'shop') {
    // вітрина магазину з навісом
    g.fillStyle(0xffffff, 1).fillRect(x - s * 0.8, y - s * 0.3, s * 1.6, s * 1.0);
    g.fillStyle(0xaee0ff, 1).fillRect(x - s * 0.62, y - s * 0.12, s * 0.62, s * 0.62).fillRect(x + s * 0.12, y - s * 0.12, s * 0.5, s * 0.82);
    for (let i = 0; i < 4; i++) g.fillStyle(i % 2 ? 0xffffff : C.magenta, 1).fillRect(x - s * 0.9 + i * s * 0.45, y - s * 0.7, s * 0.45, s * 0.4);
    return;
  }
  if (id === 'digits') { drawItem(g, CONFIG.items.digit, x, y, s * 0.72); return; }
  if (id === 'helper') {
    g.fillStyle(0xf6c9a8, 1).fillCircle(x, y - s * 0.45, s * 0.34);
    g.fillStyle(0x2b1a12, 1).slice(x, y - s * 0.48, s * 0.36, Math.PI, 0, false).fillPath();
    g.fillStyle(C.purple, 1).fillRoundedRect(x - s * 0.55, y - s * 0.08, s * 1.1, s * 0.85, s * 0.3);
    g.fillStyle(C.green, 1).fillCircle(x + s * 0.6, y - s * 0.6, s * 0.22);
    return;
  }
  if (id === 'ads') {
    // рупор
    g.fillStyle(C.magenta, 1).fillTriangle(x - s * 0.5, y - s * 0.18, x + s * 0.55, y - s * 0.62, x + s * 0.55, y + s * 0.62);
    g.fillStyle(C.magenta, 1).fillRoundedRect(x - s * 0.75, y - s * 0.22, s * 0.35, s * 0.44, s * 0.08);
    g.lineStyle(3, C.gold, 1).lineBetween(x + s * 0.75, y - s * 0.4, x + s * 0.95, y - s * 0.55).lineBetween(x + s * 0.8, y, x + s * 1.02, y).lineBetween(x + s * 0.75, y + s * 0.4, x + s * 0.95, y + s * 0.55);
    return;
  }
  if (id === 'tank200') {
    g.fillStyle(0x3f73e0, 1).fillRoundedRect(x - s * 0.42, y - s * 0.6, s * 0.84, s * 1.4, s * 0.38);
    g.fillStyle(0x7fa8ff, 1).fillRoundedRect(x - s * 0.28, y - s * 0.45, s * 0.18, s * 1.05, s * 0.09);
    g.fillStyle(0x7c8a99, 1).fillRect(x - s * 0.12, y - s * 0.86, s * 0.24, s * 0.28);
    g.fillStyle(C.white, 1).fillRoundedRect(x - s * 0.3, y + s * 0.02, s * 0.6, s * 0.34, s * 0.1);
    g.fillStyle(C.green, 1).fillRect(x - s * 0.2, y + s * 0.12, s * 0.4, s * 0.14);
  }
}

// Кнопка звуку: динамік із хвильками або з хрестиком
export function soundToggle(scene, x, y, depth = 150) {
  const g = scene.add.graphics();
  const draw = () => {
    const m = sfx.isMuted();
    g.clear().fillStyle(0x3a1f45, 0.2).fillCircle(0, 4, 28).fillStyle(C.white, 1).fillCircle(0, 0, 28);
    g.fillStyle(m ? C.greyDark : C.purple, 1).fillRect(-13, -6, 8, 12).fillTriangle(-6, -6, -6, 6, 5, 0).fillTriangle(-6, -6, 5, -14, 5, 0).fillTriangle(-6, 6, 5, 14, 5, 0);
    if (m) {
      g.lineStyle(3, C.red, 1).lineBetween(9, -6, 19, 6).lineBetween(19, -6, 9, 6);
    } else {
      g.lineStyle(3, C.purple, 1);
      g.beginPath(); g.arc(5, 0, 9, -0.9, 0.9); g.strokePath();
      g.beginPath(); g.arc(5, 0, 15, -0.9, 0.9); g.strokePath();
    }
  };
  draw();
  const box = scene.add.container(x, y, [g]).setSize(64, 64).setDepth(depth).setInteractive({ useHandCursor: true });
  box.on('pointerdown', () => {
    sfx.setMuted(!sfx.isMuted());
    sfx.click();
    draw();
    scene.tweens.add({ targets: box, scale: 0.88, duration: 70, yoyo: true });
  });
  return box;
}

// Дощ конфеті
export function confettiRain(scene, n = 50, depth = 50) {
  const cols = [0xff5fb8, 0x4fa3ff, 0xffc933, C.purple, C.green, 0xff8a3d];
  for (let i = 0; i < n; i++) {
    const p = scene.add.rectangle(Math.random() * W, -20 - Math.random() * 300, 10, 16, cols[i % cols.length]).setDepth(depth);
    scene.tweens.add({
      targets: p, y: H + 40, x: p.x + (Math.random() - 0.5) * 200, angle: (Math.random() - 0.5) * 720,
      duration: 2200 + Math.random() * 1600, delay: Math.random() * 500, ease: 'Sine.easeIn', onComplete: () => p.destroy(),
    });
  }
}

// Число, що «набігає» до значення
export function countUp(scene, textObj, to, { from = 0, duration = 500, fmt = (v) => String(v), delay = 0, sound = true } = {}) {
  const c = { v: from };
  textObj.setText(fmt(from));
  return scene.tweens.add({
    targets: c, v: to, duration, delay, ease: 'Cubic.easeOut',
    onUpdate: () => { textObj.setText(fmt(Math.round(c.v))); if (sound && Math.round(c.v) !== to) sfx.count(); },
    onComplete: () => textObj.setText(fmt(to)),
  });
}
