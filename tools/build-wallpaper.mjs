import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {PNG} from 'pngjs';
const source=path.resolve('game'),dest=path.resolve(process.argv[2]||'dist/wallpaper');
if(dest===source||dest.startsWith(source+path.sep))throw Error('Use a separate output folder');
await fs.mkdir(dest,{recursive:true});await fs.cp(source,dest,{recursive:true});
const context={};context.window=context;vm.createContext(context);
for(const file of ['atlas','expansion-atlas','engine','expansion','evolution','v2-atlas','encounter-atlas'])vm.runInContext(await fs.readFile(path.join(source,file+'.js'),'utf8'),context);
await fs.mkdir(path.join(dest,'assets/offline-enemies'),{recursive:true});await fs.mkdir(path.join(dest,'assets/offline-units'),{recursive:true});
const decoded=new Map();
for(const [folder,defs]of [['offline-enemies',context.EibonTD.ENEMIES],['offline-units',context.EibonTD.UNITS]])for(const [kind,d]of Object.entries(defs)){
 const sheet=d.sheet||(folder==='offline-enemies'?'enemies':null),f=context.ATLAS_META[sheet]?.frames[d.row]?.[0];if(!f)continue;
 if(!decoded.has(sheet))decoded.set(sheet,PNG.sync.read(await fs.readFile(path.join(source,'assets/'+sheet+'.png'))));
 const image=decoded.get(sheet),tile=new PNG({width:f.w,height:f.h});
 for(let y=0;y<f.h;y++)image.data.copy(tile.data,y*f.w*4,((f.y+y)*image.width+f.x)*4,((f.y+y)*image.width+f.x+f.w)*4);
 if(f.clip){const keep=new Map(f.clip.map(([y,x1,x2])=>[y,[x1,x2]]));for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++)if(!keep.has(y)||x<keep.get(y)[0]||x>=keep.get(y)[1])tile.data[(y*f.w+x)*4+3]=0;}
 await fs.writeFile(path.join(dest,'assets/'+folder+'/'+kind+'.png'),PNG.sync.write(tile));
}
decoded.clear();
let game=(await fs.readFile(path.join(dest,'game.js'),'utf8')).replaceAll('\r\n','\n');
const replace=(from,to)=>{if(!game.includes(from))throw Error('Wallpaper adaptation anchor changed: '+from.slice(0,80));game=game.replace(from,to);};
replace("img.crossOrigin='anonymous';",'');
let start=game.indexOf('  function enemyPortrait(kind){'),end=game.indexOf('  function renderBossCounters(',start);if(start<0||end<0)throw Error('Portrait function changed');
game=game.slice(0,start)+"  function enemyPortrait(kind){return ENEMIES[kind]?'assets/offline-enemies/'+kind+'.png':'';}\n"+game.slice(end);
replace("extraPortraitURLs.set(kind,c.toDataURL('image/png'));","extraPortraitURLs.set(kind,'assets/offline-units/'+kind+'.png');");
start=game.indexOf('  function drawHeroShadow(source){');end=game.indexOf('  function showHero(kind){',start);
if(start<0||end<0)throw Error('Hero shadow changed');game=game.slice(0,start)+"  function drawHeroShadow(source){const target=$('#deck-hero-shadow');target.getContext('2d').clearRect(0,0,target.width,target.height);}\n"+game.slice(end);
replace('  function renderEnemyIntel(){',"  function renderEnemyIntel(){\n    window.EibonWallpaper.syncBossChoice?.();");
replace('    if(!audioEnabled)return;','    if(!audioEnabled||window.EibonWallpaper.paused)return;');
replace('menuVideoVisible=menuOpen&&','menuVideoVisible=!window.EibonWallpaper.paused&&menuOpen&&');
replace("if(!audioEnabled||(!menuOpen&&game.phase!=='running'))","if(window.EibonWallpaper.paused||!audioEnabled||(!menuOpen&&game.phase!=='running'))");
replace('    if(last&&now-last<1000/60-.5)','    if(window.EibonWallpaper.paused){last=now;requestAnimationFrame(animate);return;}\n    if(last&&now-last<1000/window.EibonWallpaper.fps-.5)');
replace('  function animate(now){',`  window.EibonWallpaper.onPause=paused=>{last=0;if(paused){cancelDrag();if(game.phase==='running')game.pause();stopVoice();music?.pause();for(const track of fadingMusic)track.pause();menuVideo.pause();}updateHUD();syncMusic();syncMenuVideo();};\n  function animate(now){`);
// Preserve the mouse-only adapter verified in the installed desktop host.
replace('ev.timeStamp-releasedAt<100','ev.timeStamp-releasedAt<500');
replace("button.addEventListener('pointerdown',ev=>beginDrag(ev,k,button));","bindDragStart(button,k);");
replace('  function beginDrag(ev,kind,button){',`  function mouseInput(ev){return {button:ev.button,pointerId:'mouse',pointerType:'mouse',clientX:ev.clientX,clientY:ev.clientY,timeStamp:ev.timeStamp,preventDefault:()=>ev.preventDefault()};}
  function isMousePointer(ev){return !ev.pointerType||ev.pointerType==='mouse';}
  function bindDragStart(button,kind){button.addEventListener('mousedown',ev=>{if(ev.button===0&&dragging?.pointerType==='mouse')cancelDrag();beginDrag(mouseInput(ev),kind,button);});button.addEventListener('pointerdown',ev=>{if(!isMousePointer(ev))beginDrag(ev,kind,button);});}
  function beginDrag(ev,kind,button){`);
