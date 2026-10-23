import {angleDelta,createUmbrella,takeUmbrella,turnUmbrella,stepUmbrella,createVoyage,inspectWater,stepVoyage,createObservation,moveObserver} from './model.mjs';
import {swordPose,SEA_DIP_TRAVEL} from './motion.mjs';
import {LivingPainting} from './painting.mjs';

const $=id=>document.getElementById(id);
const sceneInfo=[
 {id:'umbrella',title:'接过黑伞',label:'第一片段 · 黑伞',role:'宽姨',copy:'空灵递来黑伞。伸手接住，别让它停。',hint:'沿伞面绕圈拖动 · 空格也可维持旋转'},
 {id:'sea',title:'饕餮海',label:'第二片段 · 饕餮海',role:'露珠',copy:'让剑尖的香皂碰到海水。',hint:'向下拖动香皂 · 观察鱼群与泡沫'},
 {id:'prince',title:'远近之间',label:'第三片段 · 深水王子',role:'长帆',copy:'走近一些，再退回来看看。',hint:'拖动视点 · 或用方向键移动'},
];
const state={scene:0,reading:false,paused:false,clock:0,sceneAge:0,
 umbrella:createUmbrella(),voyage:createVoyage(),observation:createObservation(),
 spinHolding:false,soapHolding:false,soapDepth:0,walkDirection:0,turning:null,soapDrag:null,pointer:[0,0]};
let painting,layout={scale:1,x:0,y:0,baseX:0},needsRender=true,toastTimer,lastStatus='',lastPhase='';
const quiet=matchMedia('(prefers-reduced-motion: reduce)').matches;
const inspectRig=new URLSearchParams(location.search).has('rig');

