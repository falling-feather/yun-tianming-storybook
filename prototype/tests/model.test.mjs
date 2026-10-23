import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angleDelta, createUmbrella, takeUmbrella, turnUmbrella, stepUmbrella,
  createVoyage, inspectWater, stepVoyage, perspective, createObservation, moveObserver,
} from '../model.mjs';

test('circular drag crosses the -pi/pi seam without inventing a full turn', () => {
  assert.ok(Math.abs(angleDelta(3.1, -3.1) - 0.083185307179586) < 1e-10);
  assert.ok(Math.abs(angleDelta(-3.1, 3.1) + 0.083185307179586) < 1e-10);
});

test('umbrella waits for handoff and slow movement cannot complete the escort', () => {
  const s = createUmbrella();
  stepUmbrella(s, 1);
  assert.equal(s.phase, 'handoff');
  assert.equal(s.progress, 0);
  takeUmbrella(s);
  for (let i = 0; i < 600; i++) stepUmbrella(s, 1 / 60);
  assert.equal(s.phase, 'failed');
  assert.ok(s.open < 0.2);
  assert.ok(s.progress < 1);
});

test('continuous rotation keeps the canopy open and establishes protection', () => {
  const s = createUmbrella();
  takeUmbrella(s);
  for (let i = 0; i < 650; i++) {
    turnUmbrella(s, 0.09, 1 / 60);
    stepUmbrella(s, 1 / 60);
  }
  assert.equal(s.phase, 'complete');
  assert.equal(s.progress, 1);
  assert.equal(s.danger, 0);
});

test('stopping an established rotation closes the umbrella before failure', () => {
  const s = createUmbrella();
  takeUmbrella(s);
  stepUmbrella(s, 3);
  for (let i = 0; i < 30; i++) { turnUmbrella(s, 0.1, 1 / 60); stepUmbrella(s, 1 / 60); }
  const originalOpen = s.open;
  for (let i = 0; i < 150; i++) stepUmbrella(s, 1 / 60);
  assert.ok(s.open < originalOpen);
  assert.ok(s.danger > 0);
  assert.notEqual(s.phase, 'complete');
});

test('frame duration zero changes no physical state', () => {
  const s = createUmbrella(); takeUmbrella(s);
  const before = structuredClone(s); stepUmbrella(s, 0);
  assert.deepEqual(s, before);
});

test('receiving the umbrella has a real handoff before player protection begins', () => {
  const s = createUmbrella();
  takeUmbrella(s);
  assert.equal(s.phase, 'passing');
  stepUmbrella(s, 0.8);
  assert.equal(s.phase, 'passing');
  assert.equal(s.progress, 0);
  assert.equal(s.danger, 0);
  assert.ok(s.transfer > 0 && s.transfer < 1);
  stepUmbrella(s, 2.4);
  assert.equal(s.phase, 'active');
  assert.equal(s.transfer, 1);
});

test('soap outside the water leaves the dangerous sea impassable', () => {
  const s = createVoyage();
  inspectWater(s);
  for (let i = 0; i < 600; i++) stepVoyage(s, 1 / 60, false);
  assert.equal(s.foam, 0);
  assert.equal(s.progress, 0);
  assert.equal(s.soap, 1);
});

test('a sustained patch of foam calms the fish before departure', () => {
  const s = createVoyage();
  inspectWater(s);
  stepVoyage(s, 0.1, true);
  assert.equal(s.progress, 0);
  assert.ok(s.foam > 0);
  for (let i = 0; i < 900; i++) stepVoyage(s, 1 / 60, true);
  assert.equal(s.phase, 'complete');
  assert.equal(s.progress, 1);
  assert.ok(s.soap > 0 && s.soap < 1);
});

test('foam persists after lifting the soap, then decays instead of vanishing', () => {
  const s = createVoyage();
  inspectWater(s);
  for (let i = 0; i < 60; i++) stepVoyage(s, 1 / 60, true);
  const foamBefore = s.foam, soapBefore = s.soap;
  stepVoyage(s, 0.1, false);
  assert.ok(s.foam > 0 && s.foam < foamBefore);
  assert.equal(s.soap, soapBefore);
});

test('the opening illustration waits for the player to approach the water', () => {
  const s = createVoyage();
  stepVoyage(s, 15, true);
  assert.equal(s.phase, 'waiting');
  assert.equal(s.foam, 0);
  assert.equal(s.progress, 0);
  inspectWater(s);
  assert.equal(s.phase, 'dipping');
});

test('a brief dip can be lifted and retried without starting the voyage', () => {
  const s = createVoyage(); inspectWater(s);
  stepVoyage(s, .8, true);
  stepVoyage(s, 6, false);
  assert.equal(s.phase, 'dipping');
  assert.equal(s.progress, 0);
  assert.ok(s.foam < .1);
  stepVoyage(s, 4, true);
  assert.equal(s.phase, 'departing');
});

test('once the fish settle, lifting the sword lets the departure finish', () => {
  const s = createVoyage(); inspectWater(s);
  stepVoyage(s, 4, true);
  assert.equal(s.phase, 'departing');
  assert.ok(s.calm > .9);
  const remainingSoap=s.soap;
  inspectWater(s);
  assert.equal(s.phase, 'departing');
  stepVoyage(s, 12, false);
  assert.equal(s.phase, 'complete');
  assert.equal(s.progress, 1);
  assert.equal(s.soap, remainingSoap);
  const completed=structuredClone(s);
  stepVoyage(s, 10, true);
  assert.deepEqual(s, completed);
});

test('prince image height is exactly constant while ordinary perspective scales', () => {
  const views = [0, 0.25, 0.5, 0.75, 1].map(perspective);
  assert.equal(new Set(views.map(v => v.princeHeight)).size, 1);
  assert.ok(views[0].guardHeight < views[4].guardHeight / 5);
  assert.equal(views[4].guardHeight, views[4].princeHeight);
  assert.ok(views[0].treeHeight < views[4].treeHeight);
});

test('walking close and returning far records a completed observation', () => {
  const s = createObservation();
  moveObserver(s, 0); assert.equal(s.complete, false);
  moveObserver(s, 1); assert.equal(s.sawNear, true); assert.equal(s.complete, false);
  moveObserver(s, 0); assert.equal(s.complete, true);
  moveObserver(s, 2); assert.equal(s.position, 1);
  moveObserver(s, -1); assert.equal(s.position, 0);
});
