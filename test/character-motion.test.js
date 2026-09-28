import test from 'node:test';
import assert from 'node:assert/strict';
import { queueRemark, staffGesture, staffExpression } from '../src/characterMotion.js';

test('second-row customers speak after nine seconds and leaving hides the remark', () => {
  const queue = [{ id: 1, arrivedAt: 2 }, { id: 2, arrivedAt: 4 }];
  assert.equal(queueRemark(queue, 10.99), null);
  assert.equal(queueRemark(queue, 11)?.id, 1);
  assert.equal(queueRemark(queue, 15)?.id, 2);
  assert.equal(queueRemark(queue, 18), null);
  assert.equal(queueRemark(queue, 20), null);
  assert.equal(queueRemark(queue.slice(1), 13)?.id, 2);
  assert.equal(queueRemark([], 35), null);
});

test('staff gestures return to their resting pose', () => {
  assert.deepEqual(staffGesture(0, 0, 'sale'), { y: 0, angle: 0 });
  assert.ok(staffGesture(310, 0, 'sale').y < -10);
  assert.deepEqual(staffGesture(620, 0, 'sale'), { y: 0, angle: 0 });
});

test('seller and helper expressions follow their own work and sales', () => {
  assert.equal(staffExpression(300, { kind: 'pick', at: 0 }), 'focus');
  assert.equal(staffExpression(400, { kind: 'pick', at: 0 }), null);
  assert.equal(staffExpression(400, { kind: 'start', at: 0 }, true), 'focus');
  assert.equal(staffExpression(500, { kind: 'sale', at: 0 }, false), 'happy');
  assert.equal(staffExpression(700, { kind: 'sale', at: 0 }, false), null);
});
