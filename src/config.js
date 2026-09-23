// Усі числа гри — тут. Після правки цифр економіки перезапускаємо sim/economy_sim.py і sim/bot_days.js.
// Гроші — лише цілі числа.

export const CONFIG = {
  startMoney: 150,
  // Стартовий запас на складі (разом зі startMoney ≈ 450 — як 300 у симуляторі + перший день без закупки)
  startStock: { pink: 20, blue: 20, yellow: 20 },
  shiftSec: 180,

  // Товари: закупівля, продаж, гелій (од.), що відкриває, вигляд
  items: {
    pink:     { buy: 5,  sell: 15, helium: 1, kind: 'latex', unlock: null,       color: 0xff5fb8 },
    blue:     { buy: 5,  sell: 15, helium: 1, kind: 'latex', unlock: null,       color: 0x4fa3ff },
    yellow:   { buy: 5,  sell: 15, helium: 1, kind: 'latex', unlock: null,       color: 0xffc933 },
    confetti: { buy: 10, sell: 30, helium: 1, kind: 'confetti', unlock: 'confetti', color: 0xf3eef8 },
    heart:    { buy: 20, sell: 55, helium: 3, kind: 'heart', unlock: 'foil',     color: 0xff3b6b },
    star:     { buy: 20, sell: 55, helium: 3, kind: 'star',  unlock: 'foil',     color: 0xf5b400 },
  },
  stockMax: 60,         // місця на полиці під кожен товар

  // Замовлення (як у симуляторі): латекс 1–3 завжди, конфеті 40% ×1–2, фольга 50% ×1–2
  orders: { latexMin: 1, latexMax: 3, confettiChance: 0.4, foilChance: 0.5 },

  helium: {
    tank: 100,          // од. в балоні (апгрейд — 200)
    tankPrice: 120,     // ціна балона → 1,2 за одиницю
    refillSec: 15,      // очікування нового балона
  },

  // Надування: заповнення 0→1 за fullSec. Відпустив нижче greenMin — кулька чекає, можна додути;
  // [greenMin, greenMax] — ідеально; вище — лопнула.
  // Насос швидший → зелена зона ширша, щоб «вікно» в секундах лишалось однаковим (≈0,5 с).
  pumps: [
    { fullSec: 2.4,  greenMax: 0.82 },   // насос I
    { fullSec: 1.92, greenMax: 0.875 },  // насос II
    { fullSec: 1.53, greenMax: 0.945 },  // насос III
  ],
  inflate: { greenMin: 0.6, underSellMul: 0.6 },

  customers: {
    slots: 3,           // місць біля прилавка
    queueMax: 3,        // ще стільки чекають у черзі
    baseGapSec: 6,      // середній інтервал приходу (точка)
    firstAtSec: 1.5,
    patienceSec: 35,    // скільки клієнт чекає біля прилавка (відлік — коли підійшов)
    queuePatienceSec: 45, // скільки чекає в черзі, поки не звільниться місце
    noStockLeaveSec: 3, // нема потрібного товару — йде за 3 с
    tipIfWithinSec: 15, // віддав швидше (від підходу до прилавка) — чайові
    tipMul: 0.15,
  },

  bundleMax: 8,         // кульок у зв'язці на прилавку

  rent: 40,             // оренда точки за день
  salary: 50,           // зарплата продавцю за день

  // Апгрейди ступенів 1–2 (порядок = порядок у списку)
  upgrades: [
    { id: 'pump2',    price: 120, req: null,    effect: { pump: 1 } },
    { id: 'sign',     price: 250, req: null,    effect: { flow: 1.25 } },
    { id: 'confetti', price: 350, req: null,    effect: { unlock: 'confetti' } },
    { id: 'foil',     price: 600, req: null,    effect: { unlock: 'foil' } },
    { id: 'tank200',  price: 500, req: null,    effect: { tank: 200 } },
    { id: 'pump3',    price: 900, req: 'pump2', effect: { pump: 2 } },
  ],

  // Зірки за частку обслужених клієнтів
  stars: [0.7, 0.9],    // ≥0.7 → 2★, ≥0.9 → 3★, інакше 1★
};
