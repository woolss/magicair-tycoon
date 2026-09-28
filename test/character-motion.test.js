import test from 'node:test';
import assert from 'node:assert/strict';
import { queueRemark } from '../src/characterMotion.js';

test('only waiting customers get one timed remark; leaving the queue hides it', () => {
  const queue = [{ id: 1, arrivedAt: 2 }, { id: 2, arrivedAt: 4 }];
  assert.equal(queueRemark(queue, 13), null);
  assert.equal(queueRemark(queue, 14)?.id, 1);
  assert.equal(queueRemark(queue, 18)?.id, 2);
  assert.equal(queueRemark(queue, 20), null);
  assert.equal(queueRemark(queue.slice(1), 16)?.id, 2);
  assert.equal(queueRemark([], 35), null);
});
