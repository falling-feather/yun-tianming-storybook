const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { const t=clamp(x); return t*t*(3-2*t); };
const mix = (a,b,t) => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

export function solveArm(root, target, upper, lower, bend = 1) {
  const dx=target[0]-root[0],dy=target[1]-root[1];
  const distance=clamp(Math.hypot(dx,dy),Math.abs(upper-lower)+0.001,upper+lower-0.001);
  const theta=Math.atan2(dy,dx);
  const offset=Math.acos(clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1));
  const angle=theta+bend*offset;
  const elbow=[root[0]+Math.cos(angle)*upper,root[1]+Math.sin(angle)*upper];
  const hand=[root[0]+Math.cos(theta)*distance,root[1]+Math.sin(theta)*distance];
  return {root,elbow,hand};
}

export function handoffPose(progress) {
 const t=clamp(progress),approach=ease(t/.5),release=ease((t-.67)/.33),grip=[739,450],shaft=[7,-40],masterGrip=[grip[0]+shaft[0],grip[1]+shaft[1]];
 const auntieHand=mix([747,484],grip,approach),masterHand=mix(masterGrip,[706,442],release);
 return{grip,shaft,shaftAngle:Math.atan2(shaft[0],-shaft[1]),auntieHand,masterHand,release,approach,owner:t<.5?'master':t<=.67?'both':'auntie'};
}

export function sampleSpring(state,target,seconds,stiffness=70,damping=13) {
  let value=state.value,velocity=state.velocity;
  for(let remaining=Math.max(0,seconds);remaining>1e-9;) {
    const dt=Math.min(remaining,1/120);
    velocity+=((target-value)*stiffness-velocity*damping)*dt;
    value+=velocity*dt;remaining-=dt;
  }
  return {value,velocity};
}

export function waveAt(x,time) {
  return Math.sin(time*1.25+x*0.009)*3.5+Math.sin(time*1.9+x*0.016)*1.4;
}

export function windAt(x,time) {
  return Math.sin(time*0.9+x*0.003)*0.65+Math.sin(time*1.7+x*0.006)*0.35;
}

// In the close-up the hilt is outside the frame. The entire painted blade moves
// as one rigid object; the soap's lower edge and the painting share this line.
export const SEA_WATERLINE = 510;
export const SEA_DIP_TRAVEL = 144;
export function swordPose(depth,centerX=990) {
  const offset=clamp(depth)*SEA_DIP_TRAVEL,tip=[centerX,390+offset];
  return {tip,offset,inWater:tip[1]+14>=SEA_WATERLINE};
}
