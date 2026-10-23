import {frames,sheets,figures,voyageArt} from './art.mjs';
import {createFigurePose,skinWeights,armMask,skinPoint} from './rig.mjs';
import {perspective} from './model.mjs';
import {handoffPose,sampleSpring,waveAt,windAt,swordPose,SEA_WATERLINE} from './motion.mjs';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const TAU=Math.PI*2;
const VERTEX=`#version 300 es
in vec2 a_position; in vec2 a_uv; in vec4 a_color; in vec3 a_effect;
uniform vec2 u_resolution;
out vec2 v_uv; out vec2 v_scene; out vec4 v_color; out vec3 v_effect;
void main(){gl_Position=vec4(a_position.x/u_resolution.x*2.-1.,1.-a_position.y/u_resolution.y*2.,0.,1.);v_scene=a_position/u_resolution;v_uv=a_uv;v_color=a_color;v_effect=a_effect;}`;
const FRAGMENT=`#version 300 es
precision highp float;
uniform sampler2D u_image; uniform float u_time; uniform float u_danger; uniform float u_calm;
in vec2 v_uv; in vec2 v_scene; in vec4 v_color; in vec3 v_effect; out vec4 outColor;
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 uv=v_uv;float mode=v_effect.x;vec2 local=v_effect.yz;
 if(mode<.5){float curtain=smoothstep(.5,.8,local.x)*(1.-smoothstep(.2,.6,local.y));uv.x+=sin(local.y*10.+u_time*.9)*.00065*curtain;uv=clamp(uv,vec2(.0006),vec2(.4991));}
 if(mode>10.5&&mode<11.5){float wet=smoothstep(.12,.72,uv.y);uv+=vec2(sin(uv.y*83.+u_time*.85)*.0023,sin(uv.x*56.-u_time*.65)*.0017)*wet*(1.-u_calm*.78);uv=clamp(uv,vec2(.001),vec2(.999));}
 vec4 color=texture(u_image,uv)*v_color;
 if(mode<.5||(mode>4.5&&mode<5.5)){
   float border=smoothstep(0.,.045,v_scene.y)*(1.-smoothstep(.95,1.,v_scene.y));
   color.rgb=mix(vec3(.945,.933,.898),color.rgb,border);
   color.rgb+=sin(u_time*.32)*.009;
 }
 if(mode>.5&&mode<1.5){float grain=noise(floor(uv*1700.));float keep=1.-local.y+grain*.23;float edge=smoothstep(u_danger*1.25-.16,u_danger*1.25-.07,keep);color.a*=edge;color.rgb=mix(color.rgb,vec3(.17,.23,.25),u_danger*.18);}
 if(mode>2.5&&mode<3.5){vec2 p=(local-.5)*2.;float fade=pow(max(0.,1.-dot(p,p)),2.);color.a*=fade*(.7+noise(floor(local*90.))*.3);}
 if(mode>5.5&&mode<6.5){vec2 p=(local-.5)*2.;float fade=pow(max(0.,1.-dot(p,p)),1.5);float n=noise(floor(local*52.+u_time*.15));color.a*=fade*smoothstep(.12,.75,n);}
 if(mode>10.5&&mode<11.5){float edge=smoothstep(0.,.035,v_scene.y)*(1.-smoothstep(.96,1.,v_scene.y));color.rgb=mix(vec3(.945,.933,.898),color.rgb,edge);}
 if(mode>11.5&&mode<12.5){float submerged=smoothstep(${(SEA_WATERLINE-2).toFixed(1)},${(SEA_WATERLINE+22).toFixed(1)},v_scene.y*810.);color.rgb=mix(color.rgb,vec3(.25,.36,.39),submerged*.46);color.a*=1.-submerged*.36;}
 if(color.a<.002)discard;outColor=color;
}`;

function compile(gl,type,source){
 const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
 return shader;
}

