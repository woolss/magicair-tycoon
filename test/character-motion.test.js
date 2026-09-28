import test from 'node:test';
import assert from 'node:assert/strict';
import { queueRemark, staffGesture } from '../src/characterMotion.js';

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
