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
    digit:    { buy: 40, sell: 100, helium: 6, kind: 'digit', unlock: 'digits',  color: 0xffc21a },
  },
  stockMax: 60,         // місця на полиці під кожен товар

  // Замовлення (як у симуляторі): латекс 1–3 завжди, конфеті 40% ×1–2, фольга 50% ×1–2
  // День народження (коли відкриті цифри): до звичайного замовлення додається одна цифра
  orders: { latexMin: 1, latexMax: 3, confettiChance: 0.4, foilChance: 0.5, birthdayChance: 0.2 },

  helium: {
    tank: 100,          // од. в балоні (апгрейд — 200)
    tankPrice: 120,     // ціна балона → 1,2 за одиницю
    refillSec: 15,      // очікування нового балона
  },

  // Надування: заповнення 0→1 за fullSec. Відпустив нижче greenMin — кулька чекає, можна додути;
  // [greenMin, greenMax] — ідеально; вище — лопнула.
  // Насос швидший → зелена зона ширша, щоб «вікно» в секундах лишалось однаковим (≈0,4 с).
  pumps: [
    { fullSec: 2.4,  greenMax: 0.767 },  // насос I
    { fullSec: 1.92, greenMax: 0.808 },  // насос II
    { fullSec: 1.53, greenMax: 0.861 },  // насос III
  ],
  inflate: { greenMin: 0.6, underSellMul: 0.6 },

  customers: {
    slots: 3,           // місць біля прилавка
    queueMax: 3,        // ще стільки чекають у черзі
    baseGapSec: 8,      // середній інтервал приходу (точка); ріст — через дорожчі замовлення, не через натовп
    firstAtSec: 1.5,
    patienceSec: 35,    // скільки клієнт чекає біля прилавка (відлік — коли підійшов)
    queuePatienceSec: 45, // скільки чекає в черзі, поки не звільниться місце
    noStockLeaveSec: 3, // нема потрібного товару — йде за 3 с
    tipIfWithinSec: 15, // віддав швидше (від підходу до прилавка) — чайові
    tipMul: 0.15,
  },

  bundleMax: 8,         // кульок у зв'язці на прилавку

  rent: 90,             // оренда точки за день
  salary: 50,           // зарплата продавцю за день

  // Апгрейди ступенів 1–2 (порядок = порядок у списку)
  upgrades: [
    { id: 'pump2',    price: 120, req: null,    effect: { pump: 1 } },
    { id: 'sign',     price: 450, req: null,    effect: { flow: 1.15 } },
    { id: 'confetti', price: 350, req: null,    effect: { unlock: 'confetti' } },
    { id: 'foil',     price: 600, req: null,    effect: { unlock: 'foil' } },
    { id: 'tank200',  price: 500, req: null,    effect: { tank: 200 } },
    { id: 'pump3',    price: 900, req: 'pump2', effect: { pump: 2 } },
    { id: 'online',   price: 1200, req: 'foil', effect: { online: true } },
    // ступінь 3 — магазин
    { id: 'shop',     price: 2500, req: 'foil', effect: { shop: true } },
    { id: 'digits',   price: 2000, req: 'shop', effect: { unlock: 'digits' } },
    { id: 'helper',   price: 2400, req: 'shop', effect: { helper: true } },
    { id: 'ads',      price: 2500, req: 'shop', effect: { birthday: 0.4 } },
  ],

  // Магазин: дорожча оренда, клієнти терплячіші (потік клієнтів НЕ росте)
  shop: { rent: 150, patienceSec: 45 },

  // Другий продавець: сам обслуговує замовлення до maxBalloons кульок (будь-яких), повільніше за гравця
  helper: { salary: 100, serveSec: 8, maxBalloons: 3 },

  // Онлайн-замовлення з доставкою (апгрейд «online»): одне за раз, більший набір, більше часу, кур'єр забирає коробку
  online: {
    firstAtSec: 20,      // перше замовлення після початку зміни
    gapMinSec: 20,       // пауза після виконаного/пропущеного
    gapMaxSec: 30,
    retrySec: 8,         // не вистачає товару — спробувати пізніше
    timeSec: 75,         // скільки чекає замовлення
    lastAtSec: 40,       // ближче до кінця зміни нові не приходять
    latexMin: 2, latexMax: 4, foilMin: 1, foilMax: 2, confettiChance: 0.4,
    fee: 60,             // оплата доставки
    tipIfWithinSec: 35,  // упакував швидко — чайові
  },

  // Зірки за частку обслужених клієнтів
  stars: [0.7, 0.9],    // ≥0.7 → 2★, ≥0.9 → 3★, інакше 1★
};