function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,2100);}
function bookmark(){try{const raw=localStorage.getItem('ytm-storybook-bookmark');if(raw===null)return null;const n=Number(raw);return Number.isInteger(n)&&n>=0&&n<3?n:null;}catch{return null;}}
function status(text){if(text!==lastStatus){lastStatus=text;$('story-status').textContent=text;$('live-caption').classList.remove('caption-enter');void $('live-caption').offsetWidth;$('live-caption').classList.add('caption-enter');}}
function positionStage(){
 layout.x=layout.baseX;
 $('stage-inner').style.transform='translate('+layout.x+'px,'+layout.y+'px) scale('+layout.scale+')';
}
function fitStage(){
 const r=$('stage').getBoundingClientRect(),mobile=r.width<=760;
 if(state.scene===0){
  layout.scale=r.width<600?r.width/600:Math.min(r.height*.9/810,r.width/900);
  layout.baseX=r.width/2-800*layout.scale;
  layout.y=r.height*.44-405*layout.scale;positionStage();needsRender=true;return;
 }
 if(state.scene===1){
  layout.scale=r.width/r.height<1.25?r.height/810:Math.min(r.width/1440,r.height/810);
  layout.baseX=r.width/2-720*layout.scale;
  layout.y=(r.height-810*layout.scale)/2;
  if(painting)painting.seaWidth=r.width/layout.scale;
  document.body.dataset.seaHeader=layout.y>28?'paper':'ink';
  document.body.dataset.seaCaption=layout.y+810*layout.scale<r.height*.88?'paper':'ink';
  positionStage();needsRender=true;return;
 }
 const closeFrame=mobile||r.width/r.height<1.4;
 layout.scale=closeFrame?Math.min(r.height/810,r.width/(mobile?780:1050)):Math.min(r.width/1440,r.height/810);
 layout.baseX=closeFrame?r.width/2-850*layout.scale:(r.width-1440*layout.scale)/2;
 layout.y=mobile?r.height*.44-405*layout.scale:(r.height-810*layout.scale)/2;
 positionStage();
 needsRender=true;
}
new ResizeObserver(fitStage).observe($('stage'));
function targetAt(element,point,w=70,h=44){
 element.style.left=(layout.x+point[0]*layout.scale)+'px';element.style.top=(layout.y+point[1]*layout.scale)+'px';
 if(element.id==='spin-target'){element.style.width=Math.max(135,w*layout.scale)+'px';element.style.height=Math.max(90,h*layout.scale)+'px';}
 if(element.id==='soap-target'){element.style.width=Math.max(80,180*layout.scale)+'px';element.style.height=Math.max(70,150*layout.scale)+'px';}
}
function canDip(){return state.scene===1&&state.voyage.phase==='dipping'&&(painting?.metrics.seaFocus??0)>.96&&!state.paused;}
function clearInputs(){state.spinHolding=state.soapHolding=false;state.walkDirection=0;state.turning=state.soapDrag=null;for(const id of ['spin-assist','dip-assist'])$(id).dataset.holding='false';$('stage').dataset.dragging='false';}
function pause(value){state.paused=value;clearInputs();$('pause-overlay').hidden=!value;$('pause-toggle').setAttribute('aria-pressed',String(value));$('pause-toggle').setAttribute('aria-label',value?'继续故事':'暂停故事');needsRender=true;if(!value&&state.reading)$('stage').focus({preventScroll:true});}
function enterScene(){
 clearInputs();state.sceneAge=0;lastStatus='';lastPhase='';
 const info=sceneInfo[state.scene];document.body.dataset.scene=info.id;$('stage').dataset.scene=info.id;
 $('role').textContent='你是'+info.role;$('scene-title').textContent=info.title;$('chapter-label').textContent=info.label;
 $('story-copy').textContent=info.copy;$('interaction-hint').textContent=info.hint;
 $('page-count').textContent=String(state.scene+1).padStart(2,'0')+' / 03';$('previous').disabled=state.scene===0;
 $('walk-control').hidden=state.scene!==2;$('observer-position').value=Math.round(state.observation.position*100);
 $('contents').hidden=true;$('contents-toggle').setAttribute('aria-expanded','false');
 $('bookmark').setAttribute('aria-pressed',String(bookmark()===state.scene));needsRender=true;fitStage();render(0);$('stage').focus({preventScroll:true});
}
function start(scene=0){state.reading=true;state.scene=scene;$('cover').hidden=true;$('reader').hidden=false;pause(false);enterScene();}
function reset(){
 if(state.scene===0)state.umbrella=createUmbrella();
 if(state.scene===1){state.voyage=createVoyage();state.soapDepth=0;}
 if(state.scene===2)state.observation=createObservation();pause(false);enterScene();
}
function complete(){return state.scene===0?state.umbrella.phase==='complete':state.scene===1?state.voyage.phase==='complete':state.observation.complete;}

class Sound{
 enabled=false;
 async toggle(){
  if(!this.context){
   const Context=window.AudioContext||window.webkitAudioContext;if(!Context){toast('这个浏览器暂不能播放声音');return;}
   this.context=new Context();this.volume=this.context.createGain();this.volume.gain.value=0;this.volume.connect(this.context.destination);
   const buffer=this.context.createBuffer(1,this.context.sampleRate*2,this.context.sampleRate),samples=buffer.getChannelData(0);let previous=0;
   for(let i=0;i<samples.length;i++)samples[i]=previous=(previous+(Math.random()*2-1)*.035)/1.045;
   const source=this.context.createBufferSource();source.buffer=buffer;source.loop=true;
   this.filter=this.context.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=700;
   source.connect(this.filter).connect(this.volume);source.start();
  }
  this.enabled=!this.enabled;await this.context.resume();$('sound-toggle').setAttribute('aria-pressed',String(this.enabled));$('sound-toggle').setAttribute('aria-label',this.enabled?'关闭声音':'开启声音');
 }
 update(){
  if(!this.context)return;
  const active=this.enabled&&state.reading&&!state.paused,turn=state.scene===0?state.umbrella.speed/14:.35;
  this.volume.gain.setTargetAtTime(active?.03+turn*.035:0,this.context.currentTime,.12);
  this.filter.frequency.setTargetAtTime(350+turn*1100,this.context.currentTime,.1);
 }
}
const sound=new Sound();