replace('dragging={kind,id:ev.pointerId,button,startX:ev.clientX,startY:ev.clientY,moved:false};','dragging={kind,id:ev.pointerId,pointerType:ev.pointerType,button,startX:ev.clientX,startY:ev.clientY,moved:false,suspended:false};');
replace('try{button.setPointerCapture(ev.pointerId);}catch{}',"if(ev.pointerType!=='mouse')try{button.setPointerCapture(ev.pointerId);}catch{}");
replace('  function moveDrag(ev){if(!dragging||ev.pointerId!==dragging.id)return;',"  function moveDrag(ev){if(!dragging||ev.pointerId!==dragging.id)return;dragging.suspended=false;$('#drag-ghost').hidden=false;");
replace("const {button,id}=dragging;dragging=null;button.classList.remove('dragging');try{if(button.hasPointerCapture(id))button.releasePointerCapture(id);}catch{}","const {button,id,pointerType}=dragging;dragging=null;button.classList.remove('dragging');if(pointerType!=='mouse')try{if(button.hasPointerCapture(id))button.releasePointerCapture(id);}catch{}");
start=game.indexOf("  window.addEventListener('pointermove',moveDrag);");end=game.indexOf("  window.addEventListener('keydown',",start);
const oldBlock=game.slice(start,end);
let press=oldBlock.slice(oldBlock.indexOf("  canvas.addEventListener('pointerdown',ev=>{"),oldBlock.lastIndexOf('  });')+5);
press=press.replace("canvas.addEventListener('pointerdown',ev=>{","function boardPress(ev){").replace("    if(menuOpen||","    if(ev.button!==0||menuOpen||").replace(/\s*\}\);\s*$/,'\n  }');
game=game.slice(0,start)+`  function endDrag(ev){if(!dragging||ev.pointerId!==dragging.id)return;if(dragging.suspended){cancelDrag();return;}const cell=getCell(getPoint(ev)),moved=dragging.moved;if(moved)dragClickTimes.set(dragging.button,ev.timeStamp);if(moved&&cell)actAtCell(cell);else if(moved)playSound('cancel');cancelDrag();}
  window.addEventListener('mousemove',ev=>moveDrag(mouseInput(ev)));
  window.addEventListener('mouseup',ev=>{if(ev.button===0)endDrag(mouseInput(ev));});
  window.addEventListener('pointermove',ev=>{if(!isMousePointer(ev))moveDrag(ev);});
  window.addEventListener('pointerup',ev=>{if(!isMousePointer(ev))endDrag(ev);});
  window.addEventListener('pointercancel',ev=>{if(dragging?.pointerType!=='mouse'&&ev.pointerId===dragging?.id)cancelDrag();});
  window.addEventListener('blur',()=>{if(!dragging)return;if(dragging.pointerType!=='mouse'){cancelDrag();return;}dragging.suspended=true;hover=null;$('#drag-ghost').hidden=true;});
  document.addEventListener('mouseleave',()=>{if(dragging?.pointerType==='mouse')cancelDrag();});
  document.addEventListener('mousedown',ev=>{if(shovel&&ev.target instanceof Element&&ev.target!==canvas&&!ev.target.closest('#shovel-button')){shovel=false;hover=null;updateSelection();}},{capture:true});
  $('#cards').addEventListener('lostpointercapture',ev=>{if(dragging?.pointerType!=='mouse'&&ev.pointerId===dragging?.id)cancelDrag();});
  function boardHover(ev){if(!dragging)hover=shovel||selected?getCell(getPoint(ev)):null;}
  canvas.addEventListener('mousemove',boardHover);canvas.addEventListener('pointermove',ev=>{if(!isMousePointer(ev))boardHover(ev);});canvas.addEventListener('mouseleave',()=>{if(!dragging)hover=null;});
`+press+`
  canvas.addEventListener('mousedown',boardPress);canvas.addEventListener('pointerdown',ev=>{if(!isMousePointer(ev))boardPress(ev);});
`+game.slice(end);
if(game.includes("$('#jelly-button').addEventListener('pointerdown'"))replace("$('#jelly-button').addEventListener('pointerdown',ev=>beginDrag(ev,'jelly',$('#jelly-button')));","bindDragStart($('#jelly-button'),'jelly');");
await fs.writeFile(path.join(dest,'game.js'),game);
let loading=await fs.readFile(path.join(dest,'loading.js'),'utf8');start=loading.indexOf('      const response = await fetch(');end=loading.indexOf('      await new Promise(',start);if(start<0||end<0)throw Error('Loader changed');loading=loading.slice(0,start)+loading.slice(end);loading=loading.replace('video.src = movieUrl;','video.src = video.dataset.src;').replaceAll('请检查网络后重试','请检查壁纸文件是否完整后重试');await fs.writeFile(path.join(dest,'loading.js'),loading);
const video='assets/atrium-v1/menu-loop-20261001.webm';
if(process.env.EIBON_CACHED_WEBM)await fs.copyFile(process.env.EIBON_CACHED_WEBM,path.join(dest,video));
else{if(!process.env.EIBON_FFMPEG)throw Error('Set EIBON_FFMPEG to create the wallpaper video');execFileSync(process.env.EIBON_FFMPEG,['-y','-v','error','-i',path.join(source,'assets/atrium-v1/menu-loop-20261001.mp4'),'-an','-vf','scale=1920:1080,fps=30','-c:v','libvpx-vp9','-crf','28','-b:v','0','-deadline','good','-cpu-used','4','-row-mt','1','-threads','4',path.join(dest,video)],{stdio:'inherit'});}
await fs.unlink(path.join(dest,'assets/atrium-v1/menu-loop-20261001.mp4'));
let html=(await fs.readFile(path.join(dest,'play.html'),'utf8')).replaceAll('assets/atrium-v1/menu-loop-20261001.mp4',video).replace('</head>','<script src="wallpaper-host.js"></script><link rel="stylesheet" href="wallpaper-host.css">\n</head>');await fs.writeFile(path.join(dest,'index.html'),html);await fs.unlink(path.join(dest,'play.html'));
await fs.copyFile('wallpaper/wallpaper-host.js',path.join(dest,'wallpaper-host.js'));await fs.copyFile('wallpaper/wallpaper-host.css',path.join(dest,'wallpaper-host.css'));
await fs.copyFile(path.join(source,'assets/game-icon-v02-180.png'),path.join(dest,'preview.png'));
await fs.writeFile(path.join(dest,'project.json'),JSON.stringify({title:'异象大战伊波恩',description:'v3.0 · 异环非官方同人塔防。33关主线、无尽加班、随机传送与自由试验。Boss技能频率、角色三叠、鲸鱼海洋与铲子交互更新。离线游玩，自动保存通关记录。',file:'index.html',preview:'preview.png',type:'web',version:1,visibility:'public',contentrating:'Everyone',tags:['Game','Anime']},null,2)+'\n');
await fs.writeFile(path.join(dest,'使用说明.txt'),'异象大战伊波恩 v3.0 · Wallpaper Engine\n\n解压后在壁纸编辑器导入 index.html，开启鼠标交互。角色卡拖动部署；铲子可连续撤回，点击空格、其他区域或再次点击铲子收起。壁纸暂停时战斗同步暂停，回来后点击继续值班。\n更新已有工坊作品时保留原项目的工坊编号，在编辑器提交更新。此压缩包是可导入的壁纸项目，本机更新与公开工坊发布是不同步骤。\n异环非官方同人作品，详见 NOTICE.md。\n');
await fs.copyFile('NOTICE.md',path.join(dest,'NOTICE.md'));
console.log(JSON.stringify({wallpaper:dest,version:'3.0.0'}));
