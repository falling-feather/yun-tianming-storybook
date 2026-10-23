import test from 'node:test';
import assert from 'node:assert/strict';
import {figures} from '../art.mjs';
import {createFigurePose,skinPoint,paintedBend,transformPoint} from '../rig.mjs';
import {handoffPose} from '../motion.mjs';

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const placement={master:{foot:[590,720],height:430},auntie:{foot:[887,720],height:350}};

test('a resting connected drawing is reconstructed without moving any painted joint',()=>{
  for(const name of ['master','auntie']){
    const definition=figures[name],rest=createFigurePose(definition,placement[name]);
    for(const key of ['shoulder','elbow','wrist','grip']){
      assert.ok(distance(skinPoint(definition[key],rest),transformPoint(rest.body,definition[key]))<1e-6,name+' '+key);
    }
  }
});

test('elbow side is derived from the two opposite-facing paintings',()=>{
  assert.equal(paintedBend(figures.master),1);
  assert.equal(paintedBend(figures.auntie),-1);
});

test('withdrawing the hand cannot pull the painted collar and neck into the sleeve',()=>{
  const pose=createFigurePose(figures.master,{...placement.master,hand:[706,442],relax:1});
  for(const point of [[535,320],[570,260]])assert.ok(distance(skinPoint(point,pose),transformPoint(pose.body,point))<1e-6);
});

test('handoff uses two separate grips on the same shaft before ownership changes',()=>{
  const p=handoffPose(.58),delta=[p.masterHand[0]-p.auntieHand[0],p.masterHand[1]-p.auntieHand[1]];
  assert.ok(distance(p.masterHand,p.auntieHand)>32);
  assert.ok(Math.abs(delta[0]*p.shaft[1]-delta[1]*p.shaft[0])<1e-7);
  assert.equal(p.owner,'both');
  assert.equal(handoffPose(1).owner,'auntie');
});

test('painted shoulders, elbows, wrists and hands stay joined throughout the handoff',()=>{
  for(let i=0;i<=40;i++){
    const p=handoffPose(i/40);
    for(const name of ['master','auntie']){
      const pose=createFigurePose(figures[name],{...placement[name],hand:p[name+'Hand'],handAngle:p.shaftAngle,relax:name==='master'?p.release:0});
      for(const key of ['shoulder','elbow','wrist','grip'])assert.ok(distance(skinPoint(figures[name][key],pose),pose[key])<1e-6,name+' '+key+' '+i);
      assert.ok(pose.error<.01,name+' target '+i+' '+pose.error);
      assert.ok(Math.abs(pose.wristFlex)<=figures[name].wristLimit+1e-3,name+' wrist '+i);
      assert.ok(pose.elbow[1]>pose.shoulder[1]+3,name+' elbow must bend down '+i);
    }
  }
});
