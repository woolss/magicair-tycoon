// Усі числа гри — тут. Після правки цифр економіки перезапускаємо sim/economy_sim.py.
// Гроші — лише цілі числа.

export const CONFIG = {
  startMoney: 300,
  shiftSec: 180,

  // Товари: закупівля, продаж, гелій (од.)
  items: {
    latex: { buy: 5, sell: 15, helium: 1 },
  },
  // Кольори латексу на полиці (ступінь 1 — три кольори)
  colors: {
    pink:   0xff5fb8,
    blue:   0x4fa3ff,
    yellow: 0xffc933,
  },

  helium: {
    tank: 100,          // од. в балоні
    tankPrice: 120,     // ціна балона → 1,2 за одиницю
    refillSec: 15,      // очікування нового балона
  },

  // Надування: заповнення 0→1 за fullSec, поки тримаєш палець.
  // [0, greenMin) — недодув, [greenMin, greenMax] — ідеально, > greenMax — лопнула.
  pump: { fullSec: 2.4 },
  inflate: { greenMin: 0.6, greenMax: 0.82, underSellMul: 0.6 },

  customers: {
    slots: 3,           // місць біля прилавка
    baseGapSec: 6,      // середній інтервал приходу (точка)
    firstAtSec: 1.5,
    patienceSec: 35,    // скільки клієнт чекає
    orderMin: 1,
    orderMax: 3,
    tipIfWithinSec: 15, // віддав швидше — чайові
    tipMul: 0.15,
  },

  bundleMax: 6,         // кульок у зв'язці на прилавку

  rent: 40,             // оренда точки за день

  // Зірки за частку обслужених клієнтів
  stars: [0.7, 0.9],    // ≥0.7 → 2★, ≥0.9 → 3★, інакше 1★
};
