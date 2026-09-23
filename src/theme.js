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
