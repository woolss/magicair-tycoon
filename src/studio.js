// Косметика магазину: не впливає на зміну, товар і доходи.
export const STUDIO_ITEMS = [
  { id: 'room-lavender', group: 'room', price: 3000, art: 'room-shop-lavender' },
  { id: 'room-peach', group: 'room', price: 3500, art: 'room-shop-peach' },
  { id: 'seller-lavender', group: 'seller', price: 1400, art: 'ch-seller-lavender' },
  { id: 'seller-sunshine', group: 'seller', price: 1600, art: 'ch-seller-sunshine' },
  { id: 'helper-lavender', group: 'helper', price: 1400, art: 'ch-helper-lavender' },
  { id: 'helper-sunshine', group: 'helper', price: 1600, art: 'ch-helper-sunshine' },
  { id: 'decor-lamp', group: 'decor', price: 900, art: 'decor-heart-lamp' },
  { id: 'decor-gifts', group: 'decor', price: 700, art: 'decor-gifts' },
  { id: 'decor-plant', group: 'decor', price: 800, art: 'decor-plant' },
];

const IDS = Object.fromEntries(STUDIO_ITEMS.map((item) => [item.id, item]));
export const STUDIO_DEFAULT = { owned: [], room: 'default', seller: 'default', helper: 'default', decor: [] };

// Старі збереження без studio і неповні записи поводяться як стандартна кімната.
export function studioState(run) {
  const s = run?.studio || {};
  const owned = Array.isArray(s.owned) ? [...new Set(s.owned.filter((id) => IDS[id]))] : [];
  const selected = (group) => s[group] === 'default' || (IDS[s[group]]?.group === group && owned.includes(s[group])) ? s[group] : 'default';
  return {
    owned, room: selected('room'), seller: selected('seller'), helper: selected('helper'),
    decor: Array.isArray(s.decor) ? [...new Set(s.decor.filter((id) => IDS[id]?.group === 'decor' && owned.includes(id)))] : [],
  };
}

export function studioEnabled(run) { return !!run?.owned?.includes('shop'); }

// Один тап по доступній картці купує та встановлює річ; наступні тапи перемикають її без оплати.
export function chooseStudio(run, id) {
  if (!studioEnabled(run)) return null;
  const s = studioState(run);
  if (id !== 'default' && !IDS[id]) return null;
  if (id === 'default') return { ...run, studio: { ...s, room: 'default' } };
  const item = IDS[id];
  if (item.group === 'helper' && !run.owned.includes('helper')) return null;   // форма — лише коли є другий продавець
  const buying = !s.owned.includes(id);
  if (buying && run.money < item.price) return null;
  const next = { ...s, owned: buying ? [...s.owned, id] : s.owned };
  if (item.group === 'decor') {
    next.decor = s.decor.includes(id) ? s.decor.filter((x) => x !== id) : [...s.decor, id];
  } else {
    next[item.group] = id;
  }
  return { ...run, money: run.money - (buying ? item.price : 0), studio: next };
}

export function chooseDefaultOutfit(run, group) {
  if (!studioEnabled(run) || !['seller', 'helper'].includes(group)) return null;
  return { ...run, studio: { ...studioState(run), [group]: 'default' } };
}
