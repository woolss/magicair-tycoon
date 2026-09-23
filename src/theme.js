// Кольори бренду MagicAir (з сайту) + сірий прототип.
export const W = 720;
export const H = 1280;

export const C = {
  bg: 0xfff4fa,
  purple: 0xb338b5,      // меню сайту
  magenta: 0xf117db,     // логотип / заголовки
  pinkSoft: 0xfb92dd,
  white: 0xffffff,
  ink: 0x3a2340,
  grey: 0xd9ccd9,
  greyDark: 0x9b8a9e,
  counter: 0xf3dcef,
  green: 0x3ccf6e,
  red: 0xff4d5e,
  gold: 0xffc933,
};

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export const FONT = '"Nunito", "Arial Rounded MT Bold", Arial, sans-serif';

export const txt = (size, color = C.ink, extra = {}) => ({
  fontFamily: FONT,
  fontSize: size + 'px',
  fontStyle: '800',
  color: hex(color),
  ...extra,
});

// Кулька: овал + вузлик + відблиск
export function drawBalloon(g, x, y, r, color, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillEllipse(x, y, r * 1.7, r * 2);
  g.fillTriangle(x - r * 0.14, y + r * 1.08, x + r * 0.14, y + r * 1.08, x, y + r * 0.92);
  g.fillStyle(0xffffff, 0.45 * alpha);
  g.fillEllipse(x - r * 0.35, y - r * 0.45, r * 0.35, r * 0.55);
  if (color === 0xffffff) {
    g.lineStyle(3, C.grey, alpha);
    g.strokeEllipse(x, y, r * 1.7, r * 2);
  }
}

function starPoints(x, y, r, inner = 0.5) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  return pts;
}

// Будь-який товар: латекс, конфеті, фольга-серце, фольга-зірка
export function drawItem(g, item, x, y, r, alpha = 1) {
  if (item.kind === 'confetti') {
    g.fillStyle(item.color, alpha).fillEllipse(x, y, r * 1.7, r * 2);
    g.lineStyle(3, C.grey, alpha).strokeEllipse(x, y, r * 1.7, r * 2);
    const dots = [[-0.35, -0.3, 0xff5fb8], [0.3, -0.45, 0x4fa3ff], [0.1, 0.1, 0xffc933], [-0.3, 0.4, 0x3ccf6e], [0.4, 0.35, 0xb338b5], [-0.05, -0.65, 0xff8a3d]];
    for (const [dx, dy, col] of dots) g.fillStyle(col, alpha).fillCircle(x + dx * r, y + dy * r, Math.max(2, r * 0.12));
    g.fillStyle(item.color, alpha).fillTriangle(x - r * 0.14, y + r * 1.08, x + r * 0.14, y + r * 1.08, x, y + r * 0.92);
    return;
  }
  if (item.kind === 'heart') {
    const s = r * 0.62;
    g.fillStyle(item.color, alpha);
    g.fillCircle(x - s * 0.62, y - s * 0.35, s * 0.72);
    g.fillCircle(x + s * 0.62, y - s * 0.35, s * 0.72);
    g.fillTriangle(x - s * 1.3, y - s * 0.1, x + s * 1.3, y - s * 0.1, x, y + s * 1.45);
    g.fillStyle(0xffffff, 0.5 * alpha).fillEllipse(x - s * 0.75, y - s * 0.55, s * 0.4, s * 0.55);
    return;
  }
  if (item.kind === 'star') {
    g.fillStyle(item.color, alpha).fillPoints(starPoints(x, y, r * 1.15, 0.5), true);
    g.fillStyle(0xffffff, 0.45 * alpha).fillPoints(starPoints(x - r * 0.12, y - r * 0.12, r * 0.45, 0.5), true);
    return;
  }
  drawBalloon(g, x, y, r, item.color, alpha);
}
