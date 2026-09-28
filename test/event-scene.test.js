import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Phaser = { Scene: class {} };
const { EventScene } = await import('../src/scenes/EventScene.js');

test('tall event meter pill clamps corner radius to its width', () => {
  const corners = [];
  const graphics = { setDepth() { return this; }, fillStyle() { return this; },
    fillRoundedRect(x, y, w, h, radius) { corners.push({ w, h, radius }); return this; } };
  EventScene.prototype.pill.call({ add: { graphics: () => graphics } }, 638, 748, 52, 234);
  assert.deepEqual(corners, [{ w: 52, h: 234, radius: 26 }, { w: 52, h: 234, radius: 26 }]);
});
