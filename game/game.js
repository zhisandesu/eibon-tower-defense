/* Original playable prototype; generated raster artwork is kept in assets/. */
(() => {
  'use strict';
  const {Game,UNITS,ORDER,ENEMIES,CAMPAIGN,normalizeProgress,migrateProgress,rewardsFor,unlockedRoster:baseUnlockedRoster,completeCampaign,ATTRIBUTES,REACTIONS,BOSS_ORDER,DEFAULT_DECK,BOSS_MOTION,BOSS_THREAT,ENDLESS_CYCLE_WAVES,BOARD_ROWS,BOARD_COLS} = window.EibonTD;
  let meta=window.EibonTD.normalizeMeta();
  try{meta=window.EibonTD.normalizeMeta(JSON.parse(localStorage.getItem('eibon.meta.v1')||'null'));}catch{}
  let demoUnlocked=false;
  try{demoUnlocked=JSON.parse(localStorage.getItem('eibon.demo.v1')||'null')?.unlockCampaign===true;}catch{}
  const unlockedRoster=value=>demoUnlocked?ORDER.slice():baseUnlockedRoster(value,meta);
  function saveMeta(value){meta=window.EibonTD.normalizeMeta(value);try{localStorage.setItem('eibon.meta.v1',JSON.stringify(meta));}catch{showToast('存款暂时无法保存，本次打开期间仍可使用。');}refreshGuideHealth();}
  const SAVE_KEY='eibon.campaign.v2';
  let progress={cleared:0},saveAvailable=true;
  try{const saved=localStorage.getItem(SAVE_KEY);progress=saved?normalizeProgress(JSON.parse(saved)):migrateProgress(JSON.parse(localStorage.getItem('eibon.campaign.v1')||'null'));}catch{saveAvailable=false;}
  const $=s=>document.querySelector(s), canvas=$('#game');
  const illustratedAvatar=kind=>(window.EibonTD.NEW_HERO_KEYS?.includes(kind)?'assets/pop-ui-v2/avatars/':'assets/atrium-v1/avatars/')+kind+'.png';
  let ctx=canvas.getContext('2d');
  // Browser image dragging must not steal the game's pointer-based deployment.
  // Capture also covers avatars and icons inserted after this handler is installed.
  document.addEventListener('dragstart',event=>{
    if(event.target instanceof Element&&event.target.closest('#menu,img,video,.unit-card,.tool-card,.deck-card,.deck-slot'))event.preventDefault();
  },true);
  const W=1440,B={x:W*.185,y:128,w:W*.70,h:455};
  let H=720,CW=B.w/BOARD_COLS,CH=CW,projection,denseRendering=false;
  function fitBattlefield(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    H=W*r.height/r.width;
    // Drawing and input share this transform across desktop and rotated phone layouts.
    projection=window.EibonBoardProjection({width:W,height:H,cols:BOARD_COLS,rows:BOARD_ROWS});
    Object.assign(B,projection.bounds);CW=projection.cellWidth;CH=projection.cellHeight;
    // Bound the battlefield backing store; UI text remains at the browser's native DPR.
    const pixelRatio=Math.min(2,devicePixelRatio||1,Math.sqrt((denseRendering?1166400:2073600)/(r.width*r.height)));
    canvas.width=Math.round(r.width*pixelRatio);canvas.height=Math.round(r.height*pixelRatio);
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
  }
  new ResizeObserver(fitBattlefield).observe($('#stage'));
  window.addEventListener('resize',fitBattlefield);
  const images={}, cardNodes={}, atlas=window.ATLAS_META, spriteCache={};
  let shovelPointer=null;
  let game=new Game(),selected=null,shovel=false,speed=1,hover=null,keyboardCell={lane:2,col:2},dragging=null,bossBannerUntil=0;
  let ready=false,menuOpen=true,guidePaused=false,last=0,realTime=0,toastTimer=0,hudTimer=0,currentMode='day';
  let lastPaintKey='',lastPaintGame=null,calmFrames=0;
  let pendingShift=null,deckSelection=[],lastBoss=null,savedDeck=DEFAULT_DECK,deckFilter='all',heroKind='requiem';
  const dragClickTimes=new WeakMap();
  function isReleasedDragClick(ev,button){
    const releasedAt=dragClickTimes.get(button);dragClickTimes.delete(button);
    return ev.detail>0&&releasedAt!==undefined&&ev.timeStamp-releasedAt>=0&&ev.timeStamp-releasedAt<100;
  }
  try{const value=JSON.parse(localStorage.getItem('eibon.deck.v1')||'null');if(Array.isArray(value))savedDeck=value.filter(k=>ORDER.includes(k)).slice(0,10);}catch{}
  let preferences={};
  try{preferences=JSON.parse(localStorage.getItem('eibon.preferences.v1')||'{}')||{};}catch{}
  // Start with animation and sound enabled; keep the player's saved opt-outs.
  let reducedMotion=preferences.reducedMotion===true;
  let musicLevel=Number.isFinite(preferences.musicLevel)?Math.max(0,Math.min(1,preferences.musicLevel)):.35;
  if(preferences.musicLevelVersion!==2&&musicLevel===.25)musicLevel=.35;
  document.body.classList.toggle('reduce-motion',reducedMotion);
  const menuVideo=$('#menu-video');let menuVideoVisible=false,menuVideoBlocked=false,menuVideoPending=false;
  menuVideo.muted=true;
  function syncMenuVideo(){
    if(window.EibonLoading&&!window.EibonLoading.videoReady)return;
    menuVideoVisible=menuOpen&&!$('#menu').hidden&&!document.hidden&&!reducedMotion;
    menuVideo.hidden=!menuVideoVisible||menuVideoBlocked;
    if(!menuVideoVisible){if(!menuVideo.paused)menuVideo.pause();return;}
    if(menuVideo.paused&&!menuVideoBlocked&&!menuVideoPending){
      menuVideoPending=true;
      menuVideo.play().catch(error=>{
        if(error.name!=='AbortError'){menuVideoBlocked=true;menuVideo.hidden=true;}
      }).finally(()=>{menuVideoPending=false;});
    }
  }
  menuVideo.addEventListener('error',()=>{menuVideoBlocked=true;menuVideo.hidden=true;});
  document.addEventListener('visibilitychange',syncMenuVideo);
  let audioEnabled=preferences.audioEnabled!==false,voiceAt=-100,voice=null,voiceTimer=null,music=null,musicPath='',musicBlocked=false,musicPending=false;
  const fadingMusic=[];
  const audioPools={},sfxLast={},activeSounds=new Set(),musicManifest=window.EIBON_MUSIC||{},bossMusicManifest=window.EIBON_BOSS_MUSIC||{};
  const playSound=(type,kind)=>{
    if(!audioEnabled)return;
    const voicePath=(window.EIBON_AUDIO_MANIFEST||{})[kind?kind+'.'+type:type];
    if(voicePath&&realTime-voiceAt>4){
      voiceAt=realTime;if(voice)voice.pause();voice=new Audio(voicePath);voice.volume=.7;voice.play().catch(()=>{});
    }
    const key=type==='attack'?kind:type==='bossSkill'?(['foreman','rider','arachne'].includes(kind)?'slam':'summon'):type==='remove'?'shovelUse':type;
    const path=(window.EIBON_SFX||{})[key];if(!path)return;
    const now=performance.now()/1000,gap=['hit','hurt','kill'].includes(key)?.13:type==='attack'?.085:.06;
    if(now-(sfxLast[key]??-10)<gap)return;sfxLast[key]=now;
    if(activeSounds.size>=9&&['hit','hurt','kill',...ORDER].includes(key))return;
    const pool=audioPools[key]||(audioPools[key]=[]);let sound=pool.find(a=>a.paused||a.ended);
    if(!sound){if(pool.length>=3)return;sound=new Audio(path);sound.preload='auto';sound.onended=()=>activeSounds.delete(sound);pool.push(sound);}
    sound.currentTime=0;sound.volume=['hit','hurt','kill'].includes(key)?.22:type==='attack'?.38:.55;
    activeSounds.add(sound);sound.play().catch(()=>activeSounds.delete(sound));
  };
  function stopVoice(){if(voice){voice.pause();voice=null;}clearTimeout(voiceTimer);for(const a of activeSounds)a.pause();activeSounds.clear();}
  function syncMusic(){
    const boss=game.enemies.find(e=>ENEMIES[e.kind].boss&&e.hp>0);
    const key=menuOpen?'menu':boss?'boss':game.endless?'endless':'day';
    const path=(!menuOpen&&boss?bossMusicManifest[boss.kind]:null)||musicManifest[key]||(!menuOpen?musicManifest.day:'');
    if(!audioEnabled||(!menuOpen&&game.phase!=='running')){music?.pause();for(const old of fadingMusic)old.pause();fadingMusic.length=0;return;}
    if(!path){music?.pause();return;}
    if(path!==musicPath){if(music&&!music.paused)fadingMusic.push(music);music=new Audio(path);music.loop=true;music.volume=0;musicPath=path;musicBlocked=false;musicPending=false;}
    if(music.paused&&!musicBlocked&&!musicPending){const track=music;musicPending=true;track.play().catch(()=>{if(track===music)musicBlocked=true;}).finally(()=>{if(track===music)musicPending=false;});}
  }
  function fadeMusic(dt){
    if(music&&!music.paused){const target=voice&&!voice.paused?musicLevel*.4:musicLevel;music.volume=Math.max(0,Math.min(1,music.volume+Math.sign(target-music.volume)*Math.min(Math.abs(target-music.volume),dt*.42)));}
    for(let i=fadingMusic.length-1;i>=0;i--){const old=fadingMusic[i];old.volume=Math.max(0,old.volume-dt*.55);if(!old.volume){old.pause();fadingMusic.splice(i,1);}}
  }
  function unlockMusic(){musicBlocked=false;syncMusic();if(menuVideoBlocked&&menuOpen){menuVideoBlocked=false;menuVideoVisible=false;syncMenuVideo();}}
  window.addEventListener('pointerdown',unlockMusic,{capture:true});window.addEventListener('keydown',unlockMusic,{capture:true});window.addEventListener('click',unlockMusic,{capture:true});
  function rounded(c,x,y,w,h,r,fill,stroke,lw=1){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
  function text(c,content,x,y,size=15,color='#2b3939',align='center',weight=700){c.font=`${weight} ${size}px "Microsoft YaHei",sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(content,x,y);}
  const spriteVariants=new WeakMap(),spriteFilters={frozen:'saturate(.3) sepia(.25) hue-rotate(130deg)',healed:'brightness(1.12)',hurt:'brightness(1.4)',sleep:'saturate(.5) brightness(.85)',cast:'brightness(0)'};
  function variantSprite(source,variant){
    if(!variant)return source;
    let variants=spriteVariants.get(source);if(!variants){variants={};spriteVariants.set(source,variants);}
    if(!variants[variant]){const tile=document.createElement('canvas');tile.width=source.width;tile.height=source.height;const c=tile.getContext('2d');c.filter=spriteFilters[variant];c.drawImage(source,0,0);variants[variant]=tile;renderStats.spriteVariantBuilds++;}
    return variants[variant];
  }
  function sprite(c,sheet,row,frame,x,feet,h,alpha=1,rotation=0,variant=null){
    const source=spriteCache[sheet]?.[row]?.[frame],meta=atlas[sheet];if(!source||!meta)return;
    const img=variantSprite(source,variant);
    const f=meta.frames[row][frame],scale=h/meta.baseHeights[row];
    c.save();c.globalAlpha=alpha;c.translate(x,feet);c.rotate(rotation);
    c.drawImage(img,-f.anchorX*scale,-(f.groundY??f.anchorY)*scale,f.w*scale,f.h*scale);c.restore();
  }
  function prepareSprites(){
    for(const [sheet,meta] of Object.entries(atlas)){
      if(!images[sheet])continue;
      spriteCache[sheet]=meta.frames.map(row=>row.map(f=>{
        const tile=document.createElement('canvas');tile.width=f.w;tile.height=f.h;const c=tile.getContext('2d');
        c.save();if(f.clip){c.beginPath();for(const [y,x1,x2] of f.clip)c.rect(x1,y,x2-x1,1);c.clip();}
        c.drawImage(images[sheet],f.x,f.y,f.w,f.h,0,0,f.w,f.h);c.restore();return tile;
      }));
    }
    // Prepare the crowd-wide effect before combat, avoiding a spike on time-stop entry.
    const enemyRows=new Set(Object.values(ENEMIES).map(d=>`${d.sheet||'enemies'}:${d.row}`));
    for(const key of enemyRows){const [sheet,row]=key.split(':');for(const tile of spriteCache[sheet]?.[row]||[])variantSprite(tile,'frozen');}
  }
  function portrait(c,kind,padding=4,headShot=false){
    const d=UNITS[kind],img=spriteCache[d.sheet]?.[d.row]?.[headShot&&kind==='skia'?2:0];if(!img)return;
    const w=c.canvas.width,h=c.canvas.height,sourceH=img.height*(headShot?(kind==='skia'?1:kind==='chiz'?.72:.66):1);
    const scale=(headShot?Math.max:Math.min)((w-padding*2)/img.width,(h-padding*2)/sourceH);
    c.clearRect(0,0,w,h);c.drawImage(img,0,0,img.width,sourceH,(w-img.width*scale)/2,h-padding-sourceH*scale,img.width*scale,sourceH*scale);
  }
  const extraPortraitURLs=new Map();
  function portraitURL(kind){
    if(ORDER.includes(kind))return illustratedAvatar(kind);
    const existing=cardNodes[kind]?.querySelector('.portrait')?.src;if(existing)return existing;
    if(!UNITS[kind]||!ready)return '';
    if(!extraPortraitURLs.has(kind)){const c=document.createElement('canvas');c.width=c.height=96;portrait(c.getContext('2d'),kind,6);extraPortraitURLs.set(kind,c.toDataURL('image/png'));}
    return extraPortraitURLs.get(kind);
  }
  const optionalSheets=new Map();
  function loadOptionalSheet(sheet){if(images[sheet]||optionalSheets.has(sheet)||!atlas[sheet])return;const img=new Image();optionalSheets.set(sheet,img);img.onload=()=>{images[sheet]=img;const m=atlas[sheet];spriteCache[sheet]=m.frames.map(row=>row.map(f=>{const tile=document.createElement('canvas');tile.width=f.w;tile.height=f.h;tile.getContext('2d').drawImage(img,f.x,f.y,f.w,f.h,0,0,f.w,f.h);return tile;}));};img.onerror=()=>optionalSheets.delete(sheet);img.src='assets/'+sheet+'.png';}
  function nativeUnitPose(unit){
    if(unit.hurt>0)return 3;
    if(unit.skillPoseUntil>game.time)return 2;
    if(unit.kind==='sakiri'&&unit.digest>0&&unit.anim<=.3)return 2;
    if(unit.kind==='chiz'&&unit.rank===3&&unit.anim>0&&unit.anim<.4)return 2;
    return unit.anim>0?1:0;
  }
  function isCrimsonTransformed(unit){return unit.kind==='crimson'&&unit.rank===3&&(unit.hotUntil>game.time||unit.attackFormUntil>game.time);}
  function unitArtwork(kind,unit=null){const d=UNITS[kind];let sheet=d.sheet,row=d.row;if(unit){const special=isCrimsonTransformed(unit)?'v2/hero-crimson-hot':unit.rank===3?window.EIBON_RANK3_SHEETS?.[kind]:null;if(special&&atlas[special]){loadOptionalSheet(special);if(spriteCache[special]){sheet=special;row=0;}}}return {sheet,row};}
  function unitSprite(c,kind,frame,x,y,h,alpha=1,variant=null,unit=null){const {sheet,row}=unitArtwork(kind,unit);if(unit){if(sheet.startsWith('v2/'))frame=nativeUnitPose(unit);else if(kind==='crimson'&&!isCrimsonTransformed(unit))frame=unit.hurt>0?3:unit.anim>0?1:0;}if(UNITS[kind].companion==='jelly'&&!atlas[sheet]?.mountedCompanion){const jelly=UNITS.jelly;sprite(c,jelly.sheet,jelly.row,unit?.hurt>0?3:unit?.anim>0?1:0,x+h*.6,y+h*.025,h*.52,alpha,0,variant);}sprite(c,sheet,row,frame,x,y,h,alpha,0,variant);}
  const attributeIcon=id=>`<img class="attribute-icon" src="assets/attributes/${id}.webp" alt="${ATTRIBUTES[id].name}" title="${ATTRIBUTES[id].name}属性">`;
  const px=(x,lane=2)=>projection.point(x,lane+.78).x,feet=lane=>projection.point(0,lane+.78).y,mid=lane=>projection.point(0,lane+.48).y;
  function paintArea(x1,x2,row1,row2,fill,stroke,lineWidth=1){
    const points=projection.corners(x1,x2,row1,row2);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}
  }
  function healRange(lane,col){
    const firstRow=Math.max(0,lane-1),lastRow=Math.min(BOARD_ROWS,lane+2),firstCol=Math.max(0,col-2),lastCol=Math.min(BOARD_COLS,col+3);
    paintArea(firstCol,lastCol,firstRow,lastRow,'#81b69a25','#5c9d86',1.5);
    text(ctx,'羊群定时治疗 · 三路范围',px(col+.5,lane),projection.point(0,firstRow).y+13,10,'#397b65');
  }
  function anchorRange(lane,col,rank=1,emphasized=false){
    const area=game.anchorArea({lane,col,rank});
    paintArea(area.x1,area.x2,area.laneMin,area.laneMax+1,emphasized?'#ae83d52c':'#ae83d50c',emphasized?'#926ab9':'#ae83d54d',emphasized?2:1);
    if(emphasized)text(ctx,'锚定 · '+(rank>1?'三路':'本路')+'前后两格 · 环境减伤80%'+(rank===3?' · 防禁疗':''),px(col+.5,lane),projection.point(0,area.laneMin).y+13,10,'#80579e');
  }
  function unitHeight(kind,lane=2){
    const d=UNITS[kind],meta=atlas[d.sheet],idle=meta.frames[d.row][0],base=meta.baseHeights[d.row];
    const desired=kind==='skia'?26:kind==='mintCat'?71:kind==='chiz'?88:100;
    const rowHeight=projection.point(0,lane+1).y-projection.point(0,lane).y,rowWidth=projection.point(1,lane+.78).x-projection.point(0,lane+.78).x;
    // The body reads at row scale; hair and held props may extend past a tile.
    return Math.min(desired*1.48*Math.min(1.15,rowHeight/91),(rowHeight*1.13)*base/idle.anchorY,(rowWidth*1.24)*base/Math.max(idle.anchorX,idle.w-idle.anchorX)/2);
  }
  const bossRightExtents={};
  let cameraOffset={x:0,y:0};
  function enemyHeight(e){
    const d=ENEMIES[e.kind],desired=(d.renderHeight||(d.boss?(e.kind==='whale'?185:200):e.kind==='bin'?89:82))*Math.min(1.2,CH/91);
    if(!d.boss)return desired;
    // Legacy bosses share the default enemy atlas, just like drawEnemy below.
    const meta=atlas[d.sheet||'enemies'];
    if(!bossRightExtents[e.kind])bossRightExtents[e.kind]=Math.max(...meta.frames[d.row].map(f=>(f.w-f.anchorX)/meta.baseHeights[d.row]));
    if(e.kind==='whale'){
      // One physical scale for every pose: surfacing reveals the body rather than enlarging it.
      const frames=meta.frames[d.row],base=meta.baseHeights[d.row],shore=projection.point(BOARD_COLS,3.08).x;
      const widest=Math.max(...frames.map(f=>f.w)),tallest=Math.max(...frames.map(f=>f.h));
      const coastCap=Math.max(1,W-shore-CW*.08)*base/widest;
      const actionCap=Math.min(CH*2.35,H*.32)*base/tallest;
      return Math.min(desired,coastCap,actionCap)*1.5;
    }
    return Math.max(1,Math.min(desired,Math.max(CW*.2,W-px(e.x,e.lane)-CW*.15)/bossRightExtents[e.kind]));
  }
  function enemyVisualX(e,lane=e.travelLane??e.lane){
    if(e.kind!=='whale')return px(e.x,lane);
    const h=enemyHeight(e),seaX=W-h*bossRightExtents[e.kind]-CW*.045;
    if(!e.diveTarget)return seaX;
    // Keep the same coastal anchor when the actual leap starts and ends.
    const origin=e.diveOrigin,span=Math.max(.1,origin.x-e.diveTarget.x),travel=Math.max(0,Math.min(1,(origin.x-e.x)/span));
    return px(e.x,lane)+(seaX-px(origin.x,origin.lane))*(1-travel);
  }
  function shadow(x,y,w=35,alpha=.14){
    // A broad low-opacity penumbra plus a small contact patch, anchored to feet.
    const ry=Math.max(3,Math.min(7,CH*.055));ctx.save();
    for(let i=3;i>=1;i--){ctx.fillStyle=`rgba(51,47,36,${alpha/(i===1?2:5)})`;ctx.beginPath();ctx.ellipse(x+2,y+1,w*(.65+i*.14),ry*(.55+i*.24),0,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
  function health(x,y,hp,max,shield=0,enemy=false,armor=0){
    const width=enemy?51:48;rounded(ctx,x-width/2,y,width,6,3,'#35423fd9','#f4f0d088',1);
    rounded(ctx,x-width/2+1,y+1,(width-2)*Math.max(0,Math.min(1,hp/max)),4,2,enemy?'#d7736b':'#8aba7d');
    if(shield>0||armor>0)rounded(ctx,x-width/2,y+8,width*Math.min(1,(shield||armor)/(shield?180:170)),3,2,shield?'#ead28a':'#97aab0');
  }
  let boardLayer=null,boardLayerKey='';
  function drawBoard(){
    const placing=!!(dragging||selected||shovel),waterMask=game.terrain.map(row=>row.map(t=>t.waterUntil>game.time?1:0).join('')).join('');
    const key=`${canvas.width}:${canvas.height}:${H}:${game.mode}:${placing}:${waterMask}`;
    if(!boardLayer)boardLayer=document.createElement('canvas');
    if(boardLayerKey!==key){
      boardLayer.width=canvas.width;boardLayer.height=canvas.height;
      const screenContext=ctx;ctx=boardLayer.getContext('2d');ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
      try{
        const background=images['atrium-v1/battle-shop'];
        if(background){const frame=projection.background;ctx.drawImage(background,frame.x,frame.y,frame.w,frame.h);}else{ctx.fillStyle='#ac7c74';ctx.fillRect(0,0,W,H);}
        if(game.mode==='night'){ctx.fillStyle='rgba(21,32,77,.33)';ctx.fillRect(0,0,W,H);}
        for(let lane=0;lane<BOARD_ROWS;lane++)for(let col=0;col<BOARD_COLS;col++){
          const fill=placing?((lane+col)%2?'#f2eaff10':'#fff8eb0a'):null;
          paintArea(col,col+1,lane,lane+1,fill,placing?'#f7efff85':game.isWater(lane,col)?null:'#fff5e926',placing?1.1:.6);
        }
      }finally{ctx=screenContext;}
      boardLayerKey=key;renderStats.boardBuilds++;
    }
    ctx.drawImage(boardLayer,0,0,W,H);
    for(let lane=0;lane<5;lane++)for(let col=0;col<BOARD_COLS;col++){
      const x=px(col+.5,lane),y=projection.point(0,lane).y;
      const warning=game.floodWarnings.some(w=>w.cells.some(c=>c.lane===lane&&c.col===col));
      if(warning){const a=.12+Math.sin(game.time*8)*.07;paintArea(col,col+1,lane,lane+1,`rgba(59,148,174,${a})`,'#4d90a2',2);text(ctx,'海啸',x,y+CH*.32,CH*.16,'#316779');}
    }
    for(let lane=0;lane<5;lane++){
      for(const u of game.units.filter(u=>u.kind==='iroi'&&u.hp>0&&u.healRangeUntil>game.time&&u.lane===lane))healRange(u.lane,u.col);
      for(const u of game.units.filter(u=>u.kind==='fadeya'&&u.hp>0&&u.lane===lane))anchorRange(u.lane,u.col,u.rank,u.anchorRangeUntil>game.time||selected==='fadeya');
    }
    if(hover&&(dragging||selected||shovel)&&['running','preparing'].includes(game.phase)&&!menuOpen){
      const x=px(hover.col+.5,hover.lane),y=projection.point(0,hover.lane).y;
      const err=shovel||selected==='item:cat'?null:game.canPlace(selected,hover.lane,hover.col);
      if(!shovel&&UNITS[selected]?.oneShot){const a=game.skillArea(selected,hover.lane,hover.col);paintArea(a.x1,a.x2,a.laneMin,a.laneMax+1,selected==='xun'?'#57c3d337':'#fa704a42',selected==='xun'?'#55bac5':'#e57240',2);}
      if(!shovel&&selected==='sakiri'){const start=hover.col+.5,end=Math.min(BOARD_COLS,start+UNITS.sakiri.range);paintArea(start,end,hover.lane,hover.lane+1,'#ffcf7040','#e1aa40',2);}
      if(!shovel&&selected==='iroi')healRange(hover.lane,hover.col);
      if(!shovel&&selected==='fadeya'){const existing=game.unitsAt(hover.lane,hover.col).find(u=>u.kind==='fadeya');anchorRange(hover.lane,hover.col,existing?Math.min(3,existing.rank+1):1,true);}
      paintArea(hover.col,hover.col+1,hover.lane,hover.lane+1,err?'#b0504930':shovel?'#f2cd8c35':'#e5dcff35',err?'#b96b60':shovel?'#e7c590':'#ece3ff',2);
      if(!shovel&&selected&&(!err||selected==='jelly'))unitSprite(ctx,selected==='item:cat'?'mintCat':selected,0,x,feet(hover.lane),selected==='item:cat'?CH*.7:selected==='jelly'?CH*.55:unitHeight(selected,hover.lane),.5);
      if(shovel)text(ctx,'撤回',x,mid(hover.lane),18,'#9b6b55');
    }
  }
  function frameFor(u){
    if(u.kind==='mintCat')return u.catState==='hissing'?1:u.catState==='leaping'?2:0;
    if(u.kind==='skia')return u.anim>.32?2:u.anim>0?3:0;
    if(u.oneShot)return !u.cast?1:u.lifetime>.6?2:3;
    if(u.pendingCast)return 1;
    if(u.kind==='sakiri'&&u.digest>0)return u.anim>.5?2:3;
    if(u.kind==='mint'&&u.anim>0)return u.anim>.2?2:3;
    if(u.kind==='adler'&&u.shield>0)return 2;
    if(u.anim>.5)return 1;if(u.anim>.16)return 2;if(u.anim>0)return 3;return 0;
  }
  function drawUnit(u){
    let x=px(u.x,u.lane),y=feet(u.lane);const platform=game.platformAt(u.lane,u.col),raised=platform&&!UNITS[u.kind].ground;
    const h=unitHeight(u.kind,u.lane)*(raised?.8:1);if(raised)y-=CH*.2;
    if(u.kind==='mintCat'&&u.catState==='leaping'){const target=game.enemies.find(e=>e.id===u.catTarget);if(target){const t=1-Math.max(0,u.catTimer)/.42;x=px(u.x+(target.x-u.x)*t,u.lane);y-=Math.sin(t*Math.PI)*CH*.65+t*CH*.75;}}
    ctx.save();const variant=u.hurt>0?'hurt':u.sleepUntil>game.time?'sleep':null;
    const born=u.born||0,landing=born/.45,breath=Math.sin(game.time*2.4+u.id)*.014;
    const sx=1+(born>0?Math.sin((1-landing)*Math.PI*2)*.12:breath),sy=1-(born>0?Math.sin((1-landing)*Math.PI*2)*.10:breath);
    if(u.anim>0){const p=Math.max(0,Math.min(1,u.anim/.7));if(u.kind==='daffodil')x+=Math.sin(p*Math.PI)*CW*.12;if(u.kind==='nanally')y-=Math.sin(p*Math.PI)*CH*.09;if(u.kind==='haiyue')y+=Math.sin(p*Math.PI)*CH*.025;}
    if(u.kind!=='skia'){
      // The short cast and contact patch begin at the rendered foot pivot.
      ctx.save();ctx.translate(x,y);ctx.transform(1,.015,-.45,-.19,0,0);ctx.filter='blur(1px)';unitSprite(ctx,u.kind,frameFor(u),0,0,h,.19,'cast',u);ctx.restore();
      shadow(x,y+.3,u.kind==='chiz'?29:22,.24);
    }
    ctx.translate(x,y);ctx.scale(sx,sy);
    if(u.confusedUntil>game.time)ctx.scale(-1,1);unitSprite(ctx,u.kind,frameFor(u),u.anim>0?Math.sin(u.anim*8)*2:0,u.kind==='skia'?0:-landing*22,h,1,variant,u);ctx.restore();
    if(u.pendingCast?.kind==='wind')sprite(ctx,'combat-fx',0,0,x+CW*.4,y-CH*.12,CH*.45,.7);
    if(u.shieldFlash>0)sprite(ctx,'combat-fx',3,2,x,y+CH*.04,CH*1.1,u.shieldFlash/.28);
    if(!u.oneShot)health(x,y-h-11,u.hp,u.maxHp,u.shield);
    window.EibonEvolutionUI?.drawUnitMarks(ctx,game,u,x,y,h);
    if(u.expiresAt)text(ctx,`地刺 ${Math.max(0,Math.ceil(u.expiresAt-game.time))}s`,x,y+11,9,'#64556c');
    if(u.kind==='daffodil'&&u.duelStacks)text(ctx,`连斩 · 攻速 +${Math.round(u.duelStacks*UNITS.daffodil.comboStep*100)}%`,x,y-h-24,10,'#756bc0');
    if(!window.EibonEvolutionUI&&u.confusedUntil>game.time)text(ctx,'惑音 ↶',x,y-h-22,11,'#986ca3');
    if(!window.EibonEvolutionUI&&u.sleepUntil>game.time){text(ctx,`Zz · 沉睡 ${(u.sleepUntil-game.time).toFixed(1)}s`,x,y-h-37,11,'#665396');}
    for(const boss of game.enemies)if(boss.hp>0&&boss.debtMark?.targetId===u.id){
      paintArea(u.col,u.col+1,u.lane,u.lane+1,'#bd679b35','#f6b1e1',2);
      rounded(ctx,x-68,y-h-57,136,22,5,'#652b59ed','#f5b6df');text(ctx,`追债 ${boss.debtMark.remaining.toFixed(1)}s · 可撤回`,x,y-h-46,11,'#fff0fc');
    }
    if(u.digest>0){
      rounded(ctx,x-29,y+5,58,15,6,'#fff3d9e8','#b49b77',1);
      text(ctx,`消化 ${Math.ceil(u.digest)}s`,x,y+12,9,'#846045');
    }
  }
  function whaleAirborne(e){return !!e.diveTarget&&((e.diveLift||0)>.001||Math.abs(e.x-(e.diveOrigin?.x??e.x))>.01||e.diveReturning>0);}
  function nativeBossPose(e){
    if(e.kind==='whale')return whaleAirborne(e)?2:e.hurt>0?3:0;
    if(e.hurt>0)return 3;
    if(e.motion==='skill'&&e.motionUntil>game.time)return 2;
    return e.windup>0||e.normalCast||e.motionUntil>game.time?1:0;
  }
  const bossBodyBounds=new Map();
  function keepBossBodyVisible(sheet,row,pose,h,x,y,rotation,gait){
    const meta=atlas[sheet],f=meta.frames[row][pose],scale=h/meta.baseHeights[row],cos=Math.cos(rotation),sin=Math.sin(rotation);
    const corners=[[0,0],[f.w,0],[f.w,f.h],[0,f.h]].map(([cx,cy])=>{
      const lx=(cx-f.anchorX)*scale,ly=(cy-f.anchorY)*scale;
      return {x:(lx*cos-ly*sin)*gait.sx,y:(lx*sin+ly*cos)*gait.sy};
    });
    const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y));
    // Keep the complete action silhouette below the persistent HUD, including airborne poses.
    const topLimit=Math.max(75,Math.min(H*.18,CH*1.2)),padding=12;
    x=Math.max(padding-left-cameraOffset.x,Math.min(W-padding-right-cameraOffset.x,x));
    y=Math.max(topLimit-top-cameraOffset.y,Math.min(H-padding-bottom-cameraOffset.y,y));
    return {x,y,left:x+left+cameraOffset.x,right:x+right+cameraOffset.x,top:y+top+cameraOffset.y,bottom:y+bottom+cameraOffset.y,width:W,height:H,topLimit};
  }
  function bossLocomotion(e){
    if(reducedMotion)return {dx:0,dy:0,rotation:0,sx:1,sy:1};
    const amount=e.travelBlend||0,phase=e.travelPhase||0,lean=e.travelLean||0;
    const floating=['whale','blackBook','bird','butterfly','musicKing'].includes(e.kind),riding=e.kind==='rider';
    return {dx:Math.sin(phase)*CW*(floating?.018:.03)*amount,
      dy:-Math.abs(Math.sin(phase))*CH*(riding?.035:floating?.09:.055)*amount,
      rotation:lean*(riding?.075:.045)+Math.sin(phase)*amount*(floating?.025:.012),
      sx:1+Math.sin(phase*2)*amount*(riding?.007:.018),sy:1-Math.sin(phase*2)*amount*(riding?.009:.022)};
  }
  function drawEnemy(e){
    if(ENEMIES[e.kind].loot){const x=px(e.x,e.lane),y=feet(e.lane);sprite(ctx,'v2/moneybag',0,e.hurt>0?3:0,x,y,CH*.6);text(ctx,'钱袋 '+(e.bagValue||0),x,y-CH*.65,10,'#9c7744');health(x,y-CH*.57,e.hp,e.maxHp,e.energyShield||0,true);return;}
    if(ENEMIES[e.kind].illusion){const x=px(e.x,e.lane),y=feet(e.lane),h=Math.min(CH*1.35,150);sprite(ctx,'boss-expansion-b',0,0,x,y,h,.42);text(ctx,'蝶影 · 无影',x,y-h-15,11,'#d2b1f1');health(x,y-h-3,e.hp,e.maxHp);return;}
    const shift=e.troopShift,t=shift?Math.min(1,Math.max(0,(game.time-shift.started)/shift.duration)):1;
    const d=ENEMIES[e.kind],visualLane=d.boss?(e.travelLane??e.lane):shift?shift.from+(shift.to-shift.from)*t:e.lane,x=enemyVisualX(e,visualLane)+(d.boss?0:Math.pow(e.enter||0,2)*35),y=feet(visualLane)+(d.boss?CH*.3:0),h=enemyHeight(e);
    const frozen=!game.isBossControlProtected?.(e)&&(game.isLaneFrozen(e.travelLane??e.lane)||e.stunUntil>game.time),frame=e.hurt>.04||e.stunUntil>game.time?3:e.windup>0?1:e.anim>0||e.kind==='whale'&&!e.submerged?2:frozen?0:d.boss?0:Math.floor(game.time*4+e.id)%2;
    const bob=game.phase==='running'&&!frozen?Math.sin(game.time*7+e.id)*(d.boss?.6:1.8):0;
    let sheet=d.sheet||'enemies',row=d.row,pose=frame,rotation=e.hurt>0?Math.sin(e.hurt*70)*.035:frozen?0:Math.sin(game.time*4+e.id)*.012,dx=0,dy=bob;
    const motion=BOSS_MOTION[e.kind];
    if(motion&&!frozen&&e.hurt<.08){
      // Keep the canonical body sheet in every state; attack artwork is a separate layer.
      if(e.phaseUntil>game.time){pose=2;dy-=CH*.04;}
      else if(e.windup>0){pose=1;rotation=-.035*Math.sin((1-e.windup/e.windupTotal)*Math.PI);}
      else if(e.motionUntil>game.time&&e.motion==='skill'){pose=2;dx=-CW*.08*Math.sin(Math.min(1,(e.motionUntil-game.time))*Math.PI);}
      else if(e.normalCast){pose=1;rotation=.035;}
      else if(e.motionUntil>game.time&&e.motion==='normal'){pose=2;dx=-CW*.065;}
      else if(e.summonUntil>game.time){pose=1;}
    }
    if(e.hitUntil>game.time){const hit=(e.hitUntil-game.time)/.26;rotation+=(e.hitKind==='wind'?.13:.045)*Math.sin(hit*Math.PI);dx+=Math.sin(hit*Math.PI)*CW*.06;}
    const gait=d.boss?bossLocomotion(e):{dx:0,dy:0,rotation:0,sx:1,sy:1};
    dx+=gait.dx;dy+=gait.dy;rotation+=gait.rotation;
    if(e.kind==='whale'&&e.diveTarget){dy-=(e.diveLift||0)*CH;rotation+=(e.diveReturning>0?.08:-.1)*Math.min(1,e.diveLift||0);}
    if(e.kind==='bird'&&e.birdSwoop){dy-=(e.swoopLift||0)*CH;rotation+=(e.birdSwoop.returning>0?.18:-.24)*Math.min(1,(e.swoopLift||0)*2);pose=1;}
    if(e.kind==='whale'&&e.entryUntil>game.time){const entry=Math.max(0,Math.min(1,(game.time-e.entryStarted)/(e.entryUntil-e.entryStarted)));dx+=(1-entry)*CW*2.2;dy+=(1-entry)*CH*.6;}
    if(sheet.startsWith('v2/')&&d.boss)pose=nativeBossPose(e);
    if(e.mobCast||e.mobChannel||e.mobFollowUp||e.mobRushRemaining>0||e.mobSkillUntil>game.time)pose=e.hurt>0?3:frozen?0:2;
    const under=!d.boss&&game.isSubmerged(e);
    const whaleAtSurface=e.kind==='whale'&&!whaleAirborne(e);
    let bodyX=x+dx,bodyY=y+dy+(under?h*.26:whaleAtSurface?h*.24:0),surfaceY=null,surfaceWidth=0; 
    if(d.boss&&sheet.startsWith('v2/')&&(!(e.entryUntil>game.time)||whaleAtSurface)){const body=keepBossBodyVisible(sheet,row,pose,h,bodyX,bodyY,rotation,gait);bodyX=body.x;bodyY=body.y;bossBodyBounds.set(e.id,body);if(whaleAtSurface){surfaceY=body.top+(body.bottom-body.top)*.55-cameraOffset.y;surfaceWidth=body.right-body.left;body.surfaceY=surfaceY+cameraOffset.y;body.submergedBody=true;}}
    shadow(x,y+1,h*(e.kind==='rider'?.46:e.kind==='bill'?.25:d.boss?.32:.28),under?.06:e.kind==='bill'?.10:.18);ctx.save();if(surfaceY!==null){ctx.beginPath();ctx.rect(-W,-H,W*3,surfaceY+H);ctx.clip();}ctx.translate(bodyX,bodyY);ctx.scale(gait.sx*(e.kind==='morpheus'&&!sheet.startsWith('v2/')?-1:1),gait.sy);if(e.controlCat||d.rear)ctx.scale(-1,1);sprite(ctx,sheet,row,pose,0,0,h,under?.38:1,rotation,frozen?'frozen':e.healedUntil>game.time?'healed':null);ctx.restore();
    if(surfaceY!==null){ctx.save();ctx.strokeStyle='#d8f9f2b8';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(bodyX,surfaceY,surfaceWidth*.42,CH*.045,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    const encounterLabel=e.mobCast?`${e.mobCast.label} ${e.mobCast.remaining.toFixed(1)}s`:e.mobChannel?`${e.mobChannel.label} ${e.mobChannel.remaining.toFixed(1)}s`:e.mobFollowUp?'回刃将至':e.mobRushRemaining>0?`${e.mobRushLabel||'松绑追击'} ${e.mobRushRemaining.toFixed(1)}s`:e.paintWardActive?'沾色回盾':e.bearEnraged?'破甲暴怒':e.kind==='decomposer'&&e.mobCharge>0?`碎屑蓄能 ${Math.min(120,Math.ceil(e.mobCharge))}/120`:'';
    let annotationOffset=encounterLabel?57:28;
    if(e.energyShield>0){ctx.save();ctx.strokeStyle=e.shieldHitUntil>game.time?'#e6cda1':'#b6abc780';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-h*.45,h*.38,h*.5,0,0,Math.PI*2);ctx.stroke();text(ctx,'能量盾 '+Math.ceil(e.energyShield),x,y-h-Math.max(34,annotationOffset),9,'#8e81a3');ctx.restore();annotationOffset+=18;}
    if(e.kind==='bird'&&e.featherGuardUntil>game.time){
      drawBossFx(3,x,y-CH*.04,h*1.25,h*.62,.65,'boss-ground-fx-v02');
      ctx.save();ctx.strokeStyle='#e6b7ed';ctx.lineWidth=2;ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(x,y-h*.45,h*.52,h*.48,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      text(ctx,'护身羽幕 · 减伤 35%',x,y-h-30,11,'#e6a5ec');
    }
    if(e.kind==='butterfly'&&(e.mirrorsUntil>game.time||e.exposedUntil>game.time))text(ctx,e.exposedUntil>game.time?`蝶影识破 · 易伤 ${(e.exposedUntil-game.time).toFixed(1)}s`:`有影 · 真身 · 掩护 ${Math.ceil(e.mirrorsUntil-game.time)}s`,x,y-h-64,11,'#aeebf4');
    if(e.debtTokenOwner&&game.enemies.some(v=>v.hp>0&&v.id===e.debtTokenOwner&&v.debtMark?.slipId===e.id)){rounded(ctx,x-56,y-h-47,112,20,5,'#652b59ed','#f5b6df');text(ctx,'催缴契纸 · 击破解债',x,y-h-37,10,'#fff0fc');}
    if(e.controlCat){unitSprite(ctx,'mintCat',3,x,y-h*.8,CH*.58);text(ctx,`反攻 ${Math.ceil(e.reverseUntil-game.time)}s`,x,y-h-25,10,'#458f86');}
    health(x,y-h-13,e.hp,e.maxHp,0,true,e.armor+(game.troopOrder(e)?(e.orderArmor||0)+(e.orderShield||0):0));
    if(encounterLabel){const width=e.kind==='decomposer'?116:96;rounded(ctx,x-width/2,y-h-43,width,19,4,'#fbf1efe8','#ab879d');text(ctx,encounterLabel,x,y-h-33,10,'#5e3d62');}
    if(!d.boss&&under){ctx.save();ctx.strokeStyle='#70c9e1';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-CH*.13,CH*.32,CH*.08,0,0,Math.PI*2);ctx.stroke();ctx.restore();text(ctx,'潜水',x,y-h-annotationOffset,10,'#267b9c');annotationOffset+=16;}
    const order=game.troopOrder(e);if(order&&!d.boss){text(ctx,order.name,x,y-h-annotationOffset,10,e.orderKind==='rider'?'#d26537':'#9263ac');annotationOffset+=16;if(e.orderKind==='rider'){ctx.save();ctx.strokeStyle='#e4995577';ctx.lineWidth=3;for(let n=0;n<3;n++){ctx.beginPath();ctx.moveTo(x+CH*.3,y-10-n*9);ctx.lineTo(x+CH*(.5+n*.08),y-10-n*9);ctx.stroke();}ctx.restore();}}
    if(e.miniboss){const name='强化领队 · '+d.name,w=name.length*10+10;rounded(ctx,x-w/2,y-h-34,w,18,5,'#a47439');text(ctx,name,x,y-h-25,10,'#fff7e7');}
    if(d.boss){const name=e.stunUntil>game.time?'弱势 · 硬直':e.enraged?'狂暴 · '+d.name:d.name;const w=Math.max(100,name.length*10+10);rounded(ctx,x-w/2,y-h-36,w,18,5,e.stunUntil>game.time?'#48867f':e.enraged?'#a34c60':'#68776e');text(ctx,name,x,y-h-27,10,'#fff7e7');}
    const labels=REACTIONS.filter(r=>e.status[r.id]>game.time).map(r=>`${r.name}${Math.ceil(e.status[r.id]-game.time)}s`);if(labels.length)text(ctx,labels.slice(0,3).join(' · '),x,y-h-(d.boss?48:Math.max(22,annotationOffset)),9,'#75627b');
    if(d.boss&&labels.length){ctx.save();ctx.globalAlpha=.4;ctx.strokeStyle=e.status.burn>game.time?'#ce7580':e.status.vulnerable>game.time?'#b689c5':'#71adb1';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(x,y+1,h*.35,CH*.12,game.time*.04,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  function drawGuards(lane){
    for(const g of game.guards.filter(g=>g.lane===lane)){
      const anchor=projection.guardPoint(g.lane);
      // Ease from the painted pavement anchor into the engine's running path.
      const runBlend=Math.max(0,Math.min(1,(g.x+.5)/.8));
      const x=g.state==='running'?anchor.x+(px(g.x,g.lane)-anchor.x)*runBlend:anchor.x,y=anchor.y;
      if(g.state==='spent'){text(ctx,'下班',anchor.x,y-20,11,'#665477');continue;}
      shadow(x,y+3,25);sprite(ctx,'utility-expansion',g.swimming?2:1,g.state==='running'?2+Math.floor(game.time*10)%2:0,x,y,78*Math.min(1.2,CH/91));
      if(g.state==='ready'){ctx.fillStyle='#f8d764';ctx.beginPath();ctx.arc(x+29,y-28,4,0,Math.PI*2);ctx.fill();}
    }
  }
  function drawTomato(x,y,r=11){
    ctx.fillStyle='#c93650';ctx.strokeStyle='#802c43';ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(x,y,r,r*.88,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#e56c72';ctx.beginPath();ctx.ellipse(x-r*.3,y-r*.2,r*.28,r*.15,-.6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#4d9c64';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-5,y-r+3);ctx.lineTo(x,y-r-2);ctx.lineTo(x+5,y-r+3);ctx.stroke();
  }
  function drawProjectiles(lane){
    for(const p of game.projectiles.filter(p=>Math.floor(p.lane)===lane)){
      let x=px(p.x,p.lane),y=mid(p.lane);
      if(p.kind==='sheep'){const progress=Math.min(1,p.age/p.duration);y-=Math.sin(progress*Math.PI)*CH*.45;sprite(ctx,'combat-fx',2,Math.floor(progress*4)%4,x,y+CH*.18,CH*.48);}
      else if(p.kind==='flower'){const progress=Math.min(1,p.age/p.duration);y-=Math.sin(progress*Math.PI)*CH*.3;flowerFx(0,Math.floor(game.time*12)%4,x,y,CH*.65);}
      else if(p.kind==='tomato'){y-=Math.sin(Math.min(1,p.age/p.duration)*Math.PI)*85;drawTomato(x,y,13);}
      else if(p.kind==='wind'){
        const frame=Math.floor(game.time*12)%4;
        sprite(ctx,'combat-fx',0,frame,x,y+29,CH*.67,.85);
      }
      else if(p.kind==='dragonflame'){
        const img=spriteCache['skill-fx']?.[1]?.[Math.floor(game.time*12)%4];
        if(img){ctx.save();ctx.globalAlpha=.92;ctx.translate(x,y-CH*.16);ctx.scale(-1,1);ctx.drawImage(img,-CW*.65,0,CW*1.3,CH*.62);ctx.restore();}
      }
      else if(p.kind==='can'){rounded(ctx,x-10,y-7,20,14,4,'#e8a952','#fff0c8',2);rounded(ctx,x-3,y-7,5,14,1,'#c85748');}
      else if(p.kind==='jellyWave'){ctx.save();ctx.strokeStyle='#c3edf1';ctx.lineWidth=4;ctx.shadowColor='#78c1e5';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(x,y,13,-1.1,1.1);ctx.stroke();ctx.restore();}
      else if(p.kind==='betrayal'){ctx.save();ctx.fillStyle='#a679b0';ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+8,y-6);ctx.lineTo(x+8,y+6);ctx.closePath();ctx.fill();ctx.restore();}
      else{
        ctx.save();ctx.shadowColor='#ffb0c7';ctx.shadowBlur=10;ctx.fillStyle='#ef91b6';ctx.strokeStyle='#fff2ee';ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(x,y+2,8,6,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x-8+i*7,y-7-(i===1?2:0),3,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();
      }
    }
  }
  function flowerFx(row,frame,x,y,size,alpha=1){
    const img=images['flower-fx-v01'];if(!img)return;
    const tileW=img.width/4,tileH=img.height/2;ctx.save();ctx.globalAlpha*=alpha;
    ctx.drawImage(img,frame*tileW,row*tileH,tileW,tileH,x-size/2,y-size/2,size,size);ctx.restore();
  }
  function drawPools(lane){for(const p of game.pools.filter(p=>p.lane===lane)){const x=px(p.x,p.lane),y=feet(p.lane)-5;ctx.save();ctx.globalAlpha=Math.min(.65,p.ttl*.5);ctx.fillStyle='#c55a7d';ctx.beginPath();ctx.ellipse(x,y,79,18,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f1a8b1';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(x-44+i*27,y-3+Math.sin(game.time*4+i)*6,3+i%2,0,Math.PI*2);ctx.stroke();}ctx.restore();}}
  function drawCoins(){for(const c of game.coins){const x=px(c.x,c.lane),y=mid(c.lane)-9+Math.sin(game.time*3+c.id)*2;if(images['fons-ticket'])ctx.drawImage(images['fons-ticket'],x-26,y-26,52,52);text(ctx,'+'+c.value,x,y+22,11,'#72572c');}}
  let frameEffects=Array.from({length:BOARD_ROWS},()=>[]);
  function prepareFrameEffects(){
    frameEffects=Array.from({length:BOARD_ROWS},()=>[]);const numbers=new Map(),impacts=new Set();
    for(const f of game.effects){
      if(!frameEffects[f.lane])continue;
      if(f.kind==='damage'||f.kind==='heal'){
        const key=`${f.kind}:${f.lane}:${Math.floor(f.x)}:${f.color}`,value=f.value??Number(f.text);
        if(Number.isFinite(value)){
          const previous=numbers.get(key);
          if(previous){previous.value+=value;previous.text=(f.kind==='heal'?'+':'')+Math.ceil(previous.value);continue;}
          const copy={...f,value};numbers.set(key,copy);frameEffects[f.lane].push(copy);continue;
        }
      }
      if(f.kind==='impact'){
        const key=`${f.impact}:${f.lane}:${Math.floor(f.x*2)}`;if(impacts.has(key))continue;impacts.add(key);
      }
      frameEffects[f.lane].push(f);
    }
  }
  function drawEffects(lane){for(const f of frameEffects[lane]){const a=f.ttl/f.total,x=px(f.x,f.lane),y=mid(f.lane);
    ctx.save();ctx.globalAlpha=Math.min(1,a*2);
    if(f.kind==='defeat'){const d=ENEMIES[f.enemy];if(!f.swallowed)sprite(ctx,d.sheet||'enemies',d.row,3,x,feet(f.lane)+15*(1-a),(d.boss?108:68)*a+.1,a,(1-a)*.3);}
    else if(f.kind==='gulp'){
      const d=ENEMIES[f.enemy],p=1-a,xx=x+(px(f.mouthX,f.lane)-x)*(1-Math.pow(1-p,2)),yy=feet(f.lane)-Math.sin(p*Math.PI)*CH*.2-p*CH*.4;
      sprite(ctx,d.sheet||'enemies',d.row,0,xx,yy,CH*.78*Math.max(.05,1-p*.96),Math.min(1,a*3),p*.5);
    }
    else if(f.kind==='impact'){
      const frame={paw:0,slash:1,bite:1,shadow:1,tomato:3}[f.impact];
      if(frame!==undefined)sprite(ctx,'combat-fx',3,frame,x,y+CH*.28,CH*.72,a);
      else{ctx.strokeStyle=f.impact==='wind'?'#9ce5de':'#9ecddb';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,CH*.3*(1-a)+8,CH*.15*(1-a)+4,0,0,Math.PI*2);ctx.stroke();}
    }
    else if(f.kind==='sheepHeal'){
      const p=1-a,xx=px(f.fromX,f.fromLane??f.lane)+(x-px(f.fromX,f.fromLane??f.lane))*p,yy=mid(f.fromLane)+(y-mid(f.fromLane))*p-Math.sin(p*Math.PI)*CH*.42;
      sprite(ctx,'combat-fx',2,Math.min(3,Math.floor(p*4)),xx,yy+CH*.2,CH*.36,Math.min(1,a*4));
    }
    else if(f.kind==='shieldImpact'||f.kind==='shieldRaise'){
      sprite(ctx,'combat-fx',3,2,x,feet(f.lane),CH*(f.kind==='shieldRaise'?1:1.15),a*.8);
      if(f.kind==='shieldImpact'&&f.fromX!==f.x){ctx.strokeStyle='#d7bc6b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px(f.fromX,f.fromLane??f.lane),y);ctx.lineTo(x,y);ctx.stroke();}
    }
    else if(f.kind==='panicWave'){
      ctx.strokeStyle='#b15f85';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(x,y,CW*1.8*(1-a),CH*.32*(1-a),0,0,Math.PI*2);ctx.stroke();
    }
    else if(f.kind==='bossBuff'||f.kind==='summonRing'){
      ctx.strokeStyle=f.color;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,feet(f.lane)+CH*.6,CH*(.4+(1-a)*.5),CH*.15,0,0,Math.PI*2);ctx.stroke();
    }
    else if(f.kind==='stamp'){text(ctx,'₣ +'+(f.value??UNITS.chiz.production),x,y-CH*.15-(1-a)*CH*.45,CH*.18,'#a58143');}
    else if(f.kind==='timeStop'){
      const frame=Math.min(3,Math.floor((1-a)*4));
      sprite(ctx,'skill-fx',0,frame,px(f.x+.65,f.lane),feet(f.lane),CH*.68,a);
    }
    else if(f.kind==='breath'){}
    else if(f.kind==='landing'||f.kind==='slam'){
      const slam=f.kind==='slam';ctx.strokeStyle=slam?'#e3a052':'#faf0ce';ctx.lineWidth=slam?7:3;
      ctx.beginPath();ctx.ellipse(x,feet(f.lane)+1,(slam?125:45)*(1-a)+15,(slam?24:10)*(1-a)+3,0,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<6;i++){const angle=i*Math.PI/3;ctx.fillStyle=slam?'#c49761':'#dbc59c';ctx.beginPath();ctx.arc(x+Math.cos(angle)*(1-a)*(slam?125:48),feet(f.lane)-Math.sin((1-a)*Math.PI)*24+Math.sin(angle)*10,3*a+1,0,Math.PI*2);ctx.fill();}
    }
    else if(f.kind==='jellySpray'){
      const end=px(f.endX,f.lane),width=end-x,progress=1-a;ctx.save();ctx.globalAlpha=a*.7;
      const glow=ctx.createLinearGradient(x,y,end,y);glow.addColorStop(0,'#9fddef22');glow.addColorStop(.6,'#b8e8f4bb');glow.addColorStop(1,'#d7f5ff11');ctx.fillStyle=glow;
      ctx.beginPath();ctx.moveTo(x,y-CH*.1);ctx.lineTo(end,y-CH*.35);ctx.quadraticCurveTo(end+CH*.16,y,end,y+CH*.35);ctx.lineTo(x,y+CH*.1);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#d5f5ff';ctx.lineWidth=2.5;for(let n=0;n<7;n++){const q=(n/7+progress*.3)%1,cx=x+width*q,r=CH*(.12+q*.2);ctx.beginPath();ctx.ellipse(cx,y,r*.4,r,0,-1.3,1.3);ctx.stroke();}ctx.restore();
      if(f.radius){const sx=px(f.splashX,f.splashLane),sy=feet(f.splashLane)-CH*.42;ctx.save();ctx.globalAlpha=a*.65;ctx.fillStyle='#a9ddec33';ctx.strokeStyle='#b0e8f0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(sx,sy,CW*f.radius,CH*1.15,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}
    }
    else if(f.kind==='umbrellaBlink'){ctx.strokeStyle='#c35d81';ctx.lineWidth=2;ctx.setLineDash([4,4]);for(const pos of [f.fromX,f.x]){ctx.beginPath();ctx.ellipse(px(pos,f.lane),feet(f.lane)-CH*.4,CH*.24*(1-a)+10,CH*.48,0,0,Math.PI*2);ctx.stroke();}}
    else if(f.kind==='glovePunch'){ctx.strokeStyle='#e2b364';ctx.lineWidth=5*a+1;ctx.beginPath();ctx.ellipse(x,y,CW*.85*(1-a)+10,CH*(1-a)+8,0,0,Math.PI*2);ctx.stroke();}
    else if(f.kind==='paintSplash'){ctx.save();ctx.globalAlpha*=Math.min(1,a*2);ctx.fillStyle='#ce6bb5';ctx.beginPath();ctx.ellipse(x,feet(f.lane)-CH*.025,CW*(.3+.2*(1-a)),CH*.065,-.1,0,Math.PI*2);ctx.fill();ctx.restore();}
    else if(f.kind==='encounterPulse'){ctx.save();ctx.globalAlpha*=a;ctx.strokeStyle=f.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(x,feet(f.lane)-CH*.08,CW*(.2+.6*(1-a)),CH*.11,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    else if(f.kind==='encounterTether'){ctx.strokeStyle='#ab7ec4';ctx.lineWidth=3*a+1;ctx.beginPath();ctx.moveTo(x,feet(f.lane)-CH*.35);ctx.quadraticCurveTo(px((f.x+f.targetX)/2,f.lane),feet(f.lane)-CH*.6,px(f.targetX,f.lane),feet(f.lane)-CH*.25);ctx.stroke();}
    else if(f.kind==='silkRescue'){ctx.strokeStyle='#d5afd9';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(px(11.6,f.lane),y-CH*.5);ctx.stroke();}
    else if(f.kind==='slash'){ctx.strokeStyle='#b4dfff';ctx.lineWidth=5+(f.combo||0)*.35;ctx.beginPath();ctx.arc(x,y,39+(f.combo||0),-1,1);ctx.stroke();}
    else if(f.kind==='shadowSpike'){ctx.strokeStyle='#4d3d5b';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,feet(f.lane),CW*.25*(1-a)+CW*.15,CH*.08,0,0,Math.PI*2);ctx.stroke();}
    else if(f.kind==='flowerImpact'){flowerFx(1,Math.min(3,Math.floor((1-a)*4)),x,y,CH*.8);}
    else if(f.kind==='counterattack'){sprite(ctx,'combat-fx',3,1,px(f.targetX,f.lane),y+CH*.25,CH*.6,a);}
    else if(f.kind==='starBurst'){ctx.strokeStyle='#9d90c7';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,CH*.6*(1-a)+10,0,Math.PI*2);ctx.stroke();for(let n=0;n<6;n++)text(ctx,'✦',x+Math.cos(n*Math.PI/3)*CH*.4,y+Math.sin(n*Math.PI/3)*CH*.4,12,'#a49cc3');}
    else if(f.kind==='bossPulse'){}
    else if(f.text){ctx.font=`700 ${f.kind==='damage'?17:13}px "Microsoft YaHei",sans-serif`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#fff8e9';ctx.strokeText(f.text,x,y-35-(1-a)*28);ctx.fillStyle=f.color||'#456655';ctx.fillText(f.text,x,y-35-(1-a)*28);}
    ctx.restore();
  }}
  const DEBUFF_TEXTURES={thorns:0,dream:1,dust:2,beat:3,chains:4,web:5,headwind:6},debuffPatterns={};
  const renderStats={boardBuilds:0,hazardBuilds:0,hazardReuses:0,renderFrames:0,waterBuilds:0,waterReuses:0,seaPatternBuilds:0,foamSliceBuilds:0,spriteVariantBuilds:0,renderMs:0,tickMs:0};
  const seaPatterns=new WeakMap(),foamSlices=[];
  let seaTile=null,waterLayer=null,waterLayerContext=null,waterLayerKey='',waterLayerGame=null;
  function debuffPattern(index){
    if(debuffPatterns[index])return debuffPatterns[index];
    const img=images['boss-debuff-terrain-v01'];if(!img)return null;
    const sw=img.width/4,sh=img.height/2,tile=document.createElement('canvas');tile.width=tile.height=384;
    tile.getContext('2d').drawImage(img,(index%4)*sw+1,Math.floor(index/4)*sh+1,sw-2,sh-2,0,0,384,384);
    return debuffPatterns[index]=ctx.createPattern(tile,'repeat');
  }
  function debuffTexture(kind,x1,x2,row1,row2,alpha=1){
    const base=DEBUFF_TEXTURES[kind];if(base===undefined)return;
    const motion=reducedMotion?0:game.time,drift=motion*({dream:.09,dust:.12,headwind:.55}[kind]||0),blend=kind==='headwind'&&!reducedMotion?.5+.5*Math.sin(motion*2):0;
    const layers=kind==='headwind'?[[base,1-blend],[base+1,blend]]:[[base,1]];
    ctx.save();paintArea(x1,x2,row1,row2,null);ctx.clip();
    for(const [index,weight] of layers){const pattern=debuffPattern(index);if(!pattern||weight<.01)continue;
      ctx.globalAlpha=alpha*weight;
      // Material follows the same widening rows as the board and its hit test.
      for(let i=0;i<16;i++){const row=row1+(row2-row1)*i/16,next=row1+(row2-row1)*(i+1)/16,origin=projection.point(0,row),one=projection.point(1,row),left=projection.point(x1,row),right=projection.point(x2,row),bottom=projection.point(x1,next),width=one.x-origin.x;
        pattern.setTransform(new DOMMatrix().translate(origin.x-drift*width,B.y).scale(width*2/384,CH/384));ctx.fillStyle=pattern;ctx.fillRect(left.x-1,left.y,right.x-left.x+2,bottom.y-left.y+1);
      }
    }
    ctx.restore();
  }
  function terrainTexture(column,x1,x2,row1,row2,alpha=1){
    const img=images['terrain-water-fire-v01'];if(!img||x2<=x1)return;
    const sw=img.width/2,sh=img.height/4,frame=reducedMotion?0:Math.floor(game.time*(column?7:5))%4;
    ctx.save();ctx.globalAlpha*=alpha;paintArea(x1,x2,row1,row2,null);ctx.clip();
    // Thin horizontal strips map the raster onto the same perspective as deployment cells.
    for(let i=0;i<24;i++){const row=row1+(row2-row1)*i/24,next=row1+(row2-row1)*(i+1)/24,left=projection.point(x1,row),right=projection.point(x2,row),bottom=projection.point(x1,next);ctx.drawImage(img,column*sw,frame*sh+sh*i/24,sw,sh/24,left.x,left.y,right.x-left.x,bottom.y-left.y+1);}
    ctx.restore();
  }
  function waterEdgePoints(corners){
    const points=[],time=reducedMotion?0:game.time*.8;
    for(let side=0;side<corners.length;side++){
      const a=corners[side],b=corners[(side+1)%corners.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),steps=Math.max(5,Math.ceil(length/24));
      for(let i=0;i<steps;i++){const t=i/steps,offset=Math.sin(Math.PI*t)*(Math.sin(t*length*.065+side*2.1+time)*CH*.025+Math.sin(t*length*.17-side+time*.7)*CH*.012);points.push({x:a.x+dx*t-dy/length*offset,y:a.y+dy*t+dx/length*offset});}
    }
    return points;
  }
  function waterPath(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
  function waterFoam(points,alpha,coast=false){
    const img=images['tsunami-front-v02'];if(!img)return;
    if(!foamSlices.length)for(let i=0;i<8;i++){const tile=document.createElement('canvas');tile.width=96;tile.height=64;tile.getContext('2d').drawImage(img,0,i*img.height/8,img.width,img.height/8,0,0,96,64);foamSlices.push(tile);renderStats.foamSliceBuilds++;}
    ctx.save();ctx.globalAlpha*=alpha*(coast?.95:.85);
    for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b.x-a.x,b.y-a.y),width=CH*(coast?.72:.36);ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2);ctx.drawImage(foamSlices[i%8],-width*.34,-1,width,length+2);ctx.restore();}
    ctx.restore();
  }
  function fillSea(points,alpha=1,foam=false,coast=false){
    const img=images['sea-surface-v02'];if(!img)return;
    if(!seaTile){seaTile=document.createElement('canvas');seaTile.width=384;seaTile.height=Math.max(1,Math.round(img.height*384/img.width));seaTile.getContext('2d').drawImage(img,0,0,seaTile.width,seaTile.height);}
    let pattern=seaPatterns.get(ctx);if(!pattern){pattern=ctx.createPattern(seaTile,'repeat');seaPatterns.set(ctx,pattern);renderStats.seaPatternBuilds++;}
    const scale=Math.max(.12*img.width,CW*3)/seaTile.width,drift=reducedMotion?0:game.time*3;
    pattern.setTransform(new DOMMatrix().translate(-drift,drift*.3).scale(scale));
    ctx.save();ctx.globalAlpha*=alpha;waterPath(points);ctx.clip();ctx.fillStyle=pattern;ctx.fillRect(0,0,W,H);ctx.restore();
    if(foam)waterFoam(points,alpha,coast);
  }
  function seaSurface(x1,x2,row1,row2,alpha=1,foam=false){
    if(x2<=x1)return;fillSea(waterEdgePoints(projection.corners(x1,x2,row1,row2)),alpha,foam);
  }
  function seaFront(front,row1,row2,alpha=1){
    const img=images['tsunami-front-v02'];if(!img)return;
    ctx.save();ctx.globalAlpha*=alpha;paintArea(0,BOARD_COLS,row1,row2,null);ctx.clip();
    for(let i=0;i<24;i++){const row=row1+(row2-row1)*i/24,next=row1+(row2-row1)*(i+1)/24,left=projection.point(front-.55,row),right=projection.point(front+1.15,row),bottom=projection.point(front-.55,next);ctx.drawImage(img,0,img.height*i/24,img.width,img.height/24,left.x,left.y,right.x-left.x,bottom.y-left.y+1);}
    ctx.restore();
  }
  function drawWhaleShore(progress){
    // Seawater meets the existing floor directly; there is no beach overlay.
    ctx.save();ctx.beginPath();ctx.rect(W*(1-progress),0,W*progress,H);ctx.clip();
    const top=projection.point(BOARD_COLS,0),bottom=projection.point(BOARD_COLS,BOARD_ROWS);
    const edge=y=>top.x+(bottom.x-top.x)*(y-top.y)/(bottom.y-top.y);
    fillSea(waterEdgePoints([{x:edge(-20),y:-20},{x:W+20,y:-20},{x:W+20,y:H+20},{x:edge(H+20),y:H+20}]),1,true,true);
    ctx.restore();
  }
  function drawWaterTerrain(){
    const hasWater=game.enemies.some(e=>e.kind==='whale'&&e.hp>0)||game.floodWarnings.length||game.terrain.some(row=>row.some(t=>t.waterUntil>game.time));
    if(!hasWater){waterLayerKey='';return;}
    // Water moves slowly; composite a reusable layer at 20 Hz while combat stays at display rate.
    const key=`${W}:${H}:${Math.floor(game.time*20)}:${game.waterRevision||0}:${game.floodWarnings.length}:${reducedMotion}`;
    if(!waterLayer){waterLayer=document.createElement('canvas');waterLayerContext=waterLayer.getContext('2d');}
    if(waterLayerGame!==game||waterLayerKey!==key){
      if(waterLayer.width!==W||waterLayer.height!==Math.ceil(H)){waterLayer.width=W;waterLayer.height=Math.ceil(H);}
      const screenContext=ctx;ctx=waterLayerContext;
      try{ctx.clearRect(0,0,W,Math.ceil(H));drawWaterTerrainSource();}finally{ctx=screenContext;}
      waterLayerGame=game;waterLayerKey=key;renderStats.waterBuilds++;
    }else renderStats.waterReuses++;
    ctx.drawImage(waterLayer,0,0);
  }
  function drawWaterTerrainSource(){
    for(const e of game.enemies.filter(v=>v.kind==='whale'&&v.hp>0)){
      const entering=e.entryUntil>game.time,progress=entering?Math.max(0,Math.min(1,(game.time-e.entryStarted)/(e.entryUntil-e.entryStarted))):1;
      drawWhaleShore(progress);
    }
    const labeledSea=new Set();
    for(const z of game.waterSurfaceAreas()){
      const progress=reducedMotion?1:Math.min(1,(game.time-z.started)/1.6),front=z.col2-(z.col2-z.col1)*progress,alpha=Math.min(1,(z.until-game.time)/1.5);
      seaSurface(front,z.col2,z.row1,z.row2,alpha,true);
      if(progress<1)seaFront(front,z.row1,z.row2,alpha);
      if(!labeledSea.has(z.zone)){labeledSea.add(z.zone);const x=px((z.col1+z.col2)/2,z.row1),y=projection.point(0,z.row1).y+14;rounded(ctx,x-35,y-9,70,18,9,'#155e7bbb','#b0ebf799');text(ctx,`退潮 ${Math.ceil(z.until-game.time)}s`,x,y,10,'#edfbff');}
    }
    for(const w of game.floodWarnings){const rows=w.cells.map(c=>c.lane),top=Math.min(...rows),bottom=Math.max(...rows)+1,progress=1-(w.at-game.time)/4.5;seaSurface(0,BOARD_COLS,top,bottom,.08+Math.max(0,progress)*.1);}
  }
  const hazardLayers=Array.from({length:BOARD_ROWS},()=>({canvas:null,key:'',game:null}));
  function drawHazardLayer(lane){
    const hazards=game.hazards.filter(h=>h.cells.some(c=>c.lane===lane));if(!hazards.length)return;
    const layer=hazardLayers[lane],top=Math.floor(projection.point(0,lane).y)-2,bottom=Math.ceil(projection.point(0,lane+1).y)+2;
    const key=`${H}:${CW}:${reducedMotion}:`+hazards.map(h=>{
      const animated=['dream','dust','headwind'].includes(h.kind)||h.until-game.time<.6;
      const frame=reducedMotion?0:h.kind==='fire'?Math.floor(game.time*7)%4:animated?Math.floor(game.time*15):0;
      return `${h.id}:${h.kind}:${h.cells.filter(c=>c.lane===lane).map(c=>c.col)}:${Math.ceil(h.until-game.time)}:${frame}:${h.beatIn<.55}:${h.beatFlash>0}`;
    }).join('|')+game.terrain[lane].map(t=>t.waterUntil>game.time?1:0).join('');
    if(layer.game!==game||layer.key!==key){
      if(!layer.canvas)layer.canvas=document.createElement('canvas');
      if(layer.canvas.width!==W||layer.canvas.height!==bottom-top){layer.canvas.width=W;layer.canvas.height=bottom-top;}
      const screenContext=ctx;ctx=layer.canvas.getContext('2d');
      try{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,bottom-top);ctx.translate(0,-top);drawHazardSource(lane, hazards);}finally{ctx=screenContext;}
      layer.game=game;layer.key=key;renderStats.hazardBuilds++;
    }else renderStats.hazardReuses++;
    ctx.drawImage(layer.canvas,0,top);
  }
  function drawHazardSource(lane,hazards){
    const colors={fire:'#c77b535b',thorns:'#9b79ac44',dream:'#8b8fac40',dust:'#a89c6a3d',beat:'#a767993d',chains:'#8576a34a',web:'#ad8aab45',headwind:'#70518b52',paint:'#bf70ab55'};
    for(const h of hazards){
      const cols=[...new Set(h.cells.filter(c=>c.lane===lane&&!(h.kind==='fire'&&game.isWater(lane,c.col))).map(c=>c.col))].sort((a,b)=>a-b),runs=[];
      for(const col of cols){const last=runs[runs.length-1];if(last&&col===last[1])last[1]=col+1;else runs.push([col,col+1]);}
      for(const [first,last] of runs){
        const fade=Math.min(1,Math.max(0,h.until-game.time)/.6),alpha={thorns:.8,dream:.52,dust:.7,beat:.58,chains:.85,web:.78,headwind:.64}[h.kind]||.8;
        paintArea(first,last,lane,lane+1,h.ambient?'#c77b5318':colors[h.kind]);
        if(h.kind==='fire'){for(let col=first;col<last;col++)terrainTexture(1,col,col+1,h.ambient?lane+.68:lane,h.ambient?lane+.98:lane+1,(h.ambient?.45:.9)*fade);}
        else if(h.kind==='paint'){ctx.save();ctx.globalAlpha=.7*fade;for(let col=first;col<last;col++){ctx.fillStyle='#c26aa9';ctx.beginPath();ctx.ellipse(px(col+.5,lane),feet(lane)-CH*.16,CW*.35,CH*.16,-.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#74bdc5';ctx.beginPath();ctx.ellipse(px(col+.62,lane),feet(lane)-CH*.24,CW*.16,CH*.1,.2,0,Math.PI*2);ctx.fill();}ctx.restore();}
        else debuffTexture(h.kind,first,last,lane,lane+1,alpha*fade*(h.kind==='beat'&&h.beatIn!==undefined?(h.beatFlash>0?1.6:h.beatIn<.55?1.25:.45):1));
        if(h.kind==='beat'&&h.beatIn!==undefined&&(h.beatFlash>0||h.beatIn<.55))paintArea(first,last,lane,lane+1,h.beatFlash>0?'#f4b8f745':null,'#f9c5f4',2);
        const label={fire:'灼烧',thorns:'荆棘',dream:'梦蚀',dust:'蝶粉',beat:'节拍',chains:'锁链',web:'蛛网',headwind:'逆风 · 攻击/治疗减速 35%',paint:'涂鸦 · 暂不能部署'}[h.kind]||h.kind;
        if(h.ambient){if(lane===0)text(ctx,'持续灼地',px((first+last)/2,lane),feet(lane),9,'#d09570');}
        else if(h.kind!=='beat'||h.beatIn===undefined)text(ctx,`${label} · ${Math.ceil(h.until-game.time)}s`,px((first+last)/2,lane),feet(lane),10,'#f8e7ee');
      }
    }
  }
  function drawTerrain(lane){
    drawHazardLayer(lane);
    for(const p of game.platforms.filter(p=>p.lane===lane)){sprite(ctx,'utility-expansion',0,p.hurt>0?2:Math.floor(game.time*1.2+p.id)%2,px(p.x,p.lane),feet(p.lane)+CH*.01,CH*.34);if(p.hp<p.maxHp)health(px(p.x,p.lane),feet(p.lane)+CH*.04,p.hp,p.maxHp);}
    const f=game.flowers.find(f=>f.lane===lane);if(f)sprite(ctx,'utility-expansion',3,0,px(f.x,lane),feet(lane),CH*.4,Math.min(1,(f.until-game.time)/.5));
  }
  function drawBossFx(index,x,y,w,h,alpha=1,asset='boss-ground-fx-v02'){
    const img=images[asset];if(!img)return;
    const sw=img.width/3,sh=img.height/4;ctx.save();ctx.globalAlpha=alpha;
    ctx.drawImage(img,(index%3)*sw,Math.floor(index/3)*sh,sw,sh,x-w/2,y-h,w,h);ctx.restore();
  }
  function bossFxSites(areas){
    const sites=[];
    for(const area of areas)for(let lane=area.laneMin;lane<=area.laneMax;lane++){
      const count=Math.max(1,Math.ceil((area.x2-area.x1)/2)),span=(area.x2-area.x1)/count;
      for(let n=0;n<count;n++)sites.push({lane,x:area.x1+span*(n+.5),span});
    }
    return sites;
  }
  function drawBossIncoming(){
    for(const e of game.enemies){
      if(!ENEMIES[e.kind].boss)continue;const profile=BOSS_THREAT[e.kind]||{fx:11};
      if(e.normalCast){
        const a=e.normalCast.area,p=Math.max(0,Math.min(1,1-e.normalCast.left/e.normalCast.total)),tx=px((a.x1+a.x2)/2,a.laneMin),ty=feet(a.laneMin)-CH*.24;
        const sx=enemyVisualX(e)-CW*.2,sy=feet(e.travelLane??e.lane)-enemyHeight(e)*.45;
        // Retained directional atlas is a travelling normal shot, never an area marker.
        drawBossFx(profile.fx,sx+(tx-sx)*p,sy+(ty-sy)*p-Math.sin(p*Math.PI)*CH*.35,CW*1.35,CH*.62,.9,'boss-impact-fx-v01');
      }
      if(!(e.windup>0&&e.windup<.72)||e.kind==='whale'&&e.skillName==='海啸')continue;
      const p=1-e.windup/.72;
      for(const site of bossFxSites(game.bossAreas(e))){
        const x=px(site.x,site.lane),ground=feet(site.lane),top=-CH*1.8;
        if(e.kind==='serenetti'&&['前排催眠曲','前排惑音','终幕安眠曲'].includes(e.skillName)){
          const startX=px(e.x,e.travelLane??e.lane),startY=feet(e.travelLane??e.lane)-CH*.7;
          ctx.save();ctx.strokeStyle='#ae86dc';ctx.lineWidth=3;ctx.globalAlpha=.75;
          for(let n=0;n<3;n++){const t=Math.max(0,p-n*.09);ctx.beginPath();ctx.ellipse(startX+(x-startX)*t,startY+(ground-CH*.45-startY)*t,CH*(.1+t*.12),CH*(.2+t*.16),0,0,Math.PI*2);ctx.stroke();}
          ctx.restore();continue;
        }
        const y=reducedMotion?ground-CH*.25:top+(ground-top)*p*p;
        drawBossFx(profile.fx,x,y,CW*1.65,CH*1.25,Math.min(1,p*4),'boss-falling-fx-v01');
      }
    }
  }
  function render(){
    const crowded=game.enemies.length>=80||game.enemies.filter(e=>e.hp>0&&ENEMIES[e.kind].boss).length>=2;
    if(crowded){calmFrames=0;if(!denseRendering){denseRendering=true;fitBattlefield();}}
    else if(denseRendering&&++calmFrames>240){denseRendering=false;fitBattlefield();}
    prepareFrameEffects();
    renderStats.renderFrames++;
    bossBodyBounds.clear();
    ctx.clearRect(0,0,W,H);
    const impacts=game.effects.filter(f=>f.kind==='bossPulse'),casts=game.enemies.filter(e=>e.windup>0);
    const strongest=impacts.reduce((best,f)=>{const age=f.total-f.ttl,force=(f.normal?2:f.flood?10:7)*Math.max(0,1-age/.48);return force>best.force?{force,f}:best;},{force:0,f:null});
    const shake=!reducedMotion&&game.phase==='running'?Math.min(10,strongest.force):0;
    cameraOffset={x:Math.sin(game.time*79)*shake,y:Math.cos(game.time*93)*shake*.56};
    ctx.save();ctx.translate(cameraOffset.x,cameraOffset.y);drawBoard();window.EibonEvolutionUI?.drawEnvironment(ctx,game,projection,{W,H,CW,CH,paintArea,images,reducedMotion,placing:!!(dragging||selected||shovel)});drawWaterTerrain();
    if(casts.length){ctx.fillStyle='#231526';ctx.globalAlpha=Math.min(.12,.045+casts.length*.025);ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
    const entities=[...game.units.map(u=>({type:'unit',v:u})),...game.enemies.filter(e=>!ENEMIES[e.kind].boss).map(e=>({type:'enemy',v:e}))].sort((a,b)=>a.v.lane-b.v.lane||a.v.x-b.v.x||Number(!UNITS[a.v.kind]?.ground)-Number(!UNITS[b.v.kind]?.ground));
    // Complete each back lane before its foreground lane, including attack art.
    for(let lane=0;lane<5;lane++){
      drawTerrain(lane);drawPools(lane);drawGuards(lane);
      for(const e of game.enemies.filter(e=>e.hp>0&&e.mobCast)){
        const cast=e.mobCast;
        const warningColor=['slash','bladeReturn','pounce','chainSeal','weave'].includes(cast.type)?'#a17dba':cast.type==='bearPush'?'#cc8c70':cast.type==='tide'?'#75a8c5':'#b58d73';
        if(cast.area&&lane>=cast.area.laneMin&&lane<=cast.area.laneMax)paintArea(cast.area.x1,cast.area.x2,lane,lane+1,warningColor+'28',warningColor,2);
        for(const c of cast.cells||[])if(c.lane===lane)paintArea(c.col,c.col+1,lane,lane+1,warningColor+'2a',warningColor,2);
        if(cast.type==='blink'&&e.lane===lane)paintArea(Math.max(0,cast.destination-.3),Math.min(BOARD_COLS,cast.destination+.3),lane,lane+1,'#c3799526','#b47091',2);
      }
      for(const e of game.enemies.filter(e=>e.normalCast&&e.normalCast.area.laneMin===lane)){
        const a=e.normalCast.area;paintArea(a.x1,a.x2,lane,lane+1,'#bb826e22','#b7856d',1.5);text(ctx,`普攻 ${e.normalCast.left.toFixed(1)}s`,px((a.x1+a.x2)/2,lane),projection.point(0,lane).y+15,10,'#95695a');
      }
      for(const e of game.enemies.filter(e=>e.windup>0))for(const area of game.bossAreas(e).filter(a=>lane>=a.laneMin&&lane<=a.laneMax)){
        const x=px((area.x1+area.x2)/2,lane),y=projection.point(0,lane).y+3;
        const profile=BOSS_THREAT[e.kind],color=profile?.color||'#b8637a',charge=1-e.windup/e.windupTotal;
        ctx.save();ctx.globalAlpha=.15+charge*.17;paintArea(area.x1,area.x2,lane,lane+1,color);ctx.restore();
        paintArea(area.x1,area.x2,lane,lane+1,null,color,2.5+charge*2);
        if(e.kind==='rider')terrainTexture(1,area.x1,area.x2,lane,lane+1,.18+charge*.22);
        const damage=game.bossSkillDamage(e,area),flood=e.kind==='whale'&&e.skillName==='海啸';
        if(lane===area.laneMin){const label=`${e.skillName||ENEMIES[e.kind].skill.split(' · ')[0]} · ${flood?'海浪冲击 · 积水增伤':'范围技 · 可撤回避开'} · ${e.windup.toFixed(1)}s`;const width=Math.min(W*.42,label.length*12+20);rounded(ctx,x-width/2,y+1,width,24,5,'#e7e3edf2','#a291b4',1);text(ctx,label,x,y+13,12,'#6d3d61');}
        for(const u of game.units.filter(u=>u.hp>0&&u.lane===lane&&u.x>=area.x1&&u.x<=area.x2)){
          const protector=game.units.find(v=>v.kind==='adler'&&v.hp>0&&v.lane===u.lane&&v.col===u.col+1&&v.shield>0);
          const effective=damage-Math.min(protector?.shield||0,damage*.7)-(u.shield||0);
          if(!flood&&effective>=u.hp)text(ctx,'危险',px(u.x,lane),feet(lane)-unitHeight(u.kind,lane)-27,12,'#a91e36');
        }
      }
      for(const e of entities.filter(e=>e.v.lane===lane))e.type==='unit'?drawUnit(e.v):drawEnemy(e.v);
      drawProjectiles(lane);drawEffects(lane);window.EibonEvolutionUI?.drawEffects(ctx,game,lane,projection,{CW,CH,sprite,unitSprite,unitHeight,enemyHeight});
      for(const f of game.effects.filter(f=>f.kind==='breath'&&lane>=f.area.laneMin&&lane<=f.area.laneMax)){
        const a=f.ttl/f.total,frame=Math.min(3,Math.floor((1-a)*4)),img=spriteCache['skill-fx']?.[1]?.[frame];
        if(img){const right=projection.point(f.area.x2,lane),left=projection.point(f.area.x1,lane),rowH=projection.point(0,lane+1).y-right.y;ctx.save();ctx.globalAlpha=Math.min(1,a*2);ctx.translate(right.x,right.y-rowH*.06);ctx.scale(-1,1);ctx.drawImage(img,0,0,right.x-left.x,rowH*1.08);ctx.restore();}
      }
      for(const f of game.effects.filter(f=>f.areas))for(const area of f.areas.filter(a=>lane>=a.laneMin&&lane<=a.laneMax)){
        const progress=1-f.ttl/f.total,y=feet(lane),center=(area.x1+area.x2)/2;
        ctx.save();ctx.globalAlpha=(1-progress)*.7;
        if(f.kind==='ghostRush'){
          for(let i=0;i<3;i++)sprite(ctx,'wind',0,(Math.floor(progress*4)+i)%4,px(area.x2-progress*(area.x2-area.x1),lane)-i*22,y,CH*.8,.8);
          if(lane===f.lane)sprite(ctx,'nte-bosses',0,2,px(area.x2-progress*(area.x2-area.x1),lane),y,CH*1.2,.7);
        }else if(f.kind==='redDance'){
          ctx.strokeStyle='#ef315b';ctx.lineWidth=10*(1-progress)+2;ctx.beginPath();ctx.ellipse(px(center,lane),y-CH*.4,(area.x2-area.x1)*CW*.5*progress,CH*.4,0,0,Math.PI*2);ctx.stroke();
          sprite(ctx,'nte-bosses',1,2,px(center,lane),y,CH*.95,.45);
        }else if(f.kind==='bossPulse'){
          if(f.flood){ctx.restore();continue;}
          const profile=BOSS_THREAT[f.boss],width=px(area.x2,lane)-px(area.x1,lane),alpha=Math.min(1,(1-progress)*2.3),song=f.boss==='serenetti'&&['前排催眠曲','前排惑音','终幕安眠曲'].includes(f.skillName);
          paintArea(area.x1,area.x2,lane,lane+1,null,profile?.color||'#9d64ce',1.5);
          const count=f.normal?1:Math.max(1,Math.ceil((area.x2-area.x1)/2)),span=width/count;
          for(let n=0;n<count;n++){
            const fxX=px(area.x1,lane)+span*(n+.5),rise=reducedMotion?1:.62+Math.sin(Math.min(1,progress/.22)*Math.PI/2)*.38;
            ctx.save();paintArea(area.x1,area.x2,lane,lane+1,null);ctx.clip();ctx.strokeStyle=profile?.color||'#9d64ce';ctx.lineWidth=3*(1-progress)+1;ctx.globalAlpha=alpha*.65;ctx.beginPath();ctx.ellipse(fxX,y-CH*.14,span*(.15+progress*.42),CH*(.035+progress*.18),0,0,Math.PI*2);ctx.stroke();ctx.restore();
            drawBossFx(song?6:(profile?.fx??11),fxX,y+CH*.03,span*.96,CH*(f.normal?.7:1.15)*rise,alpha);
          }
          if(progress<.32)drawBossFx(11,px(center,lane),y,Math.min(width,CW*2),CH,.55*(1-progress/.32));
        }ctx.restore();
      }
    }
    drawBossIncoming();
    drawCoins();
    for(let lane=0;lane<BOARD_ROWS;lane++)if(game.isLaneFrozen(lane)){paintArea(0,BOARD_COLS,lane,lane+1,'#70c8e222','#8f5bdb',1.5);text(ctx,`浔 · 本路时停 ${Math.max(game.freezeUntil,game.laneFreezeUntil[lane])-game.time>0?(Math.max(game.freezeUntil,game.laneFreezeUntil[lane])-game.time).toFixed(1):'0.0'}s`,px(5.5,lane),projection.point(0,lane+.14).y,12,'#351b68');}
    if(game.time<game.supportUntil){ctx.save();ctx.globalAlpha=.5+Math.sin(game.time*6)*.2;paintArea(0,BOARD_COLS,0,BOARD_ROWS,null,'#f2d294',7);ctx.restore();}
    // Bosses are the top battlefield layer, above all units, projectiles and terrain FX.
    for(const boss of game.enemies.filter(e=>e.hp>0&&ENEMIES[e.kind].boss).sort((a,b)=>(a.travelLane??a.lane)-(b.travelLane??b.lane)))drawEnemy(boss);
    // Keep the actionable beat clock above impact artwork and below crew feet.
    for(const hazard of game.hazards.filter(h=>h.kind==='beat'&&h.beatIn!==undefined))for(let lane=0;lane<BOARD_ROWS;lane++){
      const cells=hazard.cells.filter(c=>c.lane===lane);if(!cells.length)continue;
      const first=Math.min(...cells.map(c=>c.col)),last=Math.max(...cells.map(c=>c.col))+1,x=px((first+last)/2,lane),y=projection.point(0,lane+.94).y;
      const label=hazard.beatFlash>0?'重拍！':`${hazard.beatIn.toFixed(1)}s 后重拍 · 拍间可补位`,width=hazard.beatFlash>0?66:190;
      rounded(ctx,x-width/2,y-10,width,20,5,'#452048ed',hazard.beatIn<.55||hazard.beatFlash>0?'#f9c5f4':'#a96aaf');text(ctx,label,x,y,10,'#ffebff');
    }
    ctx.restore();
    const impact=strongest.f;if(impact&&!reducedMotion&&strongest.force>0){const color=BOSS_THREAT[impact.boss]?.color||'#9d64ce',edge=ctx.createRadialGradient(W/2,H/2,W*.19,W/2,H/2,W*.6);edge.addColorStop(0,'transparent');edge.addColorStop(1,color);ctx.save();ctx.globalAlpha=Math.min(.22,strongest.force*.022);ctx.fillStyle=edge;ctx.fillRect(0,0,W,H);ctx.restore();}
  }
  function showToast(message){$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=realTime+3.6;}
  function choose(kind){
    if(game.mode!=='random'&&!UNITS[kind]?.utility&&!game.deck.includes(kind)){showToast('这位同事不在本局编队中');return;}
    selected=kind;shovel=false;updateSelection();
  }
  function describe(kind){const d=UNITS[kind];if(!d)return;$('#selected-name').textContent=d.name;$('#selected-description').textContent=d.description;$('#selected-dot').style.background=d.color;}
  function updateSelection(){
    const d=UNITS[selected];$('#shovel-button').classList.toggle('active',shovel);$('#shovel-button').setAttribute('aria-pressed',String(shovel));$('.app').classList.toggle('shovel-active',shovel);$('#shovel-button .tool-caption strong').textContent=shovel?'连续撤回':'铲子';updateShovelCursor();
    $('#selected-name').textContent=shovel?'撤回角色':d?d.name:'拖动上岗';
    $('#selected-description').textContent=shovel?'连续点击角色撤回，返还投入的一半，0.5秒内可重新部署；点击空白、其他区域或再点铲子即可取消。':d?d.description:'拖动或选择角色上岗；同一格叠放同角色可升至三叠。';
    $('#selected-dot').style.background=d?.color||'#858b76';canvas.style.cursor=shovel?'none':dragging?'grabbing':selected?'crosshair':'default';
    for(const k of ORDER)cardNodes[k]?.classList.toggle('selected',selected===k);$('#jelly-button').classList.toggle('active',selected==='jelly');
  }

  function activeDialog(){return ['store','settings','guide','result','pause-cover','deck-picker','campaign-map','menu'].map(id=>$('#'+id)).find(el=>el&&!el.hidden);}
  function syncDialogs(){const active=activeDialog();$('.app').inert=!!active;for(const id of ['store','menu','campaign-map','deck-picker','result','guide','pause-cover','settings']){const el=$('#'+id);if(el)el.inert=el!==active;}}
  document.addEventListener('keydown',ev=>{
    if(ev.key!=='Tab')return;const dialog=activeDialog();if(!dialog)return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled)')].filter(el=>el.getClientRects().length);
    if(!controls.length)return;const first=controls[0],last=controls[controls.length-1],focused=document.activeElement;
    if(!controls.includes(focused)||ev.shiftKey&&focused===first){ev.preventDefault();(ev.shiftKey?last:first).focus();}
    else if(!ev.shiftKey&&focused===last){ev.preventDefault();first.focus();}
  });
  const laneBuffNodes=Array.from({length:BOARD_ROWS},(_,lane)=>{
    const group=document.createElement('div');group.className='lane-buff-group';group.dataset.lane=lane;group.setAttribute('aria-label',`第 ${lane+1} 路增益`);$('#lane-buffs').append(group);return group;
  });
  let laneBuffLayoutKey='';
  function updateLaneBuffs(){
    $('#lane-buffs').hidden=menuOpen;
    if(menuOpen||!projection)return;
    const displayScale=canvas.clientWidth/W;
    const layoutKey=`${H}:${displayScale}:${game.laneCombos.map(ids=>ids.join('|')).join(';')}`;
    if(laneBuffLayoutKey===layoutKey)return;laneBuffLayoutKey=layoutKey;
    for(let lane=0;lane<BOARD_ROWS;lane++){
      const group=laneBuffNodes[lane],ids=game.laneCombos[lane]||[],signature=ids.join('|');
      group.hidden=!ids.length;
      if(group.dataset.signature!==signature){
        group.dataset.signature=signature;group.replaceChildren();
        for(const id of ids){
          const reaction=REACTIONS.find(r=>r.id===id);if(!reaction)continue;
          const badge=document.createElement('span');badge.className='lane-buff';badge.dataset.reaction=id;badge.title=reaction.name+'：'+reaction.description;badge.setAttribute('aria-label',reaction.name+'：'+reaction.description);
          badge.innerHTML=`<span class="lane-buff-icons">${reaction.attrs.map(attributeIcon).join('')}</span><span>${reaction.name}</span>`;group.append(badge);
        }
      }
      const anchor=projection.guardPoint(lane),fontSize=parseFloat(getComputedStyle(group).fontSize);
      const rowPixels=(projection.point(0,lane+1).y-projection.point(0,lane).y)*displayScale;
      const badgeHeight=group.firstElementChild?.offsetHeight||fontSize*1.8;
      const maxRows=Math.max(1,Math.min(4,Math.floor(rowPixels/(badgeHeight+2))));
      group.style.gridTemplateRows=`repeat(${Math.max(1,Math.min(ids.length,maxRows))},auto)`;
      group.style.left=(anchor.x-42*Math.min(1.2,CH/91))/W*100+'%';
      group.style.top=(anchor.y-CH*.43)/H*100+'%';
    }
  }
  function updateHUD(){
    updateLaneBuffs();
    $('#pause-cover').hidden=game.phase!=='paused'||!$('#guide').hidden||!$('#settings').hidden||menuOpen;
    syncDialogs();
    const runStatus=$('#run-status');runStatus.hidden=menuOpen||game.endless||!game.chapter;
    runStatus.textContent=game.endless?`${game.endlessTheme} · 第 ${game.endlessPreview()[0].wave} 波 ${game.endlessPreview()[0].name}`:game.chapter?`第 ${game.stageIndex+1} 关 · ${game.chapter.name}`:'';
    $('#money').textContent=Math.floor(game.money).toLocaleString('zh-CN');
    $('#hearts').querySelectorAll('i').forEach((heart,i)=>heart.classList.toggle('empty',i>=game.hearts));$('#hearts').setAttribute('aria-label','店铺生命 '+game.hearts);$('#life-count').textContent=game.hearts+'/3';
    $('#wave-label').textContent=game.phase==='ready'?'等待值班':`第 ${game.wave} 波`;
    $('#wave-label').title=game.endless?'无尽值班':`第 ${game.wave} / ${game.maxWaves} 波`;
    $('#wave-fill').style.width=(game.endless?((game.wave-1)%ENDLESS_CYCLE_WAVES+1)/ENDLESS_CYCLE_WAVES*100:game.wave/game.maxWaves*100)+'%';
    const boss=game.enemies.find(e=>ENEMIES[e.kind].boss&&e.hp>0);$('#boss-meter').hidden=!boss;
    if(boss){
      const d=ENEMIES[boss.kind],healthPercent=Math.max(0,Math.min(100,boss.hp/boss.maxHp*100));
      $('#boss-meter-name').textContent=d.name;$('#boss-phase').textContent=boss.kind==='whale'&&(boss.openingSkillReleases||0)<2?'深海蓄势 '+(boss.openingSkillReleases||0)+'/2':boss.enraged?'第二阶段':'第一阶段';$('#boss-percent').textContent=Math.ceil(healthPercent)+'%';$('#boss-meter-fill').style.width=healthPercent+'%';
      $('#boss-health-track').setAttribute('aria-valuenow',String(Math.ceil(healthPercent)));
      $('#boss-health-track').setAttribute('aria-valuetext',`${Math.ceil(boss.hp)} / ${Math.ceil(boss.maxHp)}`);
      $('#boss-cast-warning').hidden=!(boss.windup>0);$('#boss-cast-label').textContent=boss.windup>0?`${boss.skillName}${boss.kind==='whale'&&boss.diveTarget?' · 落地成海':''} ${boss.windup.toFixed(1)}s`:'';
      $('#boss-weakness').textContent='弱势：'+d.weakness.map(id=>REACTIONS.find(r=>r.id===id)?.name).join(' / ')+(boss.windup>0?' · '+boss.skillName+' '+boss.windup.toFixed(1)+'s':boss.stunUntil>game.time?' · 硬直中':'')+(boss.comboStep?` · 连段 ${boss.comboStep.position+1}/${boss.comboStep.total} ${boss.comboStep.tier==='major'?'范围技':'小技能'}`:'')+(boss.commandAt>game.time?' · 即将号令增援':'');
      $('#boss-meter').title=`${d.name} · ${Math.ceil(boss.hp)}/${Math.ceil(boss.maxHp)} · ${$('#boss-weakness').textContent}`;
    }
    const warning=game.enemies.find(e=>e.kind==='whale'&&e.windup>0&&e.skillName==='海啸'),water=game.terrain.flat().filter(t=>t.waterUntil>game.time);
    $('#terrain-alert').hidden=game.endless||(!warning&&!water.length);$('#terrain-alert').textContent=warning?`海啸 ${warning.windup.toFixed(1)}s · 积水格受到推浪伤害`:`${water.length} 格海面 · 海月可直接攻击水底`;
    $('#pause-button').disabled=!['running','paused'].includes(game.phase)||menuOpen;$('#pause-button').setAttribute('aria-label',game.phase==='paused'?'继续':'暂停');
    $('#battle-time').textContent=String(Math.floor(game.time/60)).padStart(2,'0')+':'+String(Math.floor(game.time%60)).padStart(2,'0');
    $('#footer-stats').textContent=game.phase==='ready'?'拖动角色到格子，松手部署一次。':`收容 ${game.kills} · 弱势硬直 ${game.weakBreaks} · ${Math.floor(game.time/60)}:${String(Math.floor(game.time%60)).padStart(2,'0')} · ${game.phase==='paused'?'休息中':'值班中'}`;
    for(const k of ORDER){
      const card=cardNodes[k];if(!card)continue;const t=game.cooldowns[k],locked=!game.available.includes(k),slot=game.deck.indexOf(k);card.hidden=slot<0||game.mode==='random';card.style.order=slot;card.querySelector('.card-key').textContent=slot===9?'0':slot+1;
      card.classList.toggle('locked',locked);card.setAttribute('aria-disabled',String(locked));card.classList.toggle('poor',game.money<UNITS[k].cost);card.querySelector('.cooldown-cover').style.height=(t/UNITS[k].cooldown*100)+'%';card.querySelector('.cooldown-text').textContent=t>0?Math.ceil(t)+'s':'';
      card.setAttribute('aria-label',`${UNITS[k].name}，${ATTRIBUTES[UNITS[k].attribute].name}属性，${locked?'未招募':UNITS[k].cost+' 方斯，'+UNITS[k].role}${t>0?'，冷却中':''}`);
    }
    window.EibonEvolutionUI?.update();
    $('.deployment').classList.toggle('random-deployment',game.mode==='random');
  }

  function refreshGuideHealth(){for(const section of document.querySelectorAll('.guide-unit')){const health=section.querySelector('.guide-health');if(health)health.textContent='生命值 · '+[1,2,3].map((rank)=>['一叠','二叠','三叠'][rank-1]+' '+Math.round(window.EibonTD.unitHealth(section.dataset.kind,rank,meta)).toLocaleString('zh-CN')).join(' / ')+(meta.perks.durability?'（含制服加固）':'');}}
  function buildCards(){
    for(const [i,k] of ORDER.entries()){
      const d=UNITS[k],button=document.createElement('button');button.className='unit-card'+(d.oneShot?' one-shot':'');button.dataset.kind=k;button.title=d.name+' · '+d.description;
      button.innerHTML=`<span class="card-key">${i+1}</span><span class="avatar-window"><img class="portrait" alt="" draggable="false"></span><span class="card-details"><strong>${d.name}</strong><small>${d.role.split(' · ')[0]}</small><span class="card-cost">${attributeIcon(d.attribute)}<img class="cost-fons" src="assets/fons-ticket.png" alt="方斯">${d.cost}</span></span><span class="cooldown-cover"></span><span class="cooldown-text"></span>`;
      button.addEventListener('pointerdown',ev=>beginDrag(ev,k,button));button.addEventListener('click',ev=>{if(isReleasedDragClick(ev,button))return;describe(k);});button.addEventListener('pointerenter',()=>{if(!dragging)describe(k);});$('#cards').append(button);cardNodes[k]=button;
      const section=document.createElement('div');section.className='guide-unit';section.innerHTML=`<img class="guide-avatar" alt="${d.name}"><div><h3>${d.name}<span>${attributeIcon(d.attribute)} · ${d.role}</span></h3><p>${d.description}</p><p class="guide-health"></p></div>`;$('#guide-roster').append(section);section.dataset.kind=k;
    }
    refreshGuideHealth();
    for(const r of REACTIONS){const box=document.createElement('div');box.className='guide-reaction';box.innerHTML=`<strong>${r.name} <span class="reaction-icons">${r.attrs.map(a=>attributeIcon(a)).join('<span aria-hidden="true">＋</span>')}</span></strong><p>${r.description}</p>`;$('#guide-reactions').append(box);}
    for(const k of new Set([...Object.keys(window.EibonTD.NEW_ENCOUNTERS),...Object.keys(window.EibonTD.ELITE_MECHANICS)])){
      const d=ENEMIES[k];
      const box=document.createElement('div');box.className='guide-boss';box.dataset.kind=k;
      box.innerHTML=`<canvas width="150" height="150"></canvas><div><h3>${d.name} · ${d.rank==='elite'?'精英':'普通'}</h3><p>${d.skill}<br>生命 ${d.hp.toLocaleString('zh-CN')} · 攻击 ${d.damage}${d.armor?' · 护甲 '+d.armor:''}<br>${d.advice}</p></div>`;
      $('#guide-bosses').append(box);
    }
    for(const k of [...BOSS_ORDER,...Object.keys(ENEMIES).filter(k=>ENEMIES[k].boss&&!BOSS_ORDER.includes(k))]){const d=ENEMIES[k],box=document.createElement('div');box.className='guide-boss';box.dataset.kind=k;box.innerHTML=`<canvas width="150" height="150"></canvas><div><h3>${d.name}</h3><p>${d.skill}<br><strong>弱势：${d.weakness.map(id=>REACTIONS.find(r=>r.id===id).name).join(' / ')}</strong><br>部队：${[...new Set(d.troops)].map(t=>ENEMIES[t].name).join('、')}<br>${d.advice||''}</p></div>`;$('#guide-bosses').append(box);const option=document.createElement('option');option.value=k;option.textContent=d.name;$('#boss-choice').append(option);}
  }
  function drawPortraits(){
    for(const k of ORDER)cardNodes[k].querySelector('.portrait').src=illustratedAvatar(k);
    for(const elem of document.querySelectorAll('.guide-unit'))elem.querySelector('.guide-avatar').src=illustratedAvatar(elem.dataset.kind);
    portrait($('#jelly-icon').getContext('2d'),'jelly',2);
    for(const elem of document.querySelectorAll('.guide-boss')){const d=ENEMIES[elem.dataset.kind],c=elem.querySelector('canvas'),m=c.getContext('2d');sprite(m,d.sheet||'enemies',d.row,0,75,145,126);}
  }

  function handleEvents(){for(const e of game.drainEvents()){
    playSound(e.type==='end'?(e.won?'won':'lost'):e.type,e.kind);
    if(e.type==='wave'&&!game.endless)showToast(e.bossKind?`第 ${e.wave} 波 · ${ENEMIES[e.bossKind].name}与部队登场`:`第 ${e.wave} 波异象来了${e.wave>1?' · 波次补贴 +60':''}`);
    else if(e.type==='boss'&&!game.endless){$('#boss-banner').hidden=false;$('#boss-title').textContent=ENEMIES[e.kind].name;$('#boss-skill').textContent=ENEMIES[e.kind].skill;bossBannerUntil=game.time+2.7;}
    else if(e.type==='miniboss')showToast('强化领队来袭 · 用本关克制角色处理');
    else if(e.type==='bossDefeated'&&!game.endless)showToast(`${ENEMIES[e.kind].name}已收容！`);
    else if(e.type==='guard')showToast(`第 ${e.lane+1} 路塔吉多出动！这一趟冲完就下班。`);
    else if(e.type==='breach')showToast('有异象闯进店里！店铺生命 -1');
    else if(e.type==='support')showToast('全员支援！恢复生命，8 秒攻速提升，鬼郎丸消化完成。');
    else if(e.type==='floodWarning'&&!game.endless)showToast('海啸预警：海浪命中造成冲击伤害，积水格伤害更高；海水10秒后退去。');
    else if(e.type==='weakBreak'&&!game.endless)showToast(e.extended?'弱势环合命中！海啸预警延长，抓紧救场。':'弱势环合命中！首领硬直，下一次出招推迟。');
    else if(e.type==='platformLost')showToast('水母被破坏，上方角色退场。保留方斯重新部署。');
    else if(e.type==='catControl')showToast('猫猫薄荷命中！异象转身反攻后方怪物，持续 8 秒。');
    else if(e.type==='confused')showToast('前排中了惑音，暂时向己方反攻。伊洛伊可缩短干扰。');
    else if(e.type==='itemConsumed'){const next=window.EibonTD.normalizeMeta(meta);next.items[e.id]=Math.max(0,(next.items[e.id]||0)-1);saveMeta(next);}
    else if(e.type==='upgrade')showToast(`${UNITS[e.kind].name} · ${e.rank}叠：${UNITS[e.kind].upgrades[e.rank-1]}`);
    else if(e.type==='end')showResult(e.won);
  }}
  function showResult(won){
    const banked=window.EibonTD.settle(meta,game);saveMeta(banked.meta);
    cancelDrag();stopVoice();$('#result').hidden=false;$('#pause-cover').hidden=true;
    $('#result-title-image').textContent=won?'值班完成':'店铺失守';
    $('.result-panel').dataset.outcome=won?'won':'lost';$('.result-panel').classList.remove('has-reward');
    $('#result-eyebrow').textContent=game.endless?`无尽加班 · 击退 ${game.bossKills} 位 Boss`:won?'营业成功 · 全员打卡':'没关系，明天重新开张';
    $('#result-text').textContent=won?'店铺守住了，今天也辛苦了！':'再排一次班，重新开门。';
    const elapsed=`${Math.floor(game.time/60)}:${String(Math.floor(game.time%60)).padStart(2,'0')}`;
    $('#result-stats').innerHTML=won?`<div><small>击退异象</small><strong>${game.kills}</strong></div><div><small>值班时间</small><strong>${elapsed}</strong></div>`:`<div><small>坚持至第</small><strong>${game.wave}</strong><small>波</small></div><div><small>击退异象</small><strong>${game.kills}</strong></div>`;
    $('#result-life').innerHTML=`店铺 ${game.hearts}/3<span>${[0,1,2].map(i=>`<img src="assets/ui-icons/heart.svg" class="${i>=game.hearts?'empty':''}" alt="${i>=game.hearts?'空':'生命'}">`).join('')}</span>`;
    $('#result-crew').src=won?'assets/pop-ui-v1/result-victory-sakiri.png':'assets/atrium-v1/avatars/mint.png';
    $('#result-crew').hidden=!won;$('#result-defeat').hidden=won;
    if(won)window.EibonDefeatAnimation.stop();else window.EibonDefeatAnimation.play(reducedMotion);
    $('#recruit-reward')?.remove();$('#next-chapter')?.remove();
    if(game.endless){let best={wave:0,kills:0};try{best=JSON.parse(localStorage.getItem('eibon.endless.v1')||'null')||best;best={wave:Math.max(best.wave||0,game.wave),kills:Math.max(best.kills||0,game.kills)};localStorage.setItem('eibon.endless.v1',JSON.stringify(best));}catch{}$('#result-eyebrow').textContent=`击退 ${game.bossKills} 位首领 · 最高纪录第 ${best.wave} 波`;}
    if(game.chapter){
      const old=progress.cleared;progress=completeCampaign(progress,game);const firstClear=progress.cleared>old;
      if(firstClear){try{localStorage.setItem(SAVE_KEY,JSON.stringify(progress));saveAvailable=true;}catch{saveAvailable=false;}}
      if(won){
        const rewards=firstClear?rewardsFor(game.chapter):[],reward=rewards[0];
        $('#result-eyebrow').textContent=`第 ${game.stageIndex+1} 关 · ${game.chapter.name}`;
        $('#result-text').textContent=game.stageIndex===CAMPAIGN.length-1?'主线全部通关，准备无尽加班吧！':reward?`${rewards.map(k=>UNITS[k].name).join('、')}加入了值班队伍！`:'店铺守住了，今天也辛苦了！';
        if(!saveAvailable)$('#result-text').textContent+=' 本浏览器暂时无法保存，进度仅在本次打开期间保留。';
        if(reward){$('.result-panel').classList.add('has-reward');const box=document.createElement('div');box.id='recruit-reward';box.className='recruit-reward';for(const kind of rewards){const img=document.createElement('img');img.src=cardNodes[kind].querySelector('.portrait').src;img.alt=UNITS[kind].name;box.append(img);}const words=document.createElement('div');words.innerHTML=`<strong>新同事已招募</strong><small>已收集 ${unlockedRoster(progress).length} / ${ORDER.length}</small>`;box.append(words);$('#result-stats').before(box);}
        if(game.stageIndex<CAMPAIGN.length-1){const next=document.createElement('button');next.id='next-chapter';next.className='next-chapter brush-button';next.textContent='下一关';next.onclick=()=>newGame('campaign',game.stageIndex+1);$('.result-actions').prepend(next);}
      }
    }
    const retry=$('#retry-button');retry.textContent=won?'再值一班':'重新挑战';retry.className=$('#next-chapter')?'text-button':'big-play brush-button';$('#result-adjust').hidden=won;$('#result-home').textContent='返回主菜单';
    const deposit=document.createElement('p');deposit.className='bank-deposit';deposit.textContent=game.sandbox?'自由试验不结算存款':`可结算 ${Math.floor(banked.eligible||0)} 局内方斯 ×20 → 存入 ${banked.deposit.toLocaleString('zh-CN')} 方斯`;$('#result .bank-deposit')?.remove();$('#result-stats').after(deposit);syncDialogs();($('#next-chapter')||$('#retry-button')).focus();
  }
  let menuPaintWidth=0,menuPaintHeight=0,menuPaintImage=null;
  function renderMenu(){
    if(!menuOpen||$('#menu').hidden)return;
    const c=$('#menu-scene'),width=Math.round(c.clientWidth*devicePixelRatio),height=Math.round(c.clientHeight*devicePixelRatio),img=images['atrium-v1/menu-wallpaper'];
    if(menuPaintWidth===width&&menuPaintHeight===height&&menuPaintImage===img)return;
    c.width=width;c.height=height;const m=c.getContext('2d');m.fillStyle='#fff';m.fillRect(0,0,width,height);
    // Cover every viewport while preserving the chosen wallpaper's proportions.
    if(img){const scale=Math.max(width/img.width,height/img.height),iw=img.width*scale,ih=img.height*scale;m.drawImage(img,Math.min(0,(width-iw)/2),(height-ih)/2,iw,ih);}
    menuPaintWidth=width;menuPaintHeight=height;menuPaintImage=img;
  }
  function newGame(mode,stage){
    cancelDrag();stopVoice();if(game.phase==='running')game.pause();currentMode=mode;pendingShift={mode,stage,demo:demoUnlocked,cleared:progress.cleared,recruited:progress.recruited,meta,seed:Math.floor(Math.random()*0x7fffffff)};const candidate=new Game(pendingShift);pendingShift.available=candidate.available;pendingShift.trial=candidate.trial;pendingShift.previewBoss=['endless','random'].includes(mode)?candidate.endlessPreview()[0].boss:null;pendingShift.forecast=candidate.endless?candidate.endlessForecast(3,1):[];pendingShift.bossForecast=candidate.endless?candidate.endlessPreview(3):[];
    deckSelection=savedDeck.filter(k=>candidate.available.includes(k)).slice(0,10);for(const k of [...candidate.trial,...(candidate.chapter?.lesson?.partners||[]),...DEFAULT_DECK,...candidate.available])if(candidate.available.includes(k)&&!deckSelection.includes(k)&&deckSelection.length<10)deckSelection.push(k);for(const k of candidate.trial)if(!deckSelection.includes(k)){deckSelection.pop();deckSelection.push(k);}
    menuOpen=true;$('#menu').hidden=true;$('#campaign-map').hidden=true;$('#result').hidden=true;$('#pause-cover').hidden=true;$('#deck-picker').hidden=false;$('#boss-choice-wrap').hidden=mode!=='sandbox';if(mode!=='sandbox')$('#boss-choice').value='';
    
    $('#deck-subtitle').textContent=candidate.chapter?`第 ${candidate.stageIndex+1} 关 · ${candidate.chapter.name}：${candidate.chapter.intro}`:mode==='endless'?`${pendingShift.bossForecast.map(r=>'第 '+r.wave+' 波：'+r.name).join(' · ')}。波次连续推进，不设中途备战；本阶段首领头像显示在右上角，可随时撤回与补位。`:mode==='random'?`已招募角色随机传送，抽到的卡免费上岗；方斯用于补给。队列最多六张，波次连续推进；可随时撤回并用队列补位。第 3 波首领：${ENEMIES[pendingShift.previewBoss].name}。`:mode==='day'?'日班值班：先从两路开始，逐步守住五路，最终面对无首铁驭。':'自由试验：全角色开放，可直接选择首领练习。';buildDeck();syncDialogs();$('.deck-panel').scrollTop=0;$('#close-deck').focus({preventScroll:true});
  }
  function startShift(){
    if(!pendingShift||!deckSelection.length)return;const boss=pendingShift.mode==='sandbox'?$('#boss-choice').value:null;lastBoss=boss;savedDeck=[...deckSelection];try{localStorage.setItem('eibon.deck.v1',JSON.stringify(savedDeck));}catch{}
    game=new Game({...pendingShift,deck:deckSelection,boss});game.start();selected=null;shovel=false;speed=1;hover=null;menuOpen=false;bossBannerUntil=0;$('#boss-banner').hidden=true;$('#campaign-map').hidden=true;$('#deck-picker').hidden=true;$('#menu').hidden=true;$('#result').hidden=true;$('#speed-label').textContent='1×';
    const mode=game.mode;$('#shift-label').textContent=mode==='random'?'随机传送':mode==='endless'?'无尽加班':mode==='sandbox'?'自由试验':'主线冒险';$('#stage-label').textContent='桥间地 / 伊波恩门前';
    updateSelection();updateHUD();playSound('start');showToast(mode==='sandbox'?'自由试验：9999 方斯，点击或拖动角色上岗。':'先安排小吱与防线，12 秒后第一批异象到达。');canvas.focus({preventScroll:true});
  }
  const heroWallpapers=Object.fromEntries(ORDER.map(kind=>[kind,(window.EibonTD.NEW_HERO_KEYS?.includes(kind)?'assets/pop-ui-v2/portraits/':'assets/pop-ui-v1/portraits/')+kind+'.png']));
  const heroPreviews=new Map();
  const enemyPortraits={};
  function drawHeroShadow(source){
    const target=$('#deck-hero-shadow'),c=target.getContext('2d'),mask=document.createElement('canvas');mask.width=source.naturalWidth;mask.height=source.naturalHeight;const m=mask.getContext('2d');m.drawImage(source,0,0);
    const pixels=m.getImageData(0,0,mask.width,mask.height);let bottom=0;
    for(let n=0;n<pixels.data.length;n+=4){const a=pixels.data[n+3];pixels.data[n]=37;pixels.data[n+1]=16;pixels.data[n+2]=64;pixels.data[n+3]=a>=170?Math.round(a*.72):0;if(a>=170)bottom=Math.max(bottom,Math.floor(n/4/mask.width));}
    m.putImageData(pixels,0,0);c.clearRect(0,0,target.width,target.height);const scale=Math.min(target.width/source.naturalWidth,target.height/source.naturalHeight),left=(target.width-source.naturalWidth*scale)/2,top=(target.height-source.naturalHeight*scale)/2,floor=top+bottom*scale;
    c.save();c.globalAlpha=.24;c.filter='blur(9px)';c.translate(left+22,floor+5);c.transform(1,0,-.42,.14,0,0);c.drawImage(mask,0,-bottom*scale,mask.width*scale,mask.height*scale);c.restore();
    c.save();c.globalAlpha=.21;c.filter='blur(4px)';c.translate(left+4,floor+2);c.scale(1,.055);c.drawImage(mask,0,-bottom*scale,mask.width*scale,mask.height*scale);c.restore();
    target.dataset.kind=heroKind;
  }
  function showHero(kind){
    heroKind=kind;const d=UNITS[kind];if(!d)return;
    const wallpaper=heroWallpapers[kind],img=$('#deck-wallpaper'),heroCanvas=$('#deck-hero-sprite');
    img.style.objectPosition='center';
    const path=wallpaper;
    if(!heroPreviews.has(path)){
      const preview=new Image();preview.src=path;
      heroPreviews.set(path,preview.decode().then(()=>preview).catch(()=>{heroPreviews.delete(path);return false;}));
    }
    heroPreviews.get(path).then(loaded=>{
      if(heroKind!==kind)return;
      if(!loaded){heroCanvas.hidden=false;img.hidden=true;$('#deck-hero-shadow').getContext('2d').clearRect(0,0,640,800);portrait(heroCanvas.getContext('2d'),kind,20);return;}
      if(img.getAttribute('src')!==path)img.src=path;
      drawHeroShadow(loaded);
      img.hidden=false;
      heroCanvas.hidden=!!wallpaper;
      if(!wallpaper)portrait(heroCanvas.getContext('2d'),kind,20);
      $('#hero-name').textContent=d.name;$('#hero-role').textContent=d.role;
      $('#hero-description').textContent=d.description;$('#hero-attribute').innerHTML=attributeIcon(d.attribute);
    });
    if(!wallpaper){heroCanvas.hidden=false;img.hidden=true;portrait(heroCanvas.getContext('2d'),kind,20);$('#hero-name').textContent=d.name;$('#hero-role').textContent=d.role;$('#hero-description').textContent=d.description;$('#hero-attribute').innerHTML=attributeIcon(d.attribute);}else img.hidden=false;
    for(const card of $('#deck-roster').children)card.classList.toggle('previewed',card.dataset.kind===kind);
  }
  function toggleDeck(kind){
    showHero(kind);
    if(pendingShift?.mode==='random')return;
    if(deckSelection.includes(kind))deckSelection=deckSelection.filter(v=>v!==kind);
    else if(deckSelection.length<10)deckSelection.push(kind);
    else{$('#deck-count').textContent='已满十人，请先移出一位';return;}
    updateDeck();
  }
  function filterDeck(){
    let visible=0;for(const b of $('#deck-roster').children){b.hidden=deckFilter!=='all'&&UNITS[b.dataset.kind].attribute!==deckFilter;if(!b.hidden)visible++;}
    $('#roster-empty').hidden=visible>0;
    for(const b of $('#deck-filters').children)b.setAttribute('aria-pressed',String(b.dataset.filter===deckFilter));
  }
  function buildDeck(){
    $('#deck-roster').replaceChildren();const available=pendingShift.available;
    for(const k of ORDER){const d=UNITS[k],b=document.createElement('button');b.className='deck-card';b.dataset.kind=k;b.disabled=!available.includes(k);b.title=d.description;b.setAttribute('aria-label',d.name+'，'+d.role+'，'+(pendingShift.trial?.includes(k)&&!baseUnlockedRoster(progress,meta).includes(k)?'本关试用，':'')+(available.includes(k)?d.cost+' 方斯':'主线招募后解锁'));b.innerHTML=`<span class="avatar-window"><img class="deck-portrait" src="${cardNodes[k].querySelector('.portrait').src}" alt=""></span><span class="deck-card-frame" aria-hidden="true"></span><strong>${d.name}</strong><small>${attributeIcon(d.attribute)} <img class="cost-fons" src="assets/fons-ticket.png" alt="方斯"> ${d.cost}</small><small>${pendingShift.trial?.includes(k)&&!baseUnlockedRoster(progress,meta).includes(k)?'本关试用 · ':''}${d.role}</small>`;b.onclick=()=>toggleDeck(k);b.addEventListener('pointerenter',()=>showHero(k));b.addEventListener('focus',()=>showHero(k));$('#deck-roster').append(b);}
    filterDeck();updateDeck();showHero(pendingShift.trial?.[0]||(available.includes(heroKind)?heroKind:available[0]));
  }
  function previewBoss(){
    if(pendingShift?.mode==='sandbox')return $('#boss-choice').value||null;
    if(['endless','random'].includes(pendingShift?.mode))return pendingShift.previewBoss;
    if(pendingShift?.mode==='night')return 'whale';
    if(pendingShift?.mode==='day')return 'rider';
    return CAMPAIGN[pendingShift?.stage??0]?.boss;
  }
  function enemyPortrait(kind){
    if(enemyPortraits[kind])return enemyPortraits[kind];
    const d=ENEMIES[kind],img=d&&spriteCache[d.sheet||'enemies']?.[d.row]?.[0];if(!img)return '';
    const c=document.createElement('canvas');c.width=240;c.height=160;const m=c.getContext('2d');
    const scale=Math.min(220/img.width,145/img.height);m.drawImage(img,(240-img.width*scale)/2,155-img.height*scale,img.width*scale,img.height*scale);
    return enemyPortraits[kind]=c.toDataURL();
  }
  function renderBossCounters(bossKind){
    const panel=$('#boss-counter-check'),randomMode=pendingShift?.mode==='random';
    const advice=window.EibonTD.bossCounterReadiness(bossKind,randomMode?pendingShift.available:deckSelection,pendingShift?.available||[]);
    panel.hidden=!advice.total;if(!advice.total){panel.replaceChildren();return;}
    panel.dataset.boss=bossKind;panel.dataset.ready=String(advice.ready===advice.total);
    panel.innerHTML=`<div class="counter-heading"><strong>可选搭配</strong><span id="boss-counter-summary" role="status">${randomMode?'候选池 ':''}${advice.ready}/${advice.total} 项已携带</span></div><div class="counter-groups"></div><p id="boss-counter-note">${randomMode?'随机传送会从已招募同事中抽卡。':'克制角色更省力；也可用撤回、集火和时机应对。'}</p>`;
    advice.groups.forEach((group,index)=>{
      const row=document.createElement('div');row.className='counter-mechanism';row.dataset.counter=index;row.dataset.ready=String(group.ready);
      row.innerHTML=`<div class="counter-label"><b>${group.label}</b><span>${group.ready?(randomMode?'可传送':'已携带'):'可选'}</span></div><div class="counter-options"></div>${group.note?`<small class="counter-detail">${group.note}</small>`:''}`;
      group.choices.forEach((choice,choiceIndex)=>{
        if(choiceIndex){const or=document.createElement('span');or.className='counter-or';or.textContent='或';row.querySelector('.counter-options').append(or);}
        choice.forEach((member,memberIndex)=>{
          if(memberIndex){const plus=document.createElement('span');plus.className='counter-or';plus.textContent='+';row.querySelector('.counter-options').append(plus);}
          const d=UNITS[member.kind],state=!member.unlocked?'未招募':member.selected?(randomMode?'可传送':'已带'):'未带',button=document.createElement('button');
          button.type='button';button.className='counter-colleague';button.dataset.kind=member.kind;button.dataset.selected=String(member.selected);button.disabled=!member.unlocked;
          button.setAttribute('aria-label',`${member.selected||randomMode?'查看':'加入'}${d.name}，${group.label}，${state}`);button.title=d.description;
          button.innerHTML=`<img src="${illustratedAvatar(member.kind)}" alt=""><span>${d.name}<small>${state}</small></span>`;
          button.onclick=()=>{showHero(member.kind);if(randomMode||deckSelection.includes(member.kind))return;if(deckSelection.length>=10){$('#deck-count').textContent='已满十人，请先移出一位';$('#boss-counter-note').textContent=`编队已满，请先移出一位，再加入${d.name}。`;return;}toggleDeck(member.kind);};
          row.querySelector('.counter-options').append(button);
        });
      });
      panel.querySelector('.counter-groups').append(row);
    });
  }
  function renderEnemyIntel(){
    const bossKind=previewBoss(),boss=ENEMIES[bossKind],chapter=pendingShift?.mode==='campaign'?CAMPAIGN[pendingShift.stage]:null;
const ordinary=[...new Set(['box','bill','runner','bin','flyer','healer','shield',...Object.keys(window.EibonTD.NEW_ENCOUNTERS),...Object.keys(window.EibonTD.ELITE_MECHANICS)])];
    const extraTroops={butterfly:['butterflyEcho'],morpheus:['rearHound'],mammon:['moneyBag']}[bossKind]||[];
    const earlyWaves=pendingShift.forecast||[],kinds=[...new Set([...(bossKind?[bossKind]:[]),'box',...(earlyWaves.length?earlyWaves.flatMap(r=>r.enemies):chapter?.pool||ordinary),...(boss?.troops||[]),...extraTroops])];
    const notes={box:'成群推进。穿透与地面持续伤害适合清理密集快递。',bill:'移动较快。用减速环合延缓推进，及时补充本路输出。',bin:'高生命与物理护甲。用近战破甲、失谐或黯星处理。',runner:'高速突进。优先减速、时停或吞噬，避免漏过防线。',flyer:'飞行目标会越过地面近战。安排薄荷、娜娜莉等对空输出。',diver:'会在下潜与浮出之间切换。海月可以直接攻击水底目标。',healer:'每四秒治疗附近异象。优先集火，浊燃会削弱治疗。',shield:'具有护甲与能量盾。破甲配合卡厄斯消解护盾。',fireRunner:'快速推进的鬼火部属。用延滞或浸染压制，保护受伤前排。',chainAcolyte:'高生命精英，会在接敌后施加拘束地块。准备净化与集中输出。',petalThrall:'花园部属。利用浊燃持续削弱，阻止其成群接近前排。',echoDrone:'飞行部属。地面近战无法命中，需要远程与对空火力。',coinImp:'重甲与能量盾并存。先消解护盾，再用破甲输出击破。',debtSlip:'快速催缴部属。用延滞或单路时停留出击破时间。',dreamHound:'高生命精英猎犬，接敌更快。早雾可整吞，消化期间由真红或承伤前排保护。',prismMoth:'飞行蝶卫。配置对空输出，覆纹和创生可增强清理效率。',veilDoll:'高生命精英，会施加蛛网地块。准备烧网、净化与及时撤回。',rearHound:'从店铺后门反向突入的精英。注意经济队员和后排防线。',butterflyEcho:'蝶影幻象会分散火力。九原识破或黑羽追击可以处理。',moneyBag:'被抽走的方斯形成钱袋。击破钱袋或打出首领破绽可追回存款。'};
    const previousBoss=$('#enemy-preview').dataset.boss;$('#enemy-preview').dataset.boss=bossKind||'';
    $('#enemy-preview').replaceChildren();renderBossCounters(bossKind);if(previousBoss!==(bossKind||''))$('#enemy-preview').scrollTop=0;
    const hpScale=chapter?.hp??(pendingShift?.mode==='night'?1.08:1),bossScale=['endless','random'].includes(pendingShift?.mode)?new Game(pendingShift).endlessBalance(0,1):{health:1,damage:1};
    for(const kind of kinds){
      const d=ENEMIES[kind];if(!d)continue;
      const box=document.createElement('div');box.className='enemy-preview-card';box.dataset.enemy=kind;
      const hp=d.boss?(['endless','random'].includes(pendingShift?.mode)?Math.round((window.EibonTD.ENDLESS_BOSS_HEALTH[kind]||d.hp)*bossScale.health):d.hp):Math.round(d.hp*hpScale);
      const rank=d.boss?'首领':d.rank==='elite'?'精英':d.rank==='armored'?'重甲':d.illusion?'幻象':d.loot?'钱袋':'普通';
      const weakness=(d.weakness||[]).map(id=>REACTIONS.find(r=>r.id===id)?.name).filter(Boolean).join(' / ')||'无固定弱势';
      const threat=window.EibonTD.BOSS_THREAT[kind],attack=d.boss?`普攻 ${Math.round((threat?.normal||79)*bossScale.damage)}${threat?' · 技能基准 '+Math.round(threat.burst*.9*bossScale.damage):' · 招式见下方'}`:`攻击 ${d.damage}${d.attackInterval?' · 间隔 '+d.attackInterval+'秒':''}`;
      box.innerHTML=`<img src="${enemyPortrait(kind)}" alt="${d.name}"><strong>${d.name}</strong><small>${rank} · ${d.air?'飞行':'地面'}</small><p>生命 ${hp.toLocaleString('zh-CN')} · ${attack}${d.armor?' · 护甲 '+d.armor:''}</p><p>${d.boss?d.skill:d.advice||notes[kind]||'集中输出，及时补充受伤前排。'}</p><p>弱势：${weakness}</p>`;
      $('#enemy-preview').append(box);
    }
    const lesson=chapter?.eliteFocus?ENEMIES[chapter.eliteFocus]:null,counters=lesson?(window.EibonTD.ELITE_COUNTERS[chapter.eliteFocus]||[]).filter(k=>pendingShift.available.includes(k)).slice(0,4):[];
    $('#boss-advice').textContent=boss?`首领应对：${boss.advice||'留意出招预警，在技能间隔集中输出。'}`:chapter?`${chapter.waves} 波。${lesson?'精英重点：'+lesson.name+' · '+lesson.skill+'。建议带：'+counters.map(k=>UNITS[k].name).join('、')+'。':''}${chapter.intro}`:pendingShift?.mode==='sandbox'?'自由试验：可用全体同事练习叠卡、环合与首领应对。同格相同角色可升至三叠。':'八波值班：先建立经济与五路防线，后段会出现连续敌潮。同格叠卡可升级，预留补给方斯。';
  }
  function updateDeck(){
    const randomMode=pendingShift?.mode==='random';$('.deck-lineup .lineup-label').hidden=randomMode;$('#deck-slots').hidden=randomMode;$('#recommended-deck').hidden=randomMode;$('#deck-title').textContent=randomMode?'传送候选':'本次出勤';$('#close-deck').lastChild.textContent=randomMode?'传送候选':'战前编队';$('#deck-count').textContent=randomMode?`已招募 ${pendingShift.available.length} 位`:`已选 ${deckSelection.length} / 10`;$('#lineup-count').textContent=deckSelection.length+'/10';$('#start-shift').disabled=!deckSelection.length;
    for(const b of $('#deck-roster').children){const checked=!randomMode&&deckSelection.includes(b.dataset.kind);b.classList.toggle('checked',checked);b.setAttribute('aria-pressed',String(checked));}
    $('#deck-slots').replaceChildren();
    for(let i=0;i<10;i++){const k=deckSelection[i],slot=document.createElement('button');slot.className='deck-slot'+(k?'':' empty');slot.dataset.kind=k||'';slot.disabled=!k;if(k){slot.setAttribute('aria-label','移出'+UNITS[k].name);slot.title='移出'+UNITS[k].name;slot.innerHTML=`<img src="${cardNodes[k].querySelector('.portrait').src}" alt=""><span>${i+1}</span>`;slot.onclick=()=>toggleDeck(k);slot.addEventListener('pointerenter',()=>showHero(k));}else{slot.textContent=String(i+1);slot.setAttribute('aria-label','空出战位 '+(i+1));}$('#deck-slots').append(slot);}
    const attrs=new Set(deckSelection.filter(k=>!UNITS[k].oneShot).map(k=>UNITS[k].attribute));$('#reaction-preview').replaceChildren();const note=document.createElement('span');note.textContent='同路环合';$('#reaction-preview').append(note);
    for(const r of REACTIONS.filter(r=>r.attrs.every(a=>attrs.has(a)))){const chip=document.createElement('span');chip.className='reaction-chip';chip.title=r.description;chip.innerHTML=r.name+' '+r.attrs.map(a=>attributeIcon(a)).join('');$('#reaction-preview').append(chip);}
    renderEnemyIntel();
  }
  function openMenu(){cancelDrag();stopVoice();menuOpen=true;if(game.phase==='running')game.pause();$('#menu').hidden=false;$('#result').hidden=true;$('#guide').hidden=true;$('#campaign-map').hidden=true;$('#deck-picker').hidden=true;$('#settings').hidden=true;updateCampaignMenu();updateHUD();$('#quick-start-button').focus();}

  function updateCampaignMenu(){
    $('#day-button span').textContent=progress.cleared?'继续主线':'主线冒险';
    $('#day-button small').textContent=`${progress.cleared} / ${CAMPAIGN.length}`;
    $('#day-button').title=`主线进度 ${progress.cleared} / ${CAMPAIGN.length}，已收集 ${unlockedRoster(progress).length} / ${ORDER.length} 位同事`;
    $('#loading-status').textContent='';
  }
  function openCampaign(){
    openMenu();$('#campaign-map').hidden=false;
    $('#campaign-count').textContent=`${progress.cleared} / ${CAMPAIGN.length}`;
    $('#campaign-progress').textContent=demoUnlocked?CAMPAIGN.length+' 个关卡全部开放 · 演示可用全体同事':CAMPAIGN.length+' 个关卡 · 招募同事，为无尽与随机传送做好准备';
    $('#chapter-list').replaceChildren();
    CAMPAIGN.forEach((stage,i)=>{const b=document.createElement('button');b.className='chapter-card'+(i>=15?' added-chapter':'')+(i<progress.cleared?' cleared':i===progress.cleared?' current':'');b.disabled=!demoUnlocked&&i>progress.cleared;b.dataset.chapter=i;const rewards=rewardsFor(stage);b.title=`${i<progress.cleared?'已通关':i===progress.cleared?'下一关':demoUnlocked?'演示开放':'未开放'} · ${stage.waves} 波。${stage.intro}${rewards.length?' 胜利招募：'+rewards.map(k=>UNITS[k].name).join('、'):''}`;b.setAttribute('aria-label',`第 ${i+1} 关，${stage.name}，${i<progress.cleared?'已通关':i===progress.cleared||demoUnlocked?'可挑战':'未开放'}`);b.innerHTML=`<span class="chapter-number">${String(i+1).padStart(2,'0')}</span><strong>${stage.name}</strong><small>${i<progress.cleared?'已通关':i===progress.cleared?'当前关卡':demoUnlocked?'演示开放':'尚未开放'} · ${stage.waves} 波${rewards.length?' · 招募 '+rewards.map(k=>UNITS[k].name).join('、'):''}</small>`;const arrow=$('#day-button .menu-arrow').cloneNode(true);arrow.removeAttribute('class');arrow.classList.add('chapter-arrow');b.append(arrow);b.onclick=()=>newGame('campaign',i);$('#chapter-list').append(b);});
    $('#save-note').textContent=demoUnlocked?'演示开放不改变通关记录，所有关卡均可直接试玩。':saveAvailable?'胜利后自动保存。已通关的关卡可重复挑战。':'当前无法保存，进度仅在本次打开期间保留。';
    syncDialogs();$('#close-campaign').focus();
  }
  function togglePause(){if(menuOpen||!$('#guide').hidden||!$('#settings').hidden||!$('#result').hidden)return;cancelDrag();if(game.pause()){stopVoice();updateHUD();(game.phase==='paused'?$('#resume-button'):canvas).focus({preventScroll:true});}}
  function getPoint(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};}
  function getCell(p){return projection.cellAt({x:p.x-cameraOffset.x,y:p.y-cameraOffset.y});}
  function actAtCell(cell){if(menuOpen||!['running','preparing'].includes(game.phase))return;
    if(shovel){const removed=cell&&game.remove(cell.lane,cell.col);if(!removed){playSound('shovelSelect');if(cell)showToast('空格 · 已收起铲子');shovel=false;hover=null;}else{hover={...cell};keyboardCell={...cell};}updateSelection();}
    else if(!cell)return;
    else if(selected){const result=selected.startsWith('item:')?game.useItem(selected.slice(5),cell.lane,cell.col+.5):game.place(selected,cell.lane,cell.col);if(!result.ok){showToast(result.error);playSound('invalid');}else{keyboardCell={...cell};selected=null;hover=null;updateSelection();}}
    updateHUD();handleEvents();
  }
  function beginDrag(ev,kind,button){
    if(ev.button!==0||dragging||menuOpen||!['running','preparing'].includes(game.phase))return;
    if(!UNITS[kind].utility&&!game.deck.includes(kind)){showToast('这位同事不在本局编队中');playSound('invalid');return;}
    describe(kind);if(game.cooldowns[kind]>0){showToast('角色还在准备中');playSound('invalid');return;}if(game.money<UNITS[kind].cost){showToast('方斯不够，先让小吱赚一点');playSound('invalid');return;}
    ev.preventDefault();selected=kind;shovel=false;dragging={kind,id:ev.pointerId,button,startX:ev.clientX,startY:ev.clientY,moved:false};
    try{button.setPointerCapture(ev.pointerId);}catch{}
    button.classList.add('dragging');$('#drag-ghost').hidden=false;portrait($('#drag-ghost canvas').getContext('2d'),kind,12);moveDrag(ev);updateSelection();playSound('pickup');
  }
  function moveDrag(ev){if(!dragging||ev.pointerId!==dragging.id)return;
    if(Math.hypot(ev.clientX-dragging.startX,ev.clientY-dragging.startY)>6)dragging.moved=true;
    hover=getCell(getPoint(ev));const ghost=$('#drag-ghost'),point=window.EibonLayout.point(ev.clientX,ev.clientY);ghost.style.left=point.x+'px';ghost.style.top=(point.y-(ev.pointerType==='touch'?32:0))+'px';
    const error=hover?game.canPlace(dragging.kind,hover.lane,hover.col):null;ghost.classList.toggle('invalid',!!error);ghost.classList.toggle('over-board',!!hover);
    ghost.querySelector('span').textContent=error|| (hover?'松手上岗':'拖到空格');
  }
  function cancelDrag(preserveSelection=false){if(dragging){const {button,id}=dragging;dragging=null;button.classList.remove('dragging');try{if(button.hasPointerCapture(id))button.releasePointerCapture(id);}catch{}}
    $('#drag-ghost').hidden=true;if(!preserveSelection)selected=null;hover=null;updateSelection();
  }
  window.addEventListener('pointermove',moveDrag);
  window.addEventListener('pointerup',ev=>{if(!dragging||ev.pointerId!==dragging.id)return;const cell=getCell(getPoint(ev)),moved=dragging.moved;if(moved)dragClickTimes.set(dragging.button,ev.timeStamp);if(moved&&cell)actAtCell(cell);else if(moved)playSound('cancel');cancelDrag(!moved);});
  window.addEventListener('pointercancel',()=>cancelDrag());window.addEventListener('blur',()=>cancelDrag());
  document.addEventListener('pointerdown',ev=>{if(shovel&&ev.target instanceof Element&&ev.target!==canvas&&!ev.target.closest('#shovel-button')){shovel=false;hover=null;updateSelection();}},{capture:true});
  $('#cards').addEventListener('lostpointercapture',()=>{if(dragging)cancelDrag();});
  canvas.addEventListener('pointermove',ev=>{if(!dragging)hover=shovel||selected?getCell(getPoint(ev)):null;});canvas.addEventListener('pointerleave',()=>{if(!dragging)hover=null;});
  canvas.addEventListener('pointerdown',ev=>{
    if(menuOpen||!['running','preparing'].includes(game.phase))return;const p=getPoint(ev),cell=getCell(p);
    const coin=game.coins.find(c=>Math.hypot(p.x-px(c.x,c.lane),p.y-(mid(c.lane)-9))<23);
    if(coin&&!selected&&!shovel){game.collect(coin.id);handleEvents();updateHUD();return;}
    if(shovel||selected)actAtCell(cell);
    else if(cell){const helper=game.units.find(u=>u.hp>0&&['iroi','fadeya'].includes(u.kind)&&u.lane===cell.lane&&u.col===cell.col);if(helper)helper[helper.kind==='iroi'?'healRangeUntil':'anchorRangeUntil']=game.time+4;}
    canvas.focus({preventScroll:true});
  });
  window.addEventListener('keydown',ev=>{
    if(ev.target instanceof Element&&ev.target.matches('input,select,textarea'))return;
    if(ev.code==='Escape'){cancelDrag();if(!$('#settings').hidden){closeSettings();return;}if(!$('#deck-picker').hidden){pendingShift?.mode==='campaign'?openCampaign():openMenu();return;}if(!$('#campaign-map').hidden){openMenu();return;}if(!$('#guide').hidden){closeGuide();return;}if(game.phase==='paused'&&!menuOpen){togglePause();return;}if(!menuOpen){selected=null;shovel=false;updateSelection();}return;}
    if(menuOpen||!$('#guide').hidden||!$('#settings').hidden||!$('#result').hidden)return;
    if(ev.code==='Space'){ev.preventDefault();togglePause();}
    else if(/^[0-9]$/.test(ev.key)){const kind=game.deck[ev.key==='0'?9:Number(ev.key)-1];if(kind){cancelDrag();choose(kind);hover={...keyboardCell};canvas.focus({preventScroll:true});}}
    else if(ev.key.toLowerCase()==='j'){cancelDrag();selected='item:cat';hover={...keyboardCell};canvas.focus({preventScroll:true});}
    else if(ev.key.toLowerCase()==='r'&&!ev.repeat){toggleShovel();}
    else if(ev.key.toLowerCase()==='c'){game.collectAll();handleEvents();updateHUD();}
    else if(ev.key.startsWith('Arrow')){ev.preventDefault();keyboardCell.col=Math.max(0,Math.min(BOARD_COLS-1,keyboardCell.col+(ev.key==='ArrowRight'?1:ev.key==='ArrowLeft'?-1:0)));keyboardCell.lane=Math.max(0,Math.min(4,keyboardCell.lane+(ev.key==='ArrowDown'?1:ev.key==='ArrowUp'?-1:0)));hover={...keyboardCell};}
    else if(ev.key==='Enter'&&document.activeElement===canvas){ev.preventDefault();actAtCell(keyboardCell);}
  });
  $('#quick-start-button').onclick=()=>progress.cleared<CAMPAIGN.length?newGame('campaign',progress.cleared):newGame('endless');
  $('#day-button').onclick=openCampaign;$('#close-campaign').onclick=openMenu;$('#night-button').onclick=()=>newGame('random');$('#sandbox-button').onclick=()=>newGame('sandbox');$('#endless-button').onclick=()=>newGame('endless');
  $('#campaign-endless-button').onclick=()=>newGame('endless');
  const backArrow=$('#day-button .menu-arrow').cloneNode(true);backArrow.classList.add('back-arrow');$('#close-campaign span').replaceWith(backArrow);
  $('#start-shift').onclick=startShift;$('#close-deck').onclick=()=>pendingShift?.mode==='campaign'?openCampaign():openMenu();$('#boss-choice').onchange=updateDeck;
  $('#recommended-deck').onclick=()=>{
    const boss=previewBoss(),chapter=pendingShift?.mode==='campaign'?CAMPAIGN[pendingShift.stage]:null;
    const priority=boss==='whale'?['chiz','mint','skia','iroi','haiyue','adler','nanally','requiem','xun','crimson']:boss==='bird'||boss==='butterfly'?['chiz','mint','nanally','requiem','adler','haiyue','iroi','skia','xun','crimson']:[...DEFAULT_DECK,'mintCat','xun','crimson'];
    deckSelection=!boss&&(chapter?.lesson||chapter?.encounters?.some(k=>window.EibonTD.ELITE_MECHANICS[k]))?window.EibonTD.eliteRecommendedDeck(pendingShift.stage,pendingShift.available):[...new Set(priority.filter(k=>pendingShift.available.includes(k)))].slice(0,10);buildDeck();
  };
  $('#jelly-button').hidden=true;
  $('#pause-button').onclick=togglePause;$('#resume-button').onclick=togglePause;
  $('#pause-restart').onclick=()=>newGame(currentMode,game.stageIndex);$('#pause-home').onclick=openMenu;$('#battle-menu-button').onclick=openMenu;$('#result-adjust').onclick=()=>newGame(currentMode,game.stageIndex);
  $('#speed-button').onclick=()=>{speed=speed===1?2:1;$('#speed-label').textContent=speed+'×';};
  $('#collect-button').onclick=()=>{game.collectAll();handleEvents();updateHUD();};
  function updateShovelCursor(){const ghost=$('#shovel-cursor');ghost.hidden=!shovel||!shovelPointer||menuOpen||!['running','preparing'].includes(game.phase);if(!ghost.hidden){const point=window.EibonLayout.point(shovelPointer.x,shovelPointer.y);ghost.style.left=point.x+'px';ghost.style.top=point.y+'px';}}
  document.addEventListener('pointermove',ev=>{shovelPointer=ev.pointerType==='touch'?null:{x:ev.clientX,y:ev.clientY};updateShovelCursor();});
  document.addEventListener('pointerleave',()=>{shovelPointer=null;updateShovelCursor();});
  function toggleShovel(){if(menuOpen||!['running','preparing'].includes(game.phase))return;cancelDrag();shovel=!shovel;updateSelection();playSound('shovelSelect');}
  $('#shovel-button').onclick=toggleShovel;
  $('#home-button').onclick=openMenu;$('#result-home').onclick=openMenu;$('#retry-button').onclick=()=>newGame(currentMode,game.stageIndex);
  function persistPreferences(){try{localStorage.setItem('eibon.preferences.v1',JSON.stringify({audioEnabled,musicLevel,musicLevelVersion:2,reducedMotion}));}catch{$('#settings-note').textContent='当前无法保存，设置仅在本次打开期间生效。';}}
  if(preferences.musicLevelVersion!==2)persistPreferences();
  function updateSoundControls(){
    $('#sound-button').textContent='声音 '+(audioEnabled?'开':'关');$('#sound-button').setAttribute('aria-pressed',String(audioEnabled));
    $('#pause-sound').innerHTML=`<img src="assets/ui-icons/${audioEnabled?'volume':'mute'}.svg" alt="">声音 ${audioEnabled?'开':'关'}`;$('#pause-sound').setAttribute('aria-pressed',String(audioEnabled));
    $('#settings-sound').textContent=audioEnabled?'开启':'关闭';$('#settings-sound').setAttribute('aria-pressed',String(audioEnabled));
  }
  $('#sound-button').onclick=()=>{audioEnabled=!audioEnabled;updateSoundControls();persistPreferences();if(audioEnabled){unlockMusic();playSound('coin');}else{stopVoice();music?.pause();}};
  updateSoundControls();
  $('#pause-sound').onclick=()=>$('#sound-button').click();
  $('#guide-button').onclick=()=>{cancelDrag();guidePaused=game.phase==='running';if(guidePaused)game.pause();stopVoice();$('#guide').hidden=false;syncDialogs();$('#close-guide').focus();updateHUD();};
  $('#menu-guide-button').onclick=()=>$('#guide-button').click();
  $('#battle-rules-button').onclick=()=>$('#guide-button').click();
  function closeGuide(){$('#guide').hidden=true;if(guidePaused&&game.phase==='paused')game.pause();guidePaused=false;updateHUD();(menuOpen?$('#menu-guide-button'):canvas).focus({preventScroll:true});}
  $('#close-guide').onclick=closeGuide;
  let settingsPaused=false;
  function closeSettings(){
    $('#settings').hidden=true;if(settingsPaused&&game.phase==='paused')game.pause();settingsPaused=false;updateHUD();$('#menu-settings-button').focus();
  }
  $('#menu-settings-button').onclick=()=>{settingsPaused=game.phase==='running';if(settingsPaused)game.pause();$('#settings').hidden=false;syncDialogs();$('#close-settings').focus();};
  $('#close-settings').onclick=closeSettings;$('#settings-sound').onclick=()=>$('#sound-button').click();
  $('#music-volume').value=Math.round(musicLevel*100);$('#music-volume-value').textContent=Math.round(musicLevel*100)+'%';
  $('#music-volume').oninput=ev=>{musicLevel=Number(ev.target.value)/100;$('#music-volume-value').textContent=ev.target.value+'%';persistPreferences();};
  function updateMotionControl(){$('#settings-motion').textContent=reducedMotion?'开启':'关闭';$('#settings-motion').setAttribute('aria-pressed',String(reducedMotion));document.body.classList.toggle('reduce-motion',reducedMotion);}
  $('#settings-motion').onclick=()=>{reducedMotion=!reducedMotion;updateMotionControl();persistPreferences();};updateMotionControl();
  function syncFullscreenControl(){
    const active=!!document.fullscreenElement;
    $('#fullscreen-button').setAttribute('aria-pressed',String(active));
    $('#fullscreen-label').textContent=active?'退出全屏':'全屏';
  }
  document.addEventListener('fullscreenchange',syncFullscreenControl);
  $('#fullscreen-button').onclick=async()=>{
    $('#fullscreen-note').textContent='';
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{$('#fullscreen-note').textContent='当前窗口不支持全屏，请使用浏览器全屏。';}
    syncFullscreenControl();
  };
  syncFullscreenControl();
  for(const button of document.querySelectorAll('[data-guide-tab]'))button.onclick=()=>{for(const tab of document.querySelectorAll('[data-guide-tab]'))tab.setAttribute('aria-pressed',String(tab===button));for(const panel of document.querySelectorAll('[data-guide-panel]'))panel.hidden=panel.dataset.guidePanel!==button.dataset.guideTab;};
  for(const [key,label] of [['all','全部'],...Object.entries(ATTRIBUTES).map(([k,d])=>[k,d.name])]){const b=document.createElement('button');b.dataset.filter=key;b.innerHTML=(key==='all'?'':attributeIcon(key))+label;b.setAttribute('aria-pressed',String(key==='all'));b.onclick=()=>{deckFilter=key;filterDeck();};$('#deck-filters').append(b);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.phase==='running'){cancelDrag();game.pause();stopVoice();updateHUD();}});
  document.addEventListener('eibon-host-pause',()=>{cancelDrag();if(game.phase==='running')game.pause();stopVoice();music?.pause();for(const track of fadingMusic)track.pause();menuVideo.pause();updateHUD();});
  function animate(now){
    // High-refresh displays should not multiply simulation and canvas work above 60 Hz.
    if(last&&now-last<1000/60-.5){requestAnimationFrame(animate);return;}
    const dt=Math.min(.1,(now-(last||now))/1000);last=now;realTime=now/1000;fadeMusic(dt);
    if(!menuOpen&&ready){const started=performance.now(),steps=speed===2?2:1;for(let i=0;i<steps;i++)game.tick(dt);handleEvents();renderStats.tickMs=renderStats.tickMs*.95+(performance.now()-started)*.05;}
    if(toastTimer&&realTime>toastTimer){$('#toast').classList.remove('show');toastTimer=0;}
    if(bossBannerUntil&&game.time>bossBannerUntil){$('#boss-banner').hidden=true;bossBannerUntil=0;}
    if(now-hudTimer>100){updateHUD();syncMusic();syncMenuVideo();hudTimer=now;}
    const paintKey=`${game.phase}:${game.time}:${canvas.width}:${canvas.height}:${selected}:${shovel}:${hover?.lane}:${hover?.col}:${reducedMotion}`;
    if(!menuOpen&&(game.phase==='running'||lastPaintGame!==game||lastPaintKey!==paintKey)){const started=performance.now();render();renderStats.renderMs=renderStats.renderMs*.95+(performance.now()-started)*.05;lastPaintKey=paintKey;lastPaintGame=game;}renderMenu();requestAnimationFrame(animate);
  }
  window.EibonUI={getGame:()=>game,getMeta:()=>meta,getProgress:()=>progress,getReady:()=>ready,isMenu:()=>menuOpen,setMeta:saveMeta,toast:showToast,refresh:()=>{updateSelection();updateHUD();},syncDialogs,select:(kind,queueId=null)=>{game.queueSelected=queueId;selected=kind;shovel=false;updateSelection();},portrait:portraitURL,enemyPortrait,end:()=>{if(game.cashOut())handleEvents();},home:openMenu,newGame,loadSheet:loadOptionalSheet};
  buildCards();window.EibonEvolutionUI?.init(window.EibonUI);updateSelection();updateHUD();requestAnimationFrame(animate);
  const assets=[...Object.keys(atlas).filter(k=>!k.startsWith('v2/hero-')||k.endsWith('-base')||k==='v2/hero-crimson-hot'),...(window.EIBON_V3_ENVIRONMENT_ASSETS||[]),...ORDER.map(k=>illustratedAvatar(k).slice(7,-4)),'boss-impact-fx-v01','boss-ground-fx-v02','boss-falling-fx-v01','terrain-water-fire-v01','boss-debuff-terrain-v01','sea-surface-v02','tsunami-front-v02','atrium-v1/battle-shop','flower-fx-v01','fons-ticket','atrium-v1/menu-wallpaper'];let loaded=0;
    Promise.all(assets.map(name=>new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{images[name]=img;loaded++;window.EibonLoading?.images(loaded,assets.length);$('#loading-status').textContent=`同事到岗 ${loaded} / ${assets.length}`;resolve();};img.onerror=()=>{if(name.startsWith('atrium-v1/avatars/')){loaded++;window.EibonLoading?.images(loaded,assets.length);resolve();}else reject(new Error('素材加载失败：'+name));};img.src='assets/'+(name==='street'?'street-v06':name)+'.png';}))).then(()=>{
    prepareSprites();ready=true;drawPortraits();updateCampaignMenu();for(const id of ['quick-start','day','night','sandbox','endless'])$('#'+id+'-button').disabled=false;
    window.EibonLoading?.ready();$('#menu').focus({preventScroll:true});
  }).catch(err=>{window.EibonLoading?.fail('游戏素材加载失败，请检查网络后重试。');$('#loading-status').textContent=err.message+'。请刷新重试，或检查游戏素材是否完整。';console.error(err);});
  // Read-only runtime snapshot for meaningful integration checks and future bug reports.
  window.eibonDebug={snapshot:()=>({
    phase:game.phase,mode:game.mode,time:game.time,money:game.money,hearts:game.hearts,version:window.EibonTD.VERSION,environment:game.environment,formationSwaps:game.formationSwaps,changedSlots:[...game.changedSlots],queue:game.queue.map(q=>({...q})),inventory:{...game.inventory},itemsUsed:{...game.itemsUsed},meta:window.EibonTD.normalizeMeta(meta),bosses:game.bossStates(),performance:{...renderStats},
    wave:game.wave,maxWaves:game.maxWaves,kills:game.kills,deck:[...game.deck],available:[...game.available],
    units:game.units.map(u=>({kind:u.kind,companion:UNITS[u.kind].companion||null,artwork:unitArtwork(u.kind,u),pose:nativeUnitPose(u),renderHeight:unitHeight(u.kind,u.lane),lane:u.lane,col:u.col,hp:u.hp,maxHp:u.maxHp,rank:u.rank,heat:u.heat,hotRemaining:Math.max(0,(u.hotUntil||0)-game.time),transformed:isCrimsonTransformed(u),attackFormRemaining:Math.max(0,(u.attackFormUntil||0)-game.time),attackCount:u.attackCount,sealedRemaining:Math.max(0,(u.sealedUntil||0)-game.time),antihealRemaining:Math.max(0,(u.antihealUntil||0)-game.time),resistRemaining:Math.max(0,(u.resistUntil||0)-game.time),digest:u.digest,pendingCast:u.pendingCast?.kind,catState:u.catState,confusedUntil:u.confusedUntil,sleepRemaining:Math.max(0,(u.sleepUntil||0)-game.time),duelStacks:u.duelStacks||0,attackSpeedBonus:u.kind==='daffodil'?(u.duelStacks||0)*UNITS.daffodil.comboStep:0,healRangeRemaining:Math.max(0,(u.healRangeUntil||0)-game.time)})),
    enemies:game.enemies.map(e=>({kind:e.kind,lane:e.lane,x:e.x,hp:e.hp,maxHp:e.maxHp,armor:e.armor,mobCast:e.mobCast?{type:e.mobCast.type,remaining:e.mobCast.remaining}:null,mobChannel:e.mobChannel?{label:e.mobChannel.label,remaining:e.mobChannel.remaining}:null,followUp:!!e.mobFollowUp,slashCount:e.mobSlashCount||0,paintWard:!!e.paintWardActive,energyShield:e.energyShield||0,blinkUsed:!!e.blinkUsed,rushRemaining:e.mobRushRemaining||0,windup:e.windup,skill:e.skillName,skillFamily:e.skillFamily,motion:e.motion,motionActive:e.motionUntil>game.time,normalCast:!!e.normalCast,summoning:e.summonUntil>game.time,enraged:e.enraged,submerged:game.isSubmerged(e),troopOrder:game.troopOrder(e)?.name||null,orderRemaining:Math.max(0,(e.orderUntil||0)-game.time),summonerId:e.summonerId,controlled:!!e.controlCat,stunUntil:e.stunUntil,status:{...e.status}})),
    guards:game.guards.map(g=>({state:g.state,lane:g.lane,swimming:g.swimming})),
    platforms:game.platforms.map(p=>({lane:p.lane,col:p.col,hp:p.hp})),
    water:game.terrain.map(row=>row.map(t=>Math.max(0,t.waterUntil-game.time))),
    floodWarnings:game.floodWarnings.map(w=>({cells:w.cells,remaining:w.at-game.time})),
    hazards:game.hazards.map(h=>({kind:h.kind,cells:h.cells,beatIn:h.beatIn,beatFlash:h.beatFlash})),combos:game.laneCombos.map(c=>[...c]),
    drowned:game.drowned,healing:game.healing,weakBreaks:game.weakBreaks,
    assetsReady:ready,selected,speed,freezeRemaining:Math.max(0,game.freezeUntil-game.time),laneFreezeRemaining:game.laneFreezeUntil.map(until=>Math.max(0,until-game.time)),
    cooldowns:{...game.cooldowns},effects:game.effects.map(f=>f.kind),projectiles:game.projectiles.map(p=>({kind:p.kind,lane:p.lane,x:p.x,sourceId:p.sourceId,targetId:p.targetId})),
    presentation:{camera:{...cameraOffset},reducedMotion,fxLoaded:['boss-impact-fx-v01','boss-ground-fx-v02','boss-falling-fx-v01'].every(k=>!!images[k]),fxDirection:{normal:'boss-to-target',skill:'vertical-drop-to-locked-area'},bossBodies:game.enemies.filter(e=>ENEMIES[e.kind].boss).map(e=>({kind:e.kind,sheet:ENEMIES[e.kind].sheet,row:ENEMIES[e.kind].row,pose:nativeBossPose(e),bounds:bossBodyBounds.get(e.id)||null,gait:bossLocomotion(e),blend:e.travelBlend||0,phase:e.travelPhase||0,renderHeight:enemyHeight(e),renderX:enemyVisualX(e),cellHeight:CH})),terrainLoaded:!!images['terrain-water-fire-v01'],debuffTextures:{loaded:!!images['boss-debuff-terrain-v01'],kinds:Object.keys(DEBUFF_TEXTURES),active:[...new Set(game.hazards.map(h=>h.kind))]},impacts:game.effects.filter(f=>f.kind==='bossPulse').map(f=>({boss:f.boss,normal:!!f.normal,flood:!!f.flood,remaining:f.ttl,total:f.total}))},
    music:{path:musicPath,playing:!!music&&!music.paused,volume:music?.volume||0,currentTime:music?.currentTime||0,duration:Number.isFinite(music?.duration)?music.duration:null}
  }),get board(){return {...B,cellW:CW,cellH:CH,width:W,height:H,corners:projection.corners(0,BOARD_COLS,0,BOARD_ROWS),cells:Array.from({length:BOARD_ROWS},(_,lane)=>Array.from({length:BOARD_COLS},(_,col)=>projection.point(col+.5,lane+.5)))};}};
})();

