// Репліка з'являється лише після довгого очікування, одночасно говорить одна людина.
export function queueRemark(queue, time) {
  for (const customer of queue) {
    const waited = time - customer.arrivedAt - 9;
    if (waited >= 0 && waited % 15 < 3.5) {
      return { id: customer.id, variant: (customer.id + Math.floor(waited / 15)) % 3 };
    }
  }
  return null;
}

// Короткий жест цільного спрайта: ноги залишаються на місці, потім поза повертається до звичайної.
export function staffGesture(now, started, kind) {
  const duration = kind === 'sale' ? 620 : kind === 'tie' ? 460 : 380;
  const k = (now - started) / duration;
  if (k <= 0 || k >= 1) return { y: 0, angle: 0 };
  const pulse = Math.sin(Math.PI * k);
  switch (kind) {
    case 'sale': return { y: -12 * pulse, angle: 3 * pulse };
    case 'tie': return { y: -7 * pulse, angle: -3 * pulse };
    case 'start': return { y: -3 * pulse, angle: -5 * pulse };
    case 'oops': return { y: -3 * pulse, angle: 5 * pulse };
    default: return { y: -3 * pulse, angle: -4 * pulse };
  }
}

export function staffExpression(now, motion, working = false) {
  if (motion) {
    const duration = motion.kind === 'sale' ? 620 : motion.kind === 'tie' ? 460 : 380;
    if (now >= motion.at && now - motion.at < duration) {
      if (motion.kind === 'sale') return 'happy';
      if (['start', 'pick', 'tie'].includes(motion.kind)) return 'focus';
    }
  }
  return working ? 'focus' : null;
}

// Усі арт-спрайти — цільні PNG. Невеликий рух зберігає точку опори біля ніг.
export function posePerson(sprite, t, seed, moving = false, impatient = false) {
  if (!sprite) return;
  if (sprite.baseScaleX == null) {
    sprite.baseScaleX = sprite.scaleX;
    sprite.baseScaleY = sprite.scaleY;
  }
  const wave = Math.sin(t / (moving ? 110 : 650) + seed * 1.7);
  const breathe = moving ? 0.015 : 0.008;
  sprite.setScale(sprite.baseScaleX * (1 + wave * breathe),
    sprite.baseScaleY * (1 + Math.sin(t / 520 + seed) * (moving ? 0.008 : 0.012)));
  sprite.setAngle(wave * (moving ? 1.8 : impatient ? 1.2 : 0.6));
}
