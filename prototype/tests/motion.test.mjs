import test from 'node:test';
import assert from 'node:assert/strict';
import { solveArm, handoffPose, sampleSpring, waveAt, swordPose, SEA_WATERLINE } from '../motion.mjs';

test('painted hand reaches the shared handle without changing bone lengths', () => {
  const root = [710, 400], target = [865, 480];
  const arm = solveArm(root, target, 112, 102, 1);
  assert.ok(Math.abs(Math.hypot(arm.elbow[0]-root[0],arm.elbow[1]-root[1])-112)<1e-7);
  assert.ok(Math.abs(Math.hypot(arm.hand[0]-arm.elbow[0],arm.hand[1]-arm.elbow[1])-102)<1e-7);
  assert.ok(Math.hypot(arm.hand[0]-target[0],arm.hand[1]-target[1])<1e-7);
});

test('painter holds above the receiving hand and then withdraws', () => {
  const contact = handoffPose(0.55);
  assert.ok(contact.masterHand[1]<contact.grip[1]-30);
  assert.deepEqual(contact.auntieHand, contact.grip);
  const after = handoffPose(1);
  assert.deepEqual(after.auntieHand, after.grip);
  assert.ok(Math.hypot(after.masterHand[0]-after.grip[0],after.masterHand[1]-after.grip[1])>25);
});

test('handoff poses are continuous at the ownership transfer', () => {
  const a=handoffPose(0.66999), b=handoffPose(0.67001);
  assert.ok(Math.hypot(a.grip[0]-b.grip[0],a.grip[1]-b.grip[1])<0.1);
  assert.ok(Math.hypot(a.masterHand[0]-b.masterHand[0],a.masterHand[1]-b.masterHand[1])<0.1);
});

test('cloth follows a damped spring instead of jumping to the input state', () => {
  let s={value:0,velocity:0}; s=sampleSpring(s,1,1/60);
  assert.ok(s.value>0 && s.value<0.2);
  for(let i=0;i<240;i++) s=sampleSpring(s,1,1/60);
  assert.ok(Math.abs(s.value-1)<0.001);
});

test('boat and water can sample a shared, continuous wave', () => {
  const y=waveAt(700,2), nearby=waveAt(700.001,2.001);
  assert.ok(Math.abs(y-nearby)<0.1);
  assert.notEqual(waveAt(700,3),y);
});

test('the close-up moves the painted sword rigidly and detects actual water contact', () => {
  const dry=swordPose(0),wet=swordPose(1);
  assert.equal(dry.inWater,false);
  assert.ok(dry.tip[1]+14<SEA_WATERLINE);
  assert.equal(wet.tip[0],dry.tip[0]);
  assert.equal(wet.tip[1]-dry.tip[1],wet.offset-dry.offset);
  assert.equal(swordPose(.73).inWater,false);
  assert.equal(swordPose(.74).inWater,true);
  assert.equal(swordPose(1).inWater,true);
  assert.deepEqual(swordPose(-1),dry);
  assert.deepEqual(swordPose(2),wet);
});
