import {solveArm} from './motion.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{const t=clamp(x);return t*t*(3-2*t);};
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function transformPoint(m,p){return[m[0]*p[0]+m[3]*p[1]+m[6],m[1]*p[0]+m[4]*p[1]+m[7]];}
function linkMatrix(source,target,angle,scale){const c=Math.cos(angle)*scale,s=Math.sin(angle)*scale;return[c,s,0,-s,c,0,target[0]-c*source[0]+s*source[1],target[1]-s*source[0]-c*source[1],1];}
export function paintedBend(rig){const v=[rig.wrist[0]-rig.shoulder[0],rig.wrist[1]-rig.shoulder[1]],e=[rig.elbow[0]-rig.shoulder[0],rig.elbow[1]-rig.shoulder[1]];return Math.sign(v[0]*e[1]-v[1]*e[0])||1;}
function boundedArm(root,target,upper,lower,bend,limits){
 const angle=Math.atan2(target[1]-root[1],target[0]-root[0]),near=Math.sqrt(upper*upper+lower*lower+2*upper*lower*Math.cos(limits[1])),far=Math.sqrt(upper*upper+lower*lower+2*upper*lower*Math.cos(limits[0])),d=clamp(length(root,target),near,far);
 return solveArm(root,[root[0]+Math.cos(angle)*d,root[1]+Math.sin(angle)*d],upper,lower,bend);
}
export function createFigurePose(rig,options){
 const scale=options.height/(rig.foot[1]-rig.headY),lean=options.lean||0,sy=scale*(1+(options.breath||0));
 const body=[scale,0,0,-lean*scale,sy,0,options.foot[0]-scale*rig.foot[0]+lean*scale*rig.foot[1],options.foot[1]-sy*rig.foot[1],1],shoulder=transformPoint(body,rig.shoulder),target=options.hand||transformPoint(body,rig.grip);
 const upper=length(rig.shoulder,rig.elbow)*scale,fore=length(rig.elbow,rig.wrist)*scale,bend=paintedBend(rig),a0=Math.atan2(rig.elbow[1]-rig.shoulder[1],rig.elbow[0]-rig.shoulder[0]),b0=Math.atan2(rig.wrist[1]-rig.elbow[1],rig.wrist[0]-rig.elbow[0]);
 const delta=[(rig.grip[0]-rig.wrist[0])*scale,(rig.grip[1]-rig.wrist[1])*scale],relax=options.relax||0;let handAngle=options.handAngle||0,chain,foreAngle=0;
 for(let i=0;i<48;i++){
   const c=Math.cos(handAngle),s=Math.sin(handAngle),w=[target[0]-delta[0]*c+delta[1]*s,target[1]-delta[0]*s-delta[1]*c];
   chain=boundedArm(shoulder,w,upper,fore,bend,rig.elbowLimits);
   foreAngle=wrap(Math.atan2(chain.hand[1]-chain.elbow[1],chain.hand[0]-chain.elbow[0])-b0);
   const requested=foreAngle+wrap((options.handAngle||0)-foreAngle)*(1-relax),desired=foreAngle+clamp(wrap(requested-foreAngle),-rig.wristLimit,rig.wristLimit);
   if(Math.abs(wrap(desired-handAngle))<1e-10)break;handAngle=desired;
 }
 const c=Math.cos(handAngle),s=Math.sin(handAngle),w=[target[0]-delta[0]*c+delta[1]*s,target[1]-delta[0]*s-delta[1]*c];
 chain=boundedArm(shoulder,w,upper,fore,bend,rig.elbowLimits);foreAngle=wrap(Math.atan2(chain.hand[1]-chain.elbow[1],chain.hand[0]-chain.elbow[0])-b0);
 const upperAngle=wrap(Math.atan2(chain.elbow[1]-shoulder[1],chain.elbow[0]-shoulder[0])-a0),upperMatrix=linkMatrix(rig.shoulder,shoulder,upperAngle,scale),foreMatrix=linkMatrix(rig.elbow,chain.elbow,foreAngle,scale),handMatrix=linkMatrix(rig.wrist,chain.hand,handAngle,scale),grip=transformPoint(handMatrix,rig.grip);
 return{rig,scale,body,upper:upperMatrix,fore:foreMatrix,hand:handMatrix,shoulder,elbow:chain.elbow,wrist:chain.hand,grip,error:length(grip,target),wristFlex:wrap(handAngle-foreAngle)};
}
export function armMask(rig,p){let inside=false;const polygon=rig.armRegion;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside?1:0;}
export function skinWeights(rig,p){
 if(!armMask(rig,p))return[0,0,0];
 const upper=[rig.elbow[0]-rig.shoulder[0],rig.elbow[1]-rig.shoulder[1]],upperLength=Math.hypot(...upper),fromShoulder=((p[0]-rig.shoulder[0])*upper[0]+(p[1]-rig.shoulder[1])*upper[1])/upperLength;
 const strength=ease(fromShoulder/rig.shoulderBlend),fore=ease((p[0]-rig.foreBand[0])/(rig.foreBand[1]-rig.foreBand[0])),d=[rig.grip[0]-rig.wrist[0],rig.grip[1]-rig.wrist[1]],h=Math.hypot(...d),along=((p[0]-rig.wrist[0])*d[0]+(p[1]-rig.wrist[1])*d[1])/h,hand=ease((along+12)/30);
 return[strength*(1-hand)*(1-fore),strength*(1-hand)*fore,strength*hand];
}
export function skinPoint(p,pose){const w=skinWeights(pose.rig,p),base=transformPoint(pose.body,p),sum=w[0]+w[1]+w[2],matrices=[pose.upper,pose.fore,pose.hand],result=[base[0]*(1-sum),base[1]*(1-sum)];for(let i=0;i<3;i++){const q=transformPoint(matrices[i],p);result[0]+=q[0]*w[i];result[1]+=q[1]*w[i];}return result;}

