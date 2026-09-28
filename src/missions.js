// Одноразові цілі. Прогрес живе в run, нагорода виплачується тільки при першому завершенні.
export const MISSIONS = [
  { id: 'quick5', goal: 5, reward: 90 },
  { id: 'latex10', goal: 10, reward: 90 },
  { id: 'confetti2', unlock: 'confetti', goal: 2, reward: 80 },
  { id: 'foil2', unlock: 'foil', goal: 2, reward: 90 },
  { id: 'online1', unlock: 'online', goal: 1, reward: 100 },
  { id: 'online2', unlock: 'online', goal: 2, reward: 150 },
  { id: 'shop10', unlock: 'shop', goal: 10, reward: 120 },
  { id: 'digit1', unlock: 'digits', goal: 1, reward: 110 },
  { id: 'helper2', unlock: 'helper', goal: 2, reward: 110 },
  { id: 'helper3', unlock: 'helper2', goal: 3, reward: 130 },
  { id: 'digit2', unlock: 'ads', goal: 2, reward: 160 },
  { id: 'event1', unlock: 'car', goal: 1, reward: 160 },
  { id: 'event3', unlock: 'car', goal: 1, reward: 220 },
];

export function availableMissions(run) {
  return MISSIONS.filter((m) => !m.unlock || run.owned.includes(m.unlock));
}

export function missionProgress(run, m) {
  return Math.min(m.goal, run.missions?.progress?.[m.id] || 0);
}

export function recordMissionEvent(run, event) {
  let progress = run.missions?.progress || {};
  let completed = run.missions?.completed || [];
  let bonus = 0;
  const awarded = [];
  for (const m of availableMissions(run)) {
    if (completed.includes(m.id)) continue;
    let amount = 0;
    if (event.type === 'sale') {
      const order = event.order || {};
      if (m.id === 'quick5') amount = !event.helper && event.green ? 1 : 0;
      if (m.id === 'latex10') amount = (order.pink || 0) + (order.blue || 0) + (order.yellow || 0);
      if (m.id === 'confetti2') amount = order.confetti || 0;
      if (m.id === 'foil2') amount = (order.heart || 0) + (order.star || 0);
      if (m.id === 'shop10') amount = 1;
      if (m.id === 'digit1' || m.id === 'digit2') amount = order.digit || 0;
      if (m.id === 'helper2' || m.id === 'helper3') amount = event.helper ? 1 : 0;
    } else if (event.type === 'onlinePacked' && (m.id === 'online1' || m.id === 'online2')) amount = 1;
    else if (event.type === 'eventResult') {
      if (m.id === 'event1') amount = event.done ? 1 : 0;
      if (m.id === 'event3') amount = event.done && event.stars === 3 ? 1 : 0;
    }
    if (!amount) continue;
    const value = Math.min(m.goal, (progress[m.id] || 0) + amount);
    progress = { ...progress, [m.id]: value };
    if (value === m.goal) {
      completed = [...completed, m.id];
      awarded.push(m.id);
      bonus += m.reward;
    }
  }
  return { run: { ...run, missions: { progress, completed } }, bonus, awarded };
}
