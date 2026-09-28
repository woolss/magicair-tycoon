// Репліка з'являється лише після довгого очікування, одночасно говорить одна людина.
export function queueRemark(queue, time) {
  for (const customer of queue) {
    const waited = time - customer.arrivedAt - 12;
    if (waited >= 0 && waited % 15 < 3.5) {
      return { id: customer.id, variant: (customer.id + Math.floor(waited / 15)) % 3 };
    }
  }
  return null;
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
