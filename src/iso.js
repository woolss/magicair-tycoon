// Ізометричний магазин: проекція, зал, прилавок, люди. Малюємо простими формами (до арту).
import { C, drawBalloon, drawItem } from './theme.js';

export const ISO = { S: 46, OX: 330, OY: 400 };
const C30 = 0.866;

// (x, y, z) у клітинках підлоги → точка на екрані
export function P(x, y, z = 0) {
  return [ISO.OX + (x - y) * C30 * ISO.S, ISO.OY + (x + y) * 0.5 * ISO.S - z * ISO.S];
}
const pt = (x, y, z) => { const [a, b] = P(x, y, z); return { x: a, y: b }; };

function quad(g, color, alpha, ...corners) {
  g.fillStyle(color, alpha).fillPoints(corners.map((c) => pt(...c)), true);
}

// Коробка x0..x1 × y0..y1 × z0..z1: верх, ліва грань (+y), права грань (+x)
export function box(g, [x0, x1, y0, y1, z0, z1], top, left, right) {
  quad(g, left, 1, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
  quad(g, right, 1, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
  quad(g, top, 1, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  g.lineStyle(1.5, 0x3c1e46, 0.25);
  g.strokePoints([pt(x0, y1, z1), pt(x1, y1, z1), pt(x1, y0, z1)], false);
}

function cyl(g, x, y, r, h, col, cap) {
  const [cx, cy] = P(x, y, 0), [, ty] = P(x, y, h);
  const rx = r * ISO.S, ry = r * ISO.S * 0.55;
  g.fillStyle(col, 1).fillRect(cx - rx, ty, rx * 2, cy - ty).fillEllipse(cx, cy, rx * 2, ry * 2);
  g.fillStyle(0x1e3f99, 0.3).fillRect(cx + rx * 0.35, ty, rx * 0.45, cy - ty);
  g.fillStyle(cap, 1).fillEllipse(cx, ty, rx * 2, ry * 2);
  g.fillStyle(0x7c8a99, 1).fillRect(cx - 6, ty - 14, 12, 14);
  return [cx, ty - 12];
}

// Точки сцени, з якими працює гра
export const SPOT = {
  door: [0.6, 8.5],
  slots: [[7.0, 8.4], [9.8, 8.2], [12.6, 8.0]],
  queue: [[11.8, 12.4], [9.4, 12.6], [7.0, 12.8]],
  seller: [5.0, 3.3],
  nozzle: [2.5, 5.2, 2.0],
  bundle: [4.0, 5.3, 2.0],
  tank: [0.9, 2.5],
};

// Підлога, стіни, декор, полиці, балони — все, що позаду продавця
export function drawRoom(scene) {
  const g = scene.add.graphics().setDepth(0);
  const R = 13, WH = 6, F = 19;
  quad(g, 0xf4cfa6, 1, [0, 0, 0], [F, 0, 0], [F, F, 0], [0, F, 0]);
  g.lineStyle(1.5, 0xe2b384, 1);
  for (let i = 1; i < F; i++) g.lineBetween(...P(i, 0), ...P(i, F));
  quad(g, 0xffd3ec, 1, [0.4, 7.6, 0], [9.5, 7.6, 0], [9.5, 9.4, 0], [0.4, 9.4, 0]);
  // стіни
  quad(g, 0xcdb6f2, 1, [0, 0, 0], [0, R, 0], [0, R, WH], [0, 0, WH]);
  quad(g, 0xb89ce6, 1, [0, 0, 0], [0, R, 0], [0, R, 1.2], [0, 0, 1.2]);
  quad(g, 0xffc9e6, 1, [0, 0, 0], [R, 0, 0], [R, 0, WH], [0, 0, WH]);
  quad(g, 0xf7add5, 1, [0, 0, 0], [R, 0, 0], [R, 0, 1.2], [0, 0, 1.2]);
  quad(g, 0x8e62c9, 1, [0, 0, WH], [0, R, WH], [-0.35, R, WH], [-0.35, -0.35, WH]);
  quad(g, 0xe27bb9, 1, [0, 0, WH], [R, 0, WH], [R, -0.35, WH], [-0.35, -0.35, WH]);
  // вікно
  quad(g, 0xffffff, 1, [0, 1.2, 2.0], [0, 4.6, 2.0], [0, 4.6, 4.9], [0, 1.2, 4.9]);
  quad(g, 0xaee0ff, 1, [0, 1.4, 2.2], [0, 4.4, 2.2], [0, 4.4, 4.7], [0, 1.4, 4.7]);
  g.lineStyle(5, 0xffffff, 1);
  g.lineBetween(...P(0, 2.9, 2.2), ...P(0, 2.9, 4.7));
  g.lineBetween(...P(0, 1.4, 3.45), ...P(0, 4.4, 3.45));
  // двері
  quad(g, 0xffffff, 1, [0, 7.4, 0], [0, 9.6, 0], [0, 9.6, 4.3], [0, 7.4, 4.3]);
  quad(g, 0xbfe6ff, 1, [0, 7.6, 0], [0, 9.4, 0], [0, 9.4, 4.1], [0, 7.6, 4.1]);
  g.fillStyle(C.purple, 1).fillCircle(...P(0, 9.1, 2), 4);
  // гірлянда над вікном
  for (let i = 0; i < 9; i++) {
    const [x, y] = P(0, 0.8 + i * 0.5, 5.6 - Math.sin((i / 8) * Math.PI) * 0.4);
    drawBalloon(g, x, y, 11, [0xff5fb8, 0x4fa3ff, 0xffc933, 0xb338b5][i % 4]);
  }
  // рамка з фото
  quad(g, 0xffffff, 1, [0, 5.4, 2.4], [0, 6.8, 2.4], [0, 6.8, 4.0], [0, 5.4, 4.0]);
  quad(g, 0xffe07a, 1, [0, 5.55, 2.55], [0, 6.65, 2.55], [0, 6.65, 3.85], [0, 5.55, 3.85]);
  { const [x, y] = P(0, 6.1, 3.2); drawBalloon(g, x - 9, y, 9, 0xff5fb8); drawBalloon(g, x + 8, y - 5, 9, 0x4fa3ff); }
  // полиці з кульками за продавцем
  for (const z of [2.1, 3.2]) box(g, [1.4, 7.4, 0, 0.8, z, z + 0.16], 0xfff4fa, 0xe8c9dc, 0xf3d7e8);
  const heart = { kind: 'heart', color: 0xff3b6b }, star = { kind: 'star', color: 0xffc21a };
  const cols = [0xff5fb8, 0x4fa3ff, 0xffc933, 0xb338b5, 0x3ccf6e];
  [[2.1, 0], [3.2, 1]].forEach(([z, row]) => {
    for (let i = 0; i < 6; i++) {
      const [x, y] = P(1.9 + i * 1.0, 0.4, z + 0.16);
      if (row === 1 && i % 3 === 1) drawItem(g, heart, x, y - 15, 14);
      else if (row === 1 && i % 3 === 2) drawItem(g, star, x, y - 15, 14);
      else drawBalloon(g, x, y - 16, 13, cols[(i + row * 2) % 5]);
    }
  });
  // неонова вивіска на рожевій стіні: текст зі зсувом під кут стіни (як намальований на ній)
  const [sx, sy] = P(3.4, 0, 5.0);
  if (!scene.textures.exists('neon')) {
    const tex = scene.textures.createCanvas('neon', 440, 330);
    const ctx = tex.getContext();
    ctx.setTransform(1, Math.tan(Math.PI / 6), 0, 1, 0, 0);
    ctx.font = '900 60px Nunito, Arial, sans-serif';
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#ff5fe0'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff5fe0';
    ctx.fillText('MagicAir', 10, 80); ctx.strokeText('MagicAir', 10, 80); ctx.fillText('MagicAir', 10, 80);
    tex.refresh();
  }
  scene.add.image(sx - 10, sy - 80, 'neon').setOrigin(0, 0).setDepth(0);
  // балони з гелієм
  cyl(g, 0.8, 1.3, 0.5, 3.0, 0x4f8dff, 0x7fb0ff);
  const tankTop = cyl(g, SPOT.tank[0], SPOT.tank[1], 0.5, 3.0, 0x4f8dff, 0x7fb0ff);
  return { g, tankTop };
}

// Прилавок, каса, сопло зі шлангом — перед продавцем
export function drawCounter(scene, tankTop) {
  const g = scene.add.graphics().setDepth(2);
  box(g, [1.8, 11.2, 4.6, 5.9, 0, 2.0], 0xfff1f8, C.purple, 0x9a2c9c);
  quad(g, C.magenta, 1, [1.8, 5.9, 1.55], [11.2, 5.9, 1.55], [11.2, 5.9, 1.7], [1.8, 5.9, 1.7]);
  box(g, [8.6, 9.5, 4.8, 5.6, 2.0, 2.6], 0xe9e3f0, 0x6e6280, 0x8c809e);
  box(g, [8.7, 9.4, 4.85, 5.1, 2.6, 3.2], 0xbfe6ff, 0x4a3f5c, 0x5c506e);
  const [nx, ny] = P(...SPOT.nozzle);
  const [tx, ty] = tankTop;
  const hose = new Phaser.Curves.CubicBezier(
    new Phaser.Math.Vector2(tx, ty), new Phaser.Math.Vector2(tx - 30, ty + 40),
    new Phaser.Math.Vector2(nx - 40, ny - 10), new Phaser.Math.Vector2(nx - 4, ny - 8));
  g.lineStyle(6, 0x5b5566, 1).strokePoints(hose.getPoints(24));
  g.fillStyle(0x7c8a99, 1).fillRoundedRect(nx - 8, ny - 22, 16, 22, 4);
  return g;
}

// Людина: ноги в (0, 0) контейнера. back — спиною до нас.
export function drawPerson(g, o, back) {
  const k = o.k || 1;
  g.fillStyle(0x3a1f45, 0.18).fillEllipse(0, 0, 56 * k, 20 * k);
  g.fillStyle(o.pants, 1).fillRoundedRect(-17 * k, -50 * k, 14 * k, 50 * k, 7 * k).fillRoundedRect(3 * k, -50 * k, 14 * k, 50 * k, 7 * k);
  g.fillStyle(0x3a2a3f, 1).fillEllipse(-10 * k, -2 * k, 20 * k, 10 * k).fillEllipse(10 * k, -2 * k, 20 * k, 10 * k);
  g.fillStyle(o.shirt, 1).fillRoundedRect(-26 * k, -108 * k, 52 * k, 64 * k, 20 * k);
  g.fillRoundedRect(-36 * k, -102 * k, 14 * k, 46 * k, 7 * k).fillRoundedRect(22 * k, -102 * k, 14 * k, 46 * k, 7 * k);
  g.fillStyle(o.skin, 1).fillCircle(-29 * k, -55 * k, 7 * k).fillCircle(29 * k, -55 * k, 7 * k);
  if (o.apron) {
    g.fillStyle(o.apron, 1).fillRoundedRect(-20 * k, -92 * k, 40 * k, 50 * k, 8 * k);
  }
  const hy = -128 * k;
  g.fillStyle(o.skin, 1).fillCircle(0, hy, 24 * k);
  g.fillStyle(o.hair, 1);
  if (back) {
    g.fillCircle(0, hy - 1 * k, 25 * k);
    if (o.long) g.fillRoundedRect(-22 * k, hy, 44 * k, 30 * k, 10 * k);
  } else {
    g.slice(0, hy - 1 * k, 25 * k, Math.PI, 0, false).fillPath();
    if (o.long) { g.fillRoundedRect(-27 * k, hy - 4 * k, 9 * k, 34 * k, 4 * k); g.fillRoundedRect(18 * k, hy - 4 * k, 9 * k, 34 * k, 4 * k); }
    g.fillStyle(0x2b1a30, 1).fillCircle(-8 * k, hy + 3 * k, 3 * k).fillCircle(8 * k, hy + 3 * k, 3 * k);
    g.lineStyle(2.5 * k, 0x2b1a30, 1).beginPath();
    g.arc(0, hy + 6 * k, 7 * k, 0.35, Math.PI - 0.35, false);
    g.strokePath();
    g.fillStyle(0xff8fb0, 0.6).fillCircle(-14 * k, hy + 10 * k, 4 * k).fillCircle(14 * k, hy + 10 * k, 4 * k);
  }
}

const SHIRTS = [0xffb347, 0x4fc3a1, 0x7c6cf0, 0xff7aa8, 0x6fb7ff, 0xb5e36a, 0xffd166, 0xef6f6c];
const PANTS = [0x3f5f9e, 0x4a3f5c, 0x2f2f44, 0x55607a, 0x40506b];
const SKINS = [0xf2c3a0, 0xc98f6a, 0xf6d2b8, 0xe0ae88, 0x9c6b4e];
const HAIRS = [0x2b1a12, 0x1e1410, 0xd9a441, 0x5a2e14, 0x7a3b12, 0x2a1a14];

// Вигляд клієнта залежить лише від його номера — той самий від дверей до виходу
export function lookFor(id) {
  const r = (n) => ((id * 2654435761) >>> n) % 997;
  return {
    shirt: SHIRTS[r(3) % SHIRTS.length], pants: PANTS[r(7) % PANTS.length],
    skin: SKINS[r(11) % SKINS.length], hair: HAIRS[r(13) % HAIRS.length], long: r(17) % 2 === 0,
  };
}
