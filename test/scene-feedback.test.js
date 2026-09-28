import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { Shift, makeRng } from '../src/logic.js';
import { newRun } from '../src/run.js';
import { SPOT, ART, P } from '../src/iso.js';
import { setLang, upName, upDesc } from '../src/i18n.js';
globalThis.Phaser = { Scene: class {} };
const { GameScene, route } = await import('../src/scenes/GameScene.js');
const no = () => {};

test('customer routes stay inside the scene, including retargeting during entry and exit', () => {
  // Both counter layouts, all queue places, and the art doorway.
  const destinations = [ART.door, ...SPOT.queue, ...SPOT.slots,
    ...SPOT.slots.map(([x, y]) => [x, y - 0.7])];
  const check = point => {
    const [x, y] = P(...point);
    assert.ok(x >= 45 && x <= 675, `customer body clips at ${point}: screen x=${x}`);
    assert.ok(y >= 180 && y <= 1030, `customer leaves floor at ${point}`);
  };
  for (const from of destinations) for (const to of destinations) {
    let start = from;
    for (const end of route(from, to)) {
      for (let i = 0; i <= 10; i++) {
        const pos = start.map((v, j) => v + (end[j] - v) * i / 10);
        check(pos);
        // A free counter or a queue change can redirect a walking customer.
        for (const next of destinations) route(pos, next).forEach(check);
      }
      start = end;
    }
  }
});

test('scene enables walking guard and releases helper only at final counter position', () => {
  const scene = new GameScene();
  scene.registry = { get: k => k === 'run' ? { ...newRun(CONFIG), owned: ['helper'] } : {} };
  Object.defineProperty(scene, 'cameras', { get() { throw new Error('stop-before-drawing'); } });
  assert.throws(() => scene.create(), /stop-before-drawing/);
  const s = scene.shift;
  assert.equal(s.waitWalk, true);
  s.nextArrival = Infinity;
  s.seat(0, { id: 1, order: { pink: 1 }, arrivedAt: 0 });
  const cust = s.customers[0], target = SPOT.slots[0];
  const container = { setPosition() { return this; }, setDepth() { return this; } };
  scene.people.set(cust.id, { id: cust.id, cust, c: container, front: { setVisible: no }, back: { setVisible: no }, bubble: { setVisible: no }, tag: { setVisible: no }, bar: { clear: no }, pos: [target[0] - 1, target[1]], target, path: [target], slot: 0, state: 'in' });
  scene.time = { now: 1000 };
  scene.syncPeople(.01); s.update(.01);
  assert.equal(cust.walking, true); assert.equal(s.helper.cust, null);
  scene.syncPeople(1); assert.equal(cust.walking, false);
  s.update(.01); assert.equal(s.helper.cust, cust);
});

test('packing immediately redraws the remaining counter bundle', () => {
  const s = new Shift(CONFIG, { rng: makeRng(1), owned: ['foil', 'online'], stock: CONFIG.startStock });
  s.online = { id: 1, order: { pink: 1 }, at: 0, deadline: 75 };
  s.bundle = [{ key: 'pink', quality: 'perfect' }, { key: 'blue', quality: 'perfect' }];
  const scene = new GameScene(); scene.shift = s;
  let rendered = null;
  scene.renderBundle = () => { rendered = s.bundle.map(b => b.key); };
  scene.hideTicket = no; scene.sendCourier = no;
  s.pack(); s.drainEvents().forEach(e => scene.onEvent(e));
  assert.deepEqual(rendered, ['blue']);
});

test('seller II has real names and terms in both languages', () => {
  for (const lang of ['uk', 'ru']) {
    setLang(lang); assert.notEqual(upName('helper2'), 'helper2');
    assert.match(upDesc('helper2'), /110/); assert.match(upDesc('helper2'), /5/);
  }
  setLang('uk');
});