function render(dt){
 if(!painting||!state.reading)return;
 positionStage();
 const result=painting.render(state.scene,state,dt,state.pointer,quiet);
 const s=state.umbrella,phase=state.scene===0?s.phase:state.scene===1?state.voyage.phase:state.observation.complete?'complete':'active';
 $('stage').dataset.phase=phase;$('stage').dataset.open=s.open.toFixed(3);$('stage').dataset.foam=state.voyage.foam.toFixed(3);
 $('stage').dataset.age=state.sceneAge.toFixed(3);$('stage').dataset.transfer=s.transfer.toFixed(3);
 $('stage').dataset.seaFocus=(result.focus??0).toFixed(3);
 document.body.dataset.seaShot=state.scene===1&&(result.focus??0)>.5?'detail':'wide';
 $('take-umbrella').hidden=state.scene!==0||phase!=='handoff'||state.paused;
 $('spin-target').hidden=state.scene!==0||phase!=='active'||state.paused;
 $('approach-water').hidden=state.scene!==1||phase!=='waiting'||state.paused;
 $('soap-target').hidden=!canDip();
 $('spin-assist').hidden=state.scene!==0||phase!=='active';
 $('dip-assist').hidden=!canDip();
 $('retry-scene').hidden=phase!=='failed';
 $('narrative').classList.toggle('settled',state.sceneAge>7&&phase!=='handoff');
 if(result.take)targetAt($('take-umbrella'),result.take);
 if(result.approach)targetAt($('approach-water'),result.approach);
 if(result.spin)targetAt($('spin-target'),result.spin,290,170);
 if(result.soap){targetAt($('soap-target'),result.soap);$('soap-target').dataset.wet=String(swordPose(state.soapDepth).inWater);}
 if(state.scene===0){
  if(phase==='handoff')status('空灵握着黑伞，等你伸出手。');
  else if(phase==='passing')status(s.transfer<.67?'宽姨托住伞柄，空灵的手还没有离开。':'握稳之后，他才慢慢收回手。');
  else if(phase==='failed')status('伞沿合拢了。再握住它。');
  else if(phase==='complete')status('空灵收回了手。黑伞仍在转动。');
  else if(s.danger>.14||s.open<.55)status('伞沿在往下落……继续转。');
  else status('沿伞面绕圈，让黑伞继续转着。');
 }else if(state.scene===1){
  if(phase==='waiting')status('露珠握住长剑。剑尖上，挑着一小块香皂。');
  else if(phase==='complete')status('小舟渐渐靠近墓岛。泡沫留在了身后。');
  else if(phase==='departing')status(state.voyage.progress>.45?'黑伞撑在头顶。身后的海，留下一道白痕。':'鱼影沉入泡沫下，小舟有了去路。');
  else if(result.focus<.9)status('她把剑探出船舷，俯向海面。');
  else if(state.voyage.calm>.94)status('再留一会儿……海面渐渐安静了。');
  else if(state.voyage.foam>.45)status('白沫向四周漂开。鱼群慢了下来。');
  else if(state.voyage.foam>.05)status('一缕白沫散开。鱼影仍在靠近。');
  else status('把剑尖放低一些，让香皂碰到海水。');
 }else{
  $('observer-position').setAttribute('aria-valuetext',state.observation.position>.85?'近处':state.observation.position<.15?'远处':'正在靠近');
  if(complete())status('退远以后，他仍在眼中保持同样大小。');
  else if(state.observation.sawNear)status('近看是常人。再回头看一眼。');
  else status('树和旁人渐渐变大了。王子呢？');
 }
 if(lastPhase!==phase){$('live-caption').dataset.phase=phase;lastPhase=phase;}
 $('book-progress-fill').style.width=((state.scene+result.progress)/3*100)+'%';
 $('next').disabled=!complete();
 $('next').hidden=state.scene===1&&!complete();
 const nextLabel=state.scene===0?'继续旅程':state.scene===2?'合上这一卷':'继续故事';
 if($('next').dataset.label!==nextLabel){$('next').dataset.label=nextLabel;$('next').innerHTML=nextLabel+' <svg><use href="#i-next"/></svg>';}
 sound.update();needsRender=false;
}
$('begin').disabled=true;$('begin').firstChild.textContent='展开画卷 ';
LivingPainting.create($('painting')).then(value=>{painting=value;painting.debug=inspectRig;$('begin').disabled=false;$('begin').firstChild.textContent='开始试读 ';document.body.dataset.ready='true';}).catch(error=>{console.error(error);$('begin').textContent='画卷未能展开，请刷新';});
$('begin').addEventListener('click',()=>start(0));
$('resume-bookmark').hidden=bookmark()===null;$('resume-bookmark').addEventListener('click',()=>start(bookmark()??0));
$('home').addEventListener('click',()=>{state.reading=false;clearInputs();$('reader').hidden=true;$('cover').hidden=false;$('contents').hidden=true;document.body.dataset.scene='cover';$('resume-bookmark').hidden=bookmark()===null;sound.update();});
$('take-umbrella').addEventListener('click',()=>{takeUmbrella(state.umbrella);needsRender=true;});
$('take-umbrella').addEventListener('pointerdown',e=>{e.preventDefault();takeUmbrella(state.umbrella);needsRender=true;});
$('approach-water').addEventListener('click',()=>{inspectWater(state.voyage);$('stage').focus({preventScroll:true});needsRender=true;});
$('retry-scene').addEventListener('click',reset);$('replay').addEventListener('click',reset);
$('previous').addEventListener('click',()=>{if(state.scene>0){state.scene--;enterScene();}});
$('next').addEventListener('click',()=>{if(!complete())return;if(state.scene<2){state.scene++;enterScene();}else{pause(true);$('ending').showModal();}});
$('contents-toggle').addEventListener('click',()=>{$('contents').hidden=!$('contents').hidden;$('contents-toggle').setAttribute('aria-expanded',String(!$('contents').hidden));});
$('close-contents').addEventListener('click',()=>{$('contents').hidden=true;$('contents-toggle').setAttribute('aria-expanded','false');});
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>{state.scene=Number(button.dataset.go);pause(false);enterScene();}));
$('bookmark').addEventListener('click',()=>{try{localStorage.setItem('ytm-storybook-bookmark',state.scene);$('bookmark').setAttribute('aria-pressed','true');toast('这一段，替你记住了');}catch{toast('浏览器未允许保存书签');}});
$('pause-toggle').addEventListener('click',()=>pause(!state.paused));$('resume').addEventListener('click',()=>pause(false));
$('sound-toggle').addEventListener('click',()=>sound.toggle());
$('ending-replay').addEventListener('click',()=>{$('ending').close();state.umbrella=createUmbrella();state.voyage=createVoyage();state.observation=createObservation();state.soapDepth=0;start(0);});
$('ending-close').addEventListener('click',()=>{$('ending').close();pause(false);});$('ending').addEventListener('cancel',()=>pause(false));

