import test from 'node:test';
import assert from 'node:assert/strict';
import { availableMissions, missionProgress, recordMissionEvent } from '../src/missions.js';

const start = () => ({ day: 1, money: 150, owned: [] });

test('early missions count personal green sales and sold latex, once across days', () => {
  let run = start(), paid = 0;
  const sale = (green, helper, count) => {
    const result = recordMissionEvent(run, { type: 'sale', green, helper, order: { pink: count } });
    run = result.run;
    paid += result.bonus;
  };
  sale(true, true, 3);          // помічниця не виконує особисте завдання
  sale(false, false, 3);        // жовта смужка теж не рахується
  for (let i = 0; i < 5; i++) sale(true, false, 1);
  assert.equal(missionProgress(run, availableMissions(run)[0]), 5);
  assert.deepEqual(run.missions.completed.sort(), ['latex10', 'quick5']);
  assert.equal(paid, 180);
  assert.equal(recordMissionEvent(run, { type: 'sale', green: true, order: { pink: 3 } }).bonus, 0);
});

test('online, helper, digits and events stay locked and event reward is paid once', () => {
  let run = start();
  run = recordMissionEvent(run, { type: 'onlinePacked' }).run;
  assert.equal(run.missions.progress.online1, undefined);
  run = { ...run, owned: ['foil', 'online', 'car'] };
  run = recordMissionEvent(run, { type: 'onlinePacked' }).run;
  assert.equal(run.missions.progress.online1, 1);
  assert.equal(run.missions.progress.online2, 1);
  assert.equal(recordMissionEvent(run, { type: 'eventResult', done: false, stars: 3 }).bonus, 0);
  const result = recordMissionEvent(run, { type: 'eventResult', done: true, stars: 3 });
  assert.equal(result.bonus, 380);
  assert.equal(recordMissionEvent(result.run, { type: 'eventResult', done: true, stars: 3 }).bonus, 0);
});
