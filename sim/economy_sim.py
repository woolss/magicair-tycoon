import random, statistics as st

# ---------- ТОВАРЫ ----------
ITEMS = {
  # key: (закупка, продажа, гелий ед., этап-открытия)
  'latex':    (5,  15, 1, 'start'),
  'confetti': (10, 30, 1, 'confetti'),
  'foil':     (20, 55, 3, 'foil'),
  'number':   (40, 110, 6, 'numbers'),
}
HELIUM_PRICE = 1.2          # за единицу (баллон 100 ед = 120)

SHIFT = 180                 # секунд смены
# ---------- АПГРЕЙДЫ (порядок = жадная покупка) ----------
UPGRADES = [
  ('Насос II',          120,  None,        {'speed': 2.0}),
  ('Вывеска',           250,  None,        {'flow': 1.25}),
  ('Конфетти',          350,  None,        {'unlock': 'confetti'}),
  ('Фольга',            600,  None,        {'unlock': 'foil'}),
  ('Баллон 200',        500,  None,        {'tank': 200}),
  ('Насос III',         900,  'Насос II',  {'speed': 1.6}),
  ('Магазин',          2500,  'Фольга',    {'room': 2}),
  ('Цифры',            2000,  'Магазин',   {'unlock': 'numbers'}),
  ('Продавец',         2200,  'Магазин',   {'staff': 1}),
  ('Реклама',          2500,  'Магазин',   {'flow': 1.5}),
  ('Машина',           6000,  'Цифры',     {'car': 1}),
  ('Насос IV',         4000,  'Насос III', {'speed': 1.3}),
  ('Баллон 400',       3500,  'Машина',    {'tank': 400}),
  ('Цех',             20000,  'Машина',    {'room': 3}),
]
RENT = {1: 40, 2: 150, 3: 400}
SALARY = 70

def order_for(state, rng):
    """Какой набор выбирает клиент (зависит от открытого ассортимента)."""
    o = {'latex': rng.randint(1, 3)}
    if 'confetti' in state['open'] and rng.random() < .4: o['confetti'] = rng.randint(1, 2)
    if 'foil' in state['open'] and rng.random() < .5:     o['foil'] = rng.randint(1, 2)
    if 'numbers' in state['open'] and rng.random() < .35:
        o['number'] = rng.randint(1, 2); o['latex'] += rng.randint(2, 4)
    return o

def margin(o):
    return sum(n*(ITEMS[k][1]-ITEMS[k][0]-ITEMS[k][2]*HELIUM_PRICE) for k, n in o.items())

def play_day(state, skill, rng):
    t, earned, served, lost = 0.0, 0.0, 0, 0
    helium_left = state['tank']
    base_gap = {1: 6, 2: 4.5, 3: 3.5}[state['room']] / state['flow']
    # продавец: второй «поток» обслуживания, медленнее игрока
    workers = [0.0] + [0.0]*state['staff']
    speeds  = [state['speed']/skill] + [state['speed']*1.6]*state['staff']
    arrive = 0.0
    while True:
        arrive += rng.expovariate(1/base_gap)
        if arrive > SHIFT: break
        o = order_for(state, rng)
        n = sum(o.values()); he = sum(ITEMS[k][2]*v for k, v in o.items())
        i = min(range(len(workers)), key=lambda j: workers[j])
        start = max(workers[i], arrive)
        if start - arrive > 25:        # терпение клиента 25 с
            lost += 1; continue
        if helium_left < he:           # дозаказ гелия: 15 с простоя
            start += 15; helium_left = state['tank']
        dur = 3 + n*speeds[i]
        workers[i] = start + dur
        if workers[i] > SHIFT + 10: lost += 1; continue
        helium_left -= he
        tip = 1.15 if start-arrive < 8 else 1.0
        earned += margin(o)*tip; served += 1
    if state['car']:                    # доставка/фотозона раз в день
        earned += rng.choice([250, 300, 400, 1200 if rng.random() < .3 else 350])
    cost = RENT[state['room']] + SALARY*state['staff']
    return earned - cost, earned, cost, served, lost

def run(skill=0.8, seed=1, days=60):
    rng = random.Random(seed)
    s = {'money': 300, 'speed': 2.5, 'flow': 1.0, 'tank': 100, 'room': 1,
         'staff': 0, 'car': 0, 'open': {'start'}, 'owned': set()}
    log, day_of = [], {}
    for d in range(1, days+1):
        net, earned, cost, served, lost = play_day(s, skill, rng)
        s['money'] = max(0, s['money'] + net)   # мягкий пол: в минус не уходим
        log.append((d, round(net), round(earned), cost, served, lost))
        for name, price, req, eff in UPGRADES:
            if name in s['owned'] or (req and req not in s['owned']): continue
            if s['money'] >= price:
                s['money'] -= price; s['owned'].add(name); day_of[name] = d
                for k, v in eff.items():
                    if k == 'unlock': s['open'].add(v)
                    elif k == 'flow': s['flow'] *= v
                    elif k == 'staff': s['staff'] += v
                    else: s[k] = v
            else: break  # строго по порядку: копим на следующий
    return log, day_of

if __name__ == '__main__':
    for skill, label in [(1.0, 'сильный'), (0.8, 'средний'), (0.55, 'слабый')]:
        days = {}
        profits = []
        for seed in range(40):
            log, d = run(skill, seed)
            for k, v in d.items(): days.setdefault(k, []).append(v)
            profits.append([x[1] for x in log])
        print(f'\n=== игрок {label} (skill={skill}) — медиана дня покупки ===')
        for name, *_ in UPGRADES:
            v = days.get(name, [])
            got = len(v)
            print(f'  {name:12s} день {st.median(v) if v else "—":>5}   (купили {got}/40)')
        d1 = [p[0] for p in profits]; d5 = [p[4] for p in profits]; d20=[p[19] for p in profits]
        print(f'  прибыль: день1 ~{st.median(d1):.0f}, день5 ~{st.median(d5):.0f}, день20 ~{st.median(d20):.0f}, мин. за всё {min(min(p) for p in profits):.0f}')