function hold(id,key){
 const b=$(id),release=()=>{state[key]=false;b.dataset.holding='false';};
 b.addEventListener('pointerdown',e=>{if(state.paused||(key==='soapHolding'&&!canDip()))return;e.preventDefault();b.setPointerCapture(e.pointerId);state[key]=true;b.dataset.holding='true';});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,release);
}
hold('spin-assist','spinHolding');hold('dip-assist','soapHolding');
$('spin-target').addEventListener('pointerdown',e=>{
 if(state.paused||state.umbrella.phase!=='active')return;e.preventDefault();$('spin-target').setPointerCapture(e.pointerId);
 const r=$('spin-target').getBoundingClientRect();state.turning={angle:Math.atan2(e.clientY-r.y-r.height/2,e.clientX-r.x-r.width/2),time:e.timeStamp};$('stage').dataset.dragging='true';
});
$('spin-target').addEventListener('pointermove',e=>{
 if(!state.turning||state.paused)return;const r=$('spin-target').getBoundingClientRect(),angle=Math.atan2(e.clientY-r.y-r.height/2,e.clientX-r.x-r.width/2);
 turnUmbrella(state.umbrella,angleDelta(state.turning.angle,angle),(e.timeStamp-state.turning.time)/1000);state.turning={angle,time:e.timeStamp};
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('spin-target').addEventListener(event,()=>{state.turning=null;$('stage').dataset.dragging='false';});
$('soap-target').addEventListener('pointerdown',e=>{if(!canDip())return;e.preventDefault();$('soap-target').setPointerCapture(e.pointerId);state.soapDrag={y:e.clientY,depth:state.soapDepth};});
$('soap-target').addEventListener('pointermove',e=>{if(state.soapDrag&&canDip())state.soapDepth=Math.max(0,Math.min(1,state.soapDrag.depth+(e.clientY-state.soapDrag.y)/(SEA_DIP_TRAVEL*layout.scale)));});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('soap-target').addEventListener(event,()=>{state.soapDrag=null;});
$('stage').addEventListener('pointermove',e=>{if(state.paused)return;const r=$('stage').getBoundingClientRect();state.pointer=[(e.clientX-r.left)/r.width*2-1,(e.clientY-r.top)/r.height*2-1];});
$('stage').addEventListener('pointerleave',()=>{if(!state.paused)state.pointer=[0,0];});
$('observer-position').addEventListener('input',()=>{if(!state.paused)moveObserver(state.observation,Number($('observer-position').value)/100);});
$('walk-near').addEventListener('click',()=>{if(!state.paused){moveObserver(state.observation,state.observation.position+.2);$('observer-position').value=state.observation.position*100;}});
$('walk-away').addEventListener('click',()=>{if(!state.paused){moveObserver(state.observation,state.observation.position-.2);$('observer-position').value=state.observation.position*100;}});
document.addEventListener('keydown',e=>{
 if(!state.reading||state.paused||$('ending').open)return;
 if(e.code==='Space'){
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if(e.target.closest('button')&&!['spin-assist','dip-assist','spin-target','soap-target'].includes(e.target.id))return;
  e.preventDefault();if(state.scene===0)state.spinHolding=true;if(canDip())state.soapHolding=true;
 }
 if(state.scene===2&&!['INPUT','BUTTON'].includes(e.target.tagName)&&['ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();state.walkDirection=e.code==='ArrowRight'?1:-1;}
 if(e.code==='Escape'){$('contents').hidden=true;$('contents-toggle').setAttribute('aria-expanded','false');}
});
document.addEventListener('keyup',e=>{if(e.code==='Space')state.spinHolding=state.soapHolding=false;if(['ArrowLeft','ArrowRight'].includes(e.code))state.walkDirection=0;});
window.addEventListener('blur',()=>{if(state.reading&&!$('ending').open)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.reading)pause(true);});

let previous=performance.now(),frameCount=0,measureFrom=previous;
function tick(now){
 if(now-previous<1000/60){requestAnimationFrame(tick);return;}
 const dt=Math.min(.05,Math.max(0,(now-previous)/1000))*(inspectRig?.25:1);previous=now;
 if(state.reading&&!state.paused){
  state.clock+=dt;state.sceneAge+=dt;
  if(state.scene===0){if(state.spinHolding)turnUmbrella(state.umbrella,5.3*dt,dt);stepUmbrella(state.umbrella,dt);}
  else if(state.scene===1){
   if(canDip()&&state.soapHolding)state.soapDepth=Math.min(1,state.soapDepth+dt*1.6);
   else if(!state.soapDrag||!canDip())state.soapDepth=Math.max(0,state.soapDepth-dt*1.4);
   stepVoyage(state.voyage,dt,canDip()&&swordPose(state.soapDepth).inWater);
   if(state.voyage.phase!=='dipping'){state.soapHolding=false;state.soapDrag=null;}
  }
  else if(state.walkDirection){moveObserver(state.observation,state.observation.position+state.walkDirection*dt*.4);$('observer-position').value=state.observation.position*100;}
  render(dt);frameCount++;
  if(now-measureFrom>1500){$('painting').dataset.fps=(frameCount*1000/(now-measureFrom)).toFixed(1);frameCount=0;measureFrom=now;}
 }else{if(needsRender&&state.reading)render(0);sound.update();frameCount=0;measureFrom=now;}
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