const FIGURE_VERTEX=`#version 300 es
precision highp int;
layout(location=0) in vec2 a_source;
layout(location=1) in vec2 a_uv;
layout(location=2) in vec3 a_weights;
layout(location=3) in float a_mask;
uniform mat3 u_body,u_upper,u_fore,u_hand,u_camera;
uniform vec2 u_resolution,u_frame;
uniform float u_time,u_footX,u_scale;
uniform int u_pass;
out vec2 v_uv;out float v_mask;
void main(){
 vec3 p=vec3(a_source,1.);vec3 base=u_body*p;
 float y=(a_source.y-u_frame.x)/u_frame.y;
 float skirt=sin(clamp((y-.46)/.5,0.,1.)*3.14159);
 float tail=clamp((u_footX-a_source.x)/240.,0.,1.);
 base.x+=sin(u_time*.9+a_source.y*.014)*skirt*tail*u_scale*3.;
 float strength=a_weights.x+a_weights.y+a_weights.z;
 vec3 skin=(1.-strength)*base+a_weights.x*(u_upper*p)+a_weights.y*(u_fore*p)+a_weights.z*(u_hand*p);
 vec3 world=u_camera*(u_pass==0?base:skin);
 gl_Position=vec4(world.x/u_resolution.x*2.-1.,1.-world.y/u_resolution.y*2.,0.,1.);
 v_uv=a_uv;v_mask=a_mask;
}`;
const FIGURE_FRAGMENT=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_image;uniform int u_pass;
in vec2 v_uv;in float v_mask;out vec4 outColor;
void main(){vec4 c=texture(u_image,v_uv);float mask=smoothstep(.3,.7,v_mask);c.a*=u_pass==0?1.-mask:mask;c.rgb*=vec3(.98,.99,1.);if(c.a<.002)discard;outColor=c;}`;

class FigureBrush{
 constructor(gl,image){
  this.gl=gl;this.meshes={};this.program=gl.createProgram();
  gl.attachShader(this.program,compile(gl,gl.VERTEX_SHADER,FIGURE_VERTEX));gl.attachShader(this.program,compile(gl,gl.FRAGMENT_SHADER,FIGURE_FRAGMENT));gl.linkProgram(this.program);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
  this.uniforms=Object.fromEntries(['body','upper','fore','hand','camera','resolution','frame','time','footX','scale','pass','image'].map(n=>[n,gl.getUniformLocation(this.program,'u_'+n)]));
  for(const [name,rig]of Object.entries(figures)){
   const frame=frames[rig.frame],vertices=[],cols=64,rows=80;
   const vertex=(u,v)=>{const point=[frame.rect[0]+u*frame.rect[2],frame.rect[1]+v*frame.rect[3]];return[...point,point[0]/image.width,point[1]/image.height,...skinWeights(rig,point),armMask(rig,point)];};
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const quad=[vertex(x/cols,y/rows),vertex((x+1)/cols,y/rows),vertex((x+1)/cols,(y+1)/rows),vertex(x/cols,(y+1)/rows)];
    for(const tri of [[0,1,2],[0,2,3]])for(const i of tri)vertices.push(...quad[i]);
   }
   const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
   for(const [location,size,offset]of[[0,2,0],[1,2,2],[2,3,4],[3,1,7]]){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,32,offset*4);}
   this.meshes[name]={vao,count:vertices.length/8,frame};
  }
  gl.bindVertexArray(null);
 }
 draw(name,pose,pass,texture,camera,time){
  const gl=this.gl,u=this.uniforms,mesh=this.meshes[name];gl.useProgram(this.program);gl.bindVertexArray(mesh.vao);gl.bindTexture(gl.TEXTURE_2D,texture);
  for(const key of ['body','upper','fore','hand'])gl.uniformMatrix3fv(u[key],false,new Float32Array(pose[key]));
  gl.uniformMatrix3fv(u.camera,false,new Float32Array(camera));gl.uniform2f(u.resolution,1440,810);gl.uniform2f(u.frame,mesh.frame.rect[1],mesh.frame.rect[3]);gl.uniform1f(u.time,time);gl.uniform1f(u.footX,pose.rig.foot[0]);gl.uniform1f(u.scale,pose.scale);gl.uniform1i(u.pass,pass);gl.uniform1i(u.image,0);
  gl.drawArrays(gl.TRIANGLES,0,mesh.count);gl.bindVertexArray(null);return mesh.count;
 }
}

export class LivingPainting {
 static async create(canvas){
   const images={};
   await Promise.all(Object.entries(sheets).map(async([name,file])=>{const image=new Image();image.src=`./assets/${file}`;await image.decode();images[name]=image;}));
   return new LivingPainting(canvas,images);
 }
 constructor(canvas,images){
   const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
   if(!gl)throw Error('当前浏览器无法创建绘画画布');
   this.canvas=canvas;this.gl=gl;this.images=images;this.textures={};this.vertices=[];
   this.program=gl.createProgram();
   gl.attachShader(this.program,compile(gl,gl.VERTEX_SHADER,VERTEX));gl.attachShader(this.program,compile(gl,gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(this.program);
   if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
   gl.useProgram(this.program);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   for(const [name,size,offset] of [['a_position',2,0],['a_uv',2,2],['a_color',4,4],['a_effect',3,8]]){
     const location=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,44,offset*4);
   }
   this.resolution=gl.getUniformLocation(this.program,'u_resolution');this.time=gl.getUniformLocation(this.program,'u_time');this.danger=gl.getUniformLocation(this.program,'u_danger');this.calm=gl.getUniformLocation(this.program,'u_calm');
   gl.uniform1i(gl.getUniformLocation(this.program,'u_image'),0);gl.activeTexture(gl.TEXTURE0);
   for(const [name,image]of Object.entries(images)){
     const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
     gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);this.textures[name]=texture;
   }
   const white=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,white);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));this.textures.white=white;
   this.figureBrush=new FigureBrush(gl,images.connected);gl.useProgram(this.program);
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
   const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(1440*ratio);canvas.height=Math.round(810*ratio);
   this.openSpring={value:1,velocity:0};this.cameraX={value:0,velocity:0};this.cameraY={value:0,velocity:0};this.zoomSpring={value:1.025,velocity:0};this.lastScene=-1;this.metrics={};this.debug=false;
 }
 flush(){
   if(!this.vertices.length)return;const gl=this.gl;
   gl.useProgram(this.program);gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   gl.bindTexture(gl.TEXTURE_2D,this.textures[this.currentTexture]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.vertices),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,this.vertices.length/11);
   this.vertexCount+=this.vertices.length/11;this.vertices.length=0;
 }
 triangle(sheet,points,uvs,color=[1,1,1,1],mode=9,locals=[[0,0],[1,0],[1,1]]){
   if(sheet!==this.currentTexture){this.flush();this.currentTexture=sheet;}
   for(let i=0;i<3;i++)this.vertices.push(points[i][0],points[i][1],uvs[i][0],uvs[i][1],...color,mode,...locals[i]);
 }
 frameUV(frame,nx,ny){const image=this.images[frame.sheet];return[(frame.rect[0]+frame.rect[2]*nx)/image.width,(frame.rect[1]+frame.rect[3]*ny)/image.height];}
 quad(frame,map,color=[1,1,1,1],mode=9,cols=1,rows=1){
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
     const coords=[[x/cols,y/rows],[(x+1)/cols,y/rows],[(x+1)/cols,(y+1)/rows],[x/cols,(y+1)/rows]],p=coords.map(v=>map(...v)),uv=coords.map(v=>this.frameUV(frame,...v));
     for(const t of [[0,1,2],[0,2,3]])this.triangle(frame.sheet,t.map(i=>p[i]),t.map(i=>uv[i]),color,mode,t.map(i=>coords[i]));
   }
 }
 rect(frame,x,y,w,h,color=[1,1,1,1],mode=9){this.quad(frame,(u,v)=>[x+u*w,y+v*h],color,mode);}
 oval(x,y,w,h,color,mode=3){
   const p=[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]],uv=[[0,0],[1,0],[1,1],[0,1]];
   for(const t of [[0,1,2],[0,2,3]])this.triangle('white',t.map(i=>p[i]),t.map(i=>uv[i]),color,mode,t.map(i=>uv[i]));
 }
 line(a,b,width,color){
   const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,n=[-(b[1]-a[1])/l*width/2,(b[0]-a[0])/l*width/2],p=[[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];
   for(const t of [[0,1,2],[0,2,3]])this.triangle('white',t.map(i=>p[i]),[[0,0],[1,0],[1,1]],color,9);
 }
 view(x,y,depth=1){return[870+(x-870)*this.zoom+this.cameraX.value*depth,510+(y-510)*this.zoom+this.cameraY.value*depth];}
 figure(name,pose,pass){
  this.flush();const z=this.zoom,camera=[z,0,0,0,z,0,870*(1-z)+this.cameraX.value,510*(1-z)+this.cameraY.value,1];
  this.vertexCount+=this.figureBrush.draw(name,pose,pass,this.textures.connected,camera,this.quiet?0:this.clock);
  this.gl.useProgram(this.program);this.currentTexture=null;
 }
 body(name,x,foot,height,options={}){
   const frame=frames[name],width=height*frame.rect[2]/frame.rect[3],t=this.clock,wind=this.quiet?0:windAt(x,t),lean=options.lean||0;
   let minY=Infinity,maxY=-Infinity;
   const map=(u,v)=>{
     const py=(v-1)*height,edge=Math.max(0,.48-u)*2,cloth=Math.sin(Math.PI*clamp((v-.22)/.76));
     let px=(options.flip?-1:1)*(u-(options.anchorX??.5))*width+wind*cloth*edge*(options.cloak?8:3.4),y=py;
     if(!options.lockHeight&&!this.quiet){y-=Math.sin(t*1.65+(options.phase||0))*1.5*(1-v);px+=Math.sin(t*.6+(options.phase||0))*.8*(1-v);}
     px+=lean*(1-v)*height;
     const point=this.view(x+px,foot+y);minY=Math.min(minY,point[1]);maxY=Math.max(maxY,point[1]);return point;
   };
   this.quad(frame,map,options.color||[.98,.99,1,1],options.mode??9,8,12);
   return{map,bounds:{height:maxY-minY,top:minY,bottom:maxY}};
 }
 umbrella(grip,open,spin,speed,scale=1,options={}){
   const radius=(options.radius??170)*scale*(.14+.86*open),height=(58+(1-open)*122)*scale,tiltShaft=options.tilt||0,apex=[grip[0]+Math.sin(tiltShaft)*285*scale,grip[1]-Math.cos(tiltShaft)*285*scale];
   this.line(apex,[grip[0],grip[1]+16*scale],3.4*scale,[.31,.27,.22,.94]);this.line([apex[0]-1,apex[1]+30*scale],[grip[0]-1,grip[1]+8*scale],.7*scale,[.63,.57,.45,.5]);
   const frame=frames.canopy,sectors=32,rings=4,tilt=.27;
   const at=(r,theta)=>{const ripple=(this.quiet?0:Math.sin((theta-spin)*8)*1.8+Math.sin(theta*5+this.clock*2)*Math.min(1,speed/8))*r*r,z=Math.sin(theta)*(radius*r+ripple),x=Math.cos(theta)*(radius*r+ripple),y=height*r+Math.sin((theta-spin)*8)*r*1.3;return[apex[0]+x,apex[1]+y*Math.cos(tilt)+z*Math.sin(tilt)];};
   const sorted=Array.from({length:sectors},(_,i)=>i).sort((a,b)=>Math.sin((a+.5)*TAU/sectors)-Math.sin((b+.5)*TAU/sectors));
   for(const i of sorted)for(let ring=0;ring<rings;ring++){
     const a=i*TAU/sectors,b=(i+1)*TAU/sectors,r0=ring/rings,r1=(ring+1)/rings,coords=[[r0,a],[r1,a],[r1,b],[r0,b]],points=coords.map(([r,angle])=>at(r,angle)),uv=coords.map(([r,angle])=>this.frameUV(frame,.5+Math.cos(angle-spin)*r*.49,.5+Math.sin(angle-spin)*r*.49)),light=.85+Math.cos((a+b)/2-.7)*.11;
     for(const tri of [[0,1,2],[0,2,3]])this.triangle(frame.sheet,tri.map(k=>points[k]),tri.map(k=>uv[k]),[light,light+.015,light+.025,1]);
   }
   for(let i=0;i<8;i++){const theta=spin+i*TAU/8-Math.min(speed,.8)*.035,edge=at(1,theta),drop=(10+(1-open)*12)*scale,ball=[edge[0]+Math.sin(theta-this.clock*.2)*2*scale,edge[1]+drop];this.line(edge,ball,1.1*scale,[.17,.21,.22,.9]);this.oval(ball[0],ball[1],7*scale,8*scale,[.23,.27,.28,1]);}
   return{apex,center:[apex[0],apex[1]+height*.7],radius};
 }
 dust(){if(this.quiet)return;for(let i=0;i<34;i++){const drift=(this.clock*.025+i*.137)%1,x=600+((i*173)%630)+Math.sin(this.clock*.3+i)*15,y=190+drift*500,alpha=(Math.sin(i*2.8)*.5+.5)*.13*Math.sin(drift*Math.PI);this.oval(x,y,2.5,5.5,[.93,.87,.69,alpha]);}}
 sceneUmbrella(state){
   const s=state.umbrella,t=this.clock,transfer=s.phase==='handoff'?0:s.transfer,p=handoffPose(transfer);
   this.rect(frames.corridor,this.cameraX.value*.2,this.cameraY.value*.2,1440,810,[1,1,1,1],0);this.dust();
   for(const [x,w]of[[590,145],[887,140],[960,105]]){const q=this.view(x,724);this.oval(q[0],q[1],w*this.zoom,18*this.zoom,[.16,.21,.21,.13]);}
   const wristMotion=s.phase==='active'&&!this.quiet?Math.sin(s.angle)*.012:0,tilt=p.shaftAngle+wristMotion;
   const grip=[p.grip[0]+(s.phase==='active'?Math.sin(s.angle)*.65:0),p.grip[1]];
   const master=createFigurePose(figures.master,{foot:[590-p.release*8,720],height:430,hand:p.masterHand,handAngle:tilt,relax:p.release,lean:.004-p.release*.012,breath:this.quiet?0:Math.sin(t*1.35)*.001});
   const auntie=createFigurePose(figures.auntie,{foot:[887,720],height:350,hand:p.approach===1?grip:p.auntieHand,handAngle:tilt,lean:-p.approach*.008,breath:this.quiet?0:Math.sin(t*1.45+1)*.001});
   this.figure('master',master,0);this.figure('auntie',auntie,0);
   this.body('princess',960,720,365,{anchorX:.75,flip:true,lean:-s.danger*.018,cloak:true,mode:1,phase:2});
   if(s.phase!=='complete')this.completedSpinStart=null;else this.completedSpinStart??=t;
   const spin=s.phase==='handoff'?t*3.5:s.angle+(s.phase==='complete'?(t-this.completedSpinStart)*3.5:0),canvasGrip=this.view(...grip);
   const umbrella=this.umbrella(canvasGrip,clamp(this.openSpring.value,.03,1.04),spin,s.speed,this.zoom,{tilt,radius:230});
   this.figure('master',master,1);this.figure('auntie',auntie,1);
   if(s.danger>.05){const q=this.view(960,714);for(let i=0;i<12;i++)this.oval(q[0]+Math.sin(i*2)*38,q[1]-i*s.danger*18,70,32,[.16,.23,.26,s.danger*.12],6);}
   let jointError=0;
   for(const pose of [master,auntie])for(const joint of ['shoulder','elbow','wrist','grip']){const drawn=skinPoint(pose.rig[joint],pose);jointError=Math.max(jointError,Math.hypot(drawn[0]-pose[joint][0],drawn[1]-pose[joint][1]));}
   this.metrics={heldError:auntie.error,jointError,wristFlex:Math.max(Math.abs(master.wristFlex),Math.abs(auntie.wristFlex)),owner:p.owner,gripSeparation:Math.hypot(master.grip[0]-auntie.grip[0],master.grip[1]-auntie.grip[1])};
   if(this.debug){
    for(const pose of [master,auntie]){const points=['shoulder','elbow','wrist','grip'].map(n=>this.view(...pose[n]));for(let i=1;i<points.length;i++)this.line(points[i-1],points[i],1.6,[.07,.48,.68,.9]);for(const point of points)this.oval(...point,6,6,[.75,.2,.12,1]);}
    this.canvas.dataset.bones=JSON.stringify([master,auntie].map(pose=>Object.fromEntries(['shoulder','elbow','wrist','grip'].map(n=>[n,pose[n].map(x=>Math.round(x*100)/100)]))));
   }
   return{take:this.view(...p.grip),spin:umbrella.center,progress:s.progress};
 }
 seaFoam(x,y,amount,opacity=1,scale=1){
   if(amount<.002||opacity<.002)return;
   const t=this.quiet?0:this.clock,alpha=amount*opacity;
   this.oval(x-45*scale,y+8*scale,(90+amount*240)*scale,35*scale,[.9,.96,.89,alpha*.3],6);
   this.oval(x-25*scale,y+3*scale,(85+amount*110)*scale,(12+amount*16)*scale,[.95,.97,.89,alpha*.6],6);
   for(let i=0;i<38;i++){
     const age=(t*.13+i*.173)%1,r=(3+age*19+(i%4)*2)*scale;
     const cx=x-(age*(140+amount*190)+Math.sin(i*7)*24)*scale;
     const cy=y+(Math.sin(i*3.7)*24+age*30)*scale;
     const a=alpha*(1-age)*(.6+(i%3)*.16);
     for(let j=0;j<16;j++){
       const at=k=>{const angle=k/16*TAU,rough=1+Math.sin(angle*3+i)*.09;return[cx+Math.cos(angle)*r*rough,cy+Math.sin(angle)*r*.32*rough];};
       this.line(at(j),at(j+1),(.8+(i%3)*.25)*scale,[.95,.98,.89,a]);
     }
   }
 }
 sceneSea(state){
   const s=state.voyage,focus=clamp(this.seaFocus.value),travel=s.progress;
   const fade=1-focus,detail=clamp((focus-.28)/.72),t=this.quiet?0:this.clock;
   // Matched wide and close paintings maintain scale without stretching waves.
   const bg={sheet:frames.voyageSea.sheet,rect:[1672*.05*focus,941*.22*focus,1672*(1-.1*focus),941*(1-.25*focus)]};
   this.rect(bg,0,0,1440,810,[1,1,1,1],11);
   this.rect(frames.voyageWater,0,0,1440,810,[1,1,1,focus],11);
   const visibleWidth=this.seaWidth??1440,compact=visibleWidth<1050;
   const cx=(compact?720:660)+travel*(compact?70:440),base=(compact?630:715)-travel*196+waveAt(660,t)*(1-s.calm*.65);
   const w=Math.min(900,visibleWidth*.94)*(1-travel*.53),h=w*2/3,lean=this.quiet?0:Math.sin(t*.68)*.007*(1-s.calm*.65),c=Math.cos(lean),sn=Math.sin(lean);
   const boatMap=(u,v)=>{const x=(u-.5)*w,y=(v-1)*h;return this.view(cx+x*c-y*sn,base+x*sn+y*c);};
   // Characters, clothes, hands, oar, umbrella and boat share ONE rigid image.
   this.oval(cx,base-18,w*.82,32,[.08,.19,.23,fade*.23]);
   this.quad(frames.voyageTravelers,boatMap,[1,1,1,fade]);
   const wideSoap=boatMap(voyageArt.wideSoap[0]/1536,voyageArt.wideSoap[1]/1024);
   this.seaFoam(cx-w*.45,base-19,s.foam,fade*.8,w/900);
   // Wake follows the whole hull; no separate rowing animation is used.
   if(travel>0)for(let i=0;i<9;i++){
     const age=(t*.09+i*.119)%1,x=cx-w*.32-age*(100+travel*180);
     this.oval(x,base-7+age*19,45+age*140,7+age*9,[.87,.94,.87,fade*(1-age)*.22],6);
   }
   for(let i=0;i<13;i++){
     const ft=this.fishClock,flow=(ft*(24+i%4*9)+i*137)%1050;
     const x=150+flow,y=530+(i%4)*52+Math.sin(ft*1.3+i)*17+s.calm*45;
     const size=60+i%3*19,a=detail*(.53-s.calm*.36),tail=Math.sin(ft*5+i)*6;
     const edge=[[.5,0],[.3,-.1],[-.1,-.15],[-.37,-.05],[-.37,.05],[-.1,.15],[.3,.1]];
     for(let j=0;j<edge.length;j++)this.triangle('white',[[x,y],[x+edge[j][0]*size,y+edge[j][1]*size],[x+edge[(j+1)%edge.length][0]*size,y+edge[(j+1)%edge.length][1]*size]],[[0,0],[1,0],[1,1]],[.055,.14,.17,a]);
     this.triangle('white',[[x-size*.32,y],[x-size*.66,y-9+tail],[x-size*.66,y+9+tail]],[[0,0],[1,0],[1,1]],[.055,.14,.17,a*.8]);
     this.oval(x,y,size*.8,13,[.06,.16,.19,a*.35]);
   }
   const pose=swordPose(state.soapDepth,Math.min(990,720+visibleWidth*.22)),scale=Math.min(voyageArt.closeScale,visibleWidth/900);
   this.oval(pose.tip[0]-6,SEA_WATERLINE+5,110,24,[.04,.12,.16,detail*(pose.inWater?.08:.23)]);
   const sx=pose.tip[0]-voyageArt.closeSoap[0]*scale,sy=pose.tip[1]-voyageArt.closeSoap[1]*scale;
   this.rect(frames.voyageSword,sx,sy,1536*scale,1024*scale,[1,1,1,detail],12);
   this.seaFoam(pose.tip[0],SEA_WATERLINE,s.foam,detail,1.25);
   if(s.dipping&&detail>.8)for(let i=0;i<4;i++){
     const radius=8+((t*.34+i*.25)%1)*75,a=1-(radius-8)/75;
     for(let j=0;j<30;j++){
       const point=k=>[pose.tip[0]+Math.cos(k/30*TAU)*radius,SEA_WATERLINE+Math.sin(k/30*TAU)*radius*.23];
       this.line(point(j),point(j+1),1,[.94,.97,.9,a*.37]);
     }
   }
   this.metrics={seaFocus:focus,soapWet:pose.inWater,seaTravel:travel};
   return{approach:wideSoap,soap:pose.tip,focus,progress:s.progress};
 }
 scenePrince(state){
   const view=perspective(clamp(this.observerSpring.value)),backgroundScale=1+view.scale*.2;
   this.rect(frames.shore,870*(1-backgroundScale),490*(1-backgroundScale),1440*backgroundScale,810*backgroundScale,[1,1,1,1],5);
   const anchor=[870,675],scale=view.scale;
   this.body('tree',anchor[0]-190-120*scale,anchor[1],view.treeHeight,{lockHeight:true,cloak:true});
   const ground=this.view(anchor[0],anchor[1]);this.oval(ground[0],ground[1]+3,65*this.zoom,10*this.zoom,[.16,.23,.23,.14]);
   const guard=this.body('captain',anchor[0]+145+170*scale,anchor[1],view.guardHeight,{lockHeight:true}),prince=this.body('prince',anchor[0],anchor[1],view.princeHeight,{lockHeight:true,cloak:true});
   this.metrics={princeHeight:prince.bounds.height,ordinaryHeight:guard.bounds.height};
   return{progress:state.observation.complete?1:state.observation.sawNear ? .6+(1-state.observation.position)*.35 : state.observation.position*.6};
 }
 render(scene,state,dt,pointer,quiet=false){
   this.clock=state.clock;this.quiet=quiet;this.vertexCount=0;this.metrics={};this.currentTexture=null;
   if(scene!==this.lastScene){this.openSpring={value:1,velocity:0};this.observerSpring={value:state.observation.position,velocity:0};this.seaFocus={value:state.voyage.phase==='dipping'?1:0,velocity:0};this.fishClock=0;this.lastScene=scene;}
   if(scene===1){
     if(state.voyage.phase==='waiting')this.seaFocus={value:0,velocity:0};
     this.seaFocus=sampleSpring(this.seaFocus,state.voyage.phase==='dipping'?1:0,dt,10,7);
     this.fishClock+=dt*(1-state.voyage.calm*.94);
   }
   const zoomTarget=scene===0?1.025+(state.umbrella.phase==='passing'?Math.sin(state.umbrella.transfer*Math.PI)*.055:0):scene===2?1.2:1.025;
   this.zoomSpring=sampleSpring(this.zoomSpring,zoomTarget,dt,36,13);this.zoom=scene===0?this.zoomSpring.value:zoomTarget;
   this.cameraX=sampleSpring(this.cameraX,quiet?0:pointer[0]*5,dt,24,10);this.cameraY=sampleSpring(this.cameraY,quiet?0:pointer[1]*3,dt,24,10);
   this.observerSpring=sampleSpring(this.observerSpring,state.observation.position,dt,40,14);
   const target=state.umbrella.phase==='handoff'||state.umbrella.phase==='passing'?1:state.umbrella.open;this.openSpring=sampleSpring(this.openSpring,target,dt);
   const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.uniform2f(this.resolution,1440,810);gl.uniform1f(this.time,this.quiet?0:this.clock);gl.uniform1f(this.danger,scene===0?state.umbrella.danger:0);gl.uniform1f(this.calm,scene===1?state.voyage.calm:0);gl.clearColor(.945,.933,.898,1);gl.clear(gl.COLOR_BUFFER_BIT);
   const result=scene===0?this.sceneUmbrella(state):scene===1?this.sceneSea(state):this.scenePrince(state);this.flush();
   Object.assign(this.canvas.dataset,{vertices:String(this.vertexCount),heldError:this.metrics.heldError?.toFixed(4)||'',jointError:this.metrics.jointError?.toFixed(6)||'',wristFlex:this.metrics.wristFlex?.toFixed(4)||'',owner:this.metrics.owner||'',gripSeparation:this.metrics.gripSeparation?.toFixed(3)||'',viewPosition:this.observerSpring.value.toFixed(4),princeHeight:this.metrics.princeHeight?.toFixed(4)||'',ordinaryHeight:this.metrics.ordinaryHeight?.toFixed(4)||'',seaFocus:this.metrics.seaFocus?.toFixed(4)||'',soapWet:String(this.metrics.soapWet??''),seaTravel:this.metrics.seaTravel?.toFixed(4)||''});return result;
 }
}
