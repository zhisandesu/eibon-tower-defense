import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=path.resolve(process.argv[2]||'dist/wallpaper');
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const input=source.slice(source.indexOf('  function getPoint('),source.indexOf("  window.addEventListener('keydown',",source.indexOf('  function getPoint(')));
const pause=source.slice(source.indexOf('  window.EibonWallpaper.onPause='),source.indexOf('  function animate(',source.indexOf('  window.EibonWallpaper.onPause=')));
const clickGuard=source.slice(source.indexOf('  const dragClickTimes='),source.indexOf('  try{const value=JSON.parse',source.indexOf('  const dragClickTimes=')));
class Target{
  listeners=new Map();hidden=true;style={};textContent='';captures=0;
  classList={add(){},remove(){},toggle(){}};
  addEventListener(name,cb){const list=this.listeners.get(name)||[];list.push(cb);this.listeners.set(name,list);}
  emit(name,props={}){const event={type:name,button:0,buttons:1,which:1,detail:1,clientX:60,clientY:850,timeStamp:100,pointerId:1,pointerType:'mouse',preventDefault(){this.defaultPrevented=true;},...props};for(const cb of this.listeners.get(name)||[])cb(event);return event;}
  getBoundingClientRect(){return {left:0,top:0,width:1440,height:900};}
  getContext(){return {};}
  focus(){}
  setPointerCapture(){this.captures++;throw new Error('Host does not support capture');}
  hasPointerCapture(){return false;}
}
function fixture(){
  const win=new Target(),doc=new Target(),elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,new Target());return elements.get(id);};
  const ghost=element('#drag-ghost');ghost.querySelector=s=>element('#drag-ghost '+s);
  const c={console,EibonLayout:{point:(x,y)=>({x,y})},document:doc,addEventListener:win.addEventListener.bind(win),$:element,canvas:element('#game'),W:1440,H:900,cameraOffset:{x:0,y:0},selected:null,shovel:false,dragging:null,hover:null,menuOpen:false,last:0,keyboardCell:{},portrait(){},describe(){},updateSelection(){},updateHUD(){},handleEvents(){},playSound(){},showToast(message){c.lastToast=message;},stopVoice(){},music:{pause(){}},fadingMusic:[],menuVideo:{pause(){}},syncMusic(){},syncMenuVideo(){},px:x=>x,mid:x=>x};
  c.window=c;vm.createContext(c);
  for(const file of ['engine.js','expansion.js','board-layout.js','wallpaper-host.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  c.UNITS=c.EibonTD.UNITS;
  c.game=new c.EibonTD.Game({mode:'sandbox',deck:c.EibonTD.DEFAULT_DECK,seed:617});c.game.start();c.game.spawns=[];c.game.money=5000;
  c.projection=c.EibonBoardProjection({width:1440,height:900});
  c.choose=kind=>{if(!c.UNITS[kind].utility&&!c.game.deck.includes(kind))return;c.selected=kind;c.shovel=false;};
  vm.runInContext(clickGuard+'\n'+input+'\n'+pause,c);
  const card=element('#test-card');c.bindDragStart(card,'chiz');
  assert.ok(source.includes("bindDragStart(button,k);button.addEventListener('click',ev=>{if(isReleasedDragClick(ev,button))return;describe(k);});"));
  card.addEventListener('click',ev=>{if(!c.isReleasedDragClick(ev,card))c.describe('chiz');});
  const point=c.projection.point(2.5,2.5);
  const at={clientX:point.x,clientY:point.y};
  return {c,win,doc,card,ghost,at,element};
}
const checks=[];const check=(name,test)=>{test();checks.push(name);};
function mouseStart(f){f.card.emit('mousedown');assert.ok(f.c.dragging);}
function mouseDrop(f){f.win.emit('mousemove',f.at);f.win.emit('mouseup',{...f.at,buttons:0,which:0,timeStamp:220});}
const unitCount=f=>f.c.game.units.filter(u=>u.kind==='chiz').length;

check('Mouse-only host starts and places exactly once without PointerEvent/capture',()=>{const f=fixture();mouseStart(f);mouseDrop(f);assert.equal(unitCount(f),1);assert.equal(f.card.captures,0);assert.equal(f.c.dragging,null);});
check('Modern pointer + compatibility mouse events do not double-place',()=>{const f=fixture();f.card.emit('pointerdown');assert.equal(f.c.dragging,null);mouseStart(f);f.win.emit('pointermove',f.at);f.win.emit('mousemove',f.at);f.win.emit('pointerup',{...f.at,buttons:0,which:0});f.win.emit('mouseup',{...f.at,buttons:0,which:0});assert.equal(unitCount(f),1);});
check('Mouse capture-loss/cancellation signals do not destroy mouse drag',()=>{const f=fixture();mouseStart(f);f.element('#cards').emit('lostpointercapture');f.win.emit('pointercancel');mouseDrop(f);assert.equal(unitCount(f),1);});
check('False/duplicate host playback notifications preserve held drag',()=>{const f=fixture();mouseStart(f);f.c.wallpaperPropertyListener.setPaused(false);f.c.EibonWallpaper.onPause(false);f.c.wallpaperPropertyListener.setPaused(false);assert.ok(f.c.dragging);mouseDrop(f);assert.equal(unitCount(f),1);});
check('Real host pause cancels drag and never auto-resumes the battle',()=>{const f=fixture();mouseStart(f);f.c.wallpaperPropertyListener.setPaused(true);assert.equal(f.c.dragging,null);assert.equal(f.c.game.phase,'paused');f.c.wallpaperPropertyListener.setPaused(false);assert.equal(f.c.game.phase,'paused');mouseDrop(f);assert.equal(unitCount(f),0);});
check('Transient focus transfer resumes movement until actual release',()=>{const f=fixture();mouseStart(f);f.win.emit('blur');assert.ok(f.c.dragging.suspended);assert.ok(f.ghost.hidden);mouseDrop(f);assert.equal(unitCount(f),1);});
check('Release during lost focus cannot place an unseen ghost',()=>{const f=fixture();mouseStart(f);f.win.emit('mousemove',f.at);f.win.emit('blur');f.win.emit('mouseup',{...f.at,buttons:0,which:0});assert.equal(unitCount(f),0);assert.equal(f.c.dragging,null);});
check('Zero buttons and which during a held gesture do not cancel placement',()=>{const f=fixture();f.card.emit('mousedown',{buttons:0,which:0});assert.ok(f.c.dragging);f.win.emit('mousemove',{...f.at,buttons:0,which:0});assert.ok(f.c.dragging);assert.equal(f.ghost.hidden,false);assert.equal(unitCount(f),0);f.win.emit('mouseup',{...f.at,buttons:0,which:0});assert.equal(unitCount(f),1);assert.equal(f.c.selected,null);});
check('Leaving the window cancels placement before returning',()=>{const f=fixture();mouseStart(f);f.win.emit('mousemove',f.at);f.doc.emit('mouseleave');assert.equal(f.c.dragging,null);f.win.emit('mousemove',f.at);f.win.emit('mouseup',f.at);assert.equal(unitCount(f),0);});
check('Click a card then click a tile never selects or deploys',()=>{const f=fixture();mouseStart(f);f.win.emit('mouseup',{buttons:0,which:0});f.card.emit('click');assert.equal(f.c.selected,null);assert.equal(f.c.dragging,null);assert.equal(f.ghost.hidden,true);f.c.canvas.emit('mousedown',f.at);assert.equal(unitCount(f),0);assert.equal(f.c.selected,null);});
check('Release click after drag cannot re-arm a card',()=>{const f=fixture();mouseStart(f);mouseDrop(f);f.card.emit('click',{timeStamp:300});assert.equal(f.c.selected,null);f.c.canvas.emit('mousedown',{clientX:f.at.clientX+100,clientY:f.at.clientY});assert.equal(unitCount(f),1);});
check('Release outside board does not spend money or retain selection',()=>{const f=fixture();const money=f.c.game.money;mouseStart(f);f.win.emit('mousemove',{clientX:10,clientY:10});f.win.emit('mouseup',{clientX:10,clientY:10,buttons:0,which:0});assert.equal(f.c.game.money,money);assert.equal(unitCount(f),0);assert.equal(f.c.selected,null);});
check('Right mouse button cannot start a drag or place a selected unit',()=>{const f=fixture();f.card.emit('mousedown',{button:2});assert.equal(f.c.dragging,null);f.c.choose('chiz');f.c.canvas.emit('mousedown',{...f.at,button:2});assert.equal(unitCount(f),0);});
check('Insufficient funds and cooldown still reject pickup',()=>{const f=fixture();f.c.game.money=0;f.card.emit('mousedown');assert.equal(f.c.dragging,null);assert.match(f.c.lastToast,/方斯不够/);f.c.game.money=5000;f.c.game.cooldowns.chiz=4;f.card.emit('mousedown');assert.equal(f.c.dragging,null);assert.match(f.c.lastToast,/准备中/);});
check('Touch still works when pointer capture throws',()=>{const f=fixture();const t={pointerId:7,pointerType:'touch'};f.card.emit('pointerdown',t);f.win.emit('pointermove',{...f.at,...t});f.win.emit('pointerup',{...f.at,...t,buttons:0,which:0});assert.equal(unitCount(f),1);assert.equal(f.card.captures,1);});
check('Unrelated pointer cancellation cannot cancel active touch',()=>{const f=fixture();f.card.emit('pointerdown',{pointerId:7,pointerType:'touch'});f.win.emit('pointercancel',{pointerId:8,pointerType:'touch'});assert.ok(f.c.dragging);f.win.emit('pointercancel',{pointerId:7,pointerType:'touch'});assert.equal(f.c.dragging,null);});
check('Water platform supports the same mouse path',()=>{const f=fixture();const jelly=f.element('#jelly-test');f.c.bindDragStart(jelly,'jelly');jelly.emit('mousedown');mouseDrop(f);assert.equal(f.c.dragging,null);assert.ok(f.c.game.platformAt(2,2));});

const report={passed:true,scope:'Actual release input handlers + actual game placement/economy, simulated DOM events; not native Wallpaper Engine verification',checks};
fs.writeFileSync(root+'-input-tests.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
