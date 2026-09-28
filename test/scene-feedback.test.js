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
  const container = { x: 0, setPosition(x) { this.x = x; return this; }, setDepth() { return this; } };
  const figure = () => ({ scaleX: 1, scaleY: 1, setVisible: no, setScale: no, setAngle: no });
  scene.people.set(cust.id, { id: cust.id, cust, c: container, front: figure(), back: figure(), bubble: { setVisible: no }, tag: { setVisible: no }, talk: { setVisible: no }, bar: { clear: no }, pos: [target[0] - 1, target[1]], target, path: [target], slot: 0, state: 'in' });
  scene.time = { now: 1000 };
  scene.syncPeople(.01); s.update(.01);
  assert.equal(cust.walking, true); assert.equal(s.helper.cust, null);
  scene.syncPeople(1); assert.equal(cust.walking, false);
  s.update(.01); assert.equal(s.helper.cust, cust);
});

test('queue remark disappears as soon as its customer moves to the counter', () => {
  const scene = new GameScene();
  const customer = { id: 8, arrivedAt: 0, order: { pink: 1 } };
  scene.shift = { t: 9.5, queue: [customer], customers: [] };
  scene.people = new Map(); scene.time = { now: 1000 };
  const figure = () => ({ scaleX: 1, scaleY: 1, setVisible: no, setScale: no, setAngle: no });
  const talk = { visible: false, setVisible(value) { this.visible = value; } };
  const c = { x: 0, y: 0, setPosition(x, y) { this.x = x; this.y = y; return this; }, setDepth() { return this; } };
  const v = { id: customer.id, cust: customer, c, front: figure(), back: figure(),
    bubble: { setVisible: no }, tag: { setVisible: no }, talk,
    talkText: { setText: no }, bar: { clear: no }, pos: [...SPOT.queue[0]],
    target: SPOT.queue[0], path: [SPOT.queue[0]], slot: -1, state: 'in' };
  scene.people.set(customer.id, v);
  scene.syncPeople(.01);
  assert.equal(talk.visible, true);
  scene.shift.queue = [];
  scene.shift.customers = [customer];
  scene.syncPeople(.01);
  assert.equal(talk.visible, false);
});

test('seller and helper react only to their own orders', () => {
  const scene = new GameScene();
  scene.time = { now: 1000 }; scene.people = new Map(); scene.renderBundle = no;
  scene.onEvent({ type: 'helperTake', id: 1 });
  assert.equal(scene.staffMotion.helper.kind, 'start');
  assert.equal(scene.staffMotion.seller, undefined);
  scene.onEvent({ type: 'sale', helper: true, id: 1, tip: 0 });
  assert.equal(scene.staffMotion.helper.kind, 'sale');
  assert.equal(scene.staffMotion.seller, undefined);
  scene.onEvent({ type: 'sale', helper: false, id: 2, tip: 0 });
  assert.equal(scene.staffMotion.seller.kind, 'sale');
});

test('main seller leans once per order, helper sales do not reset the gesture', () => {
  const scene = new GameScene();
  scene.time = { now: 1000 }; scene.people = new Map(); scene.renderBundle = no;
  scene.barPos = () => [0, 0];
  const gestures = [];
  scene.staffReact = (who, kind) => gestures.push({ who, kind });
  scene.onEvent({ type: 'pick', key: 'pink' });
  scene.onEvent({ type: 'pick', key: 'blue' });
  scene.onEvent({ type: 'sale', helper: true, id: 1, tip: 0 });
  scene.onEvent({ type: 'pick', key: 'yellow' });
  assert.equal(gestures.filter(g => g.who === 'seller' && g.kind === 'pick').length, 1);
  scene.onEvent({ type: 'sale', helper: false, id: 2, tip: 0 });
  scene.onEvent({ type: 'pick', key: 'pink' });
  assert.equal(gestures.filter(g => g.who === 'seller' && g.kind === 'pick').length, 2);
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

test('courier pauses, picks up smoothly and credits a delivery once before leaving', () => {
  const scene = new GameScene();
  const target = [...SPOT.courier];
  const k = { pos: [target[0] + 1, target[1]], target, phase: 'in', cash: 100, tip: 0,
    c: { setPosition() { return this; }, setDepth() { return this; }, destroy: no },
    front: { setVisible: no }, back: { setVisible: no },
    box: { setPosition: no }, hands: { add: no } };
  scene.couriers = [k]; scene.time = { now: 1000 }; scene.heldCash = 100;
  const tweens = []; scene.tweens = { add: t => tweens.push(t) };
  let payments = 0; scene.flyCoins = () => payments++;
  scene.moveCouriers(0.1);
  assert.ok(Math.abs(k.pos[0] - target[0] - 0.7) < 1e-9);
  k.pos = [...target]; scene.moveCouriers(0);
  assert.equal(k.phase, 'wait');
  scene.moveCouriers(0.4); assert.equal(tweens.length, 0);
  scene.moveCouriers(0.06); assert.equal(tweens.length, 1);
  assert.equal(tweens[0].duration, 800); assert.equal(payments, 0);
  scene.moveCouriers(0.1); assert.equal(tweens.length, 1);
  tweens[0].onComplete();
  assert.equal(scene.heldCash, 0); assert.equal(payments, 1); assert.equal(k.phase, 'hold');
  scene.moveCouriers(0.2); assert.equal(k.phase, 'hold');
  scene.moveCouriers(0.2); assert.equal(k.phase, 'out');
  scene.moveCouriers(0.1); assert.equal(payments, 1);
});
