/* Feature-local presentation for the version 3 rules. */
(function(root){
  'use strict';
  const A=root.EibonTD,$=s=>document.querySelector(s);let ui=null,lastQueue='',lastItems='',lastLesson='',lastStageBosses='',lessonUntil=0;
  const HINT_MS=8000;
  function hintVisibility(g){$('#lesson-intel').hidden=ui.isMenu()||!g.chapter?.lesson||performance.now()>=lessonUntil;}
  const fmt=n=>Math.floor(n).toLocaleString('zh-CN');
  const statusDefs=[['sleepUntil','沉睡','#9984b0'],['confusedUntil','惑音','#bd86a2'],['sealedUntil','封技','#a392b9'],['antihealUntil','禁疗','#c990aa'],['burnUntil','灼烧','#b9957d']];
  function init(bridge){ui=bridge;
    const shop=document.createElement('button');shop.id='menu-store-button';shop.innerHTML='<img src="assets/ui-icons/shopping-bag.svg" alt=""><span>商店</span><small id="menu-bank" aria-label="存款方斯">0</small>';shop.onclick=openStore;$('.menu-utilities').append(shop);
    const store=document.createElement('div');store.id='store';store.hidden=true;store.className='overlay full-overlay';store.setAttribute('role','dialog');store.setAttribute('aria-modal','true');store.setAttribute('aria-labelledby','store-title');store.innerHTML='<section class="store-panel"><header><button id="close-store" class="back-button"><img src="assets/ui-icons/arrow-left.svg" alt="">返回</button><h2 id="store-title">伊波恩补给商店</h2><div class="bank-balance"><small>存款方斯</small><strong id="store-bank">0</strong></div></header><div id="store-products"></div><p class="store-note" title="初始周转资金不计入结算；自由试验不产生存款。猫猫每局最多两次，强化与零永久保留。">本局剩余方斯 ×20 存入银行 · 道具随下一局带入</p></section>';document.body.append(store);$('#close-store').onclick=closeStore;
    $('#night-button').innerHTML='<img src="assets/ui-icons/infinity.svg" alt="">随机传送';
    $('.deck-bottom > p').textContent='同一格叠放相同角色可升至三叠 · 猫猫改为限量道具';
    const conveyor=document.createElement('div');conveyor.id='conveyor';conveyor.hidden=true;conveyor.innerHTML='<div class="conveyor-heading"><strong>随机传送</strong><span id="queue-clock"></span><small>抽到免费 · 手动布阵</small></div><div id="conveyor-cards"></div>';$('#cards').after(conveyor);
    const items=document.createElement('div');items.id='battle-items';items.innerHTML='<button id="supply-button" title="用局内方斯购买应急补给">补给</button>';$('.tool-cards').append(items);
    const supply=document.createElement('div');supply.id='supply-panel';supply.hidden=true;supply.innerHTML='<strong>局内补给</strong><div id="item-slots" aria-label="本局持有补给"></div><button data-supply="medkit">医疗 · 125</button><button data-supply="cleanse">消解 · 100</button><button data-supply="lamp">照明 · 75</button><small>消耗局内方斯，购买后本局使用</small>';$('.app').append(supply);$('#supply-button').onclick=()=>{$('#supply-panel').hidden=!$('#supply-panel').hidden;};for(const b of supply.querySelectorAll('[data-supply]'))b.onclick=()=>{const result=ui.getGame().supply(b.dataset.supply);ui.toast(result.ok?'补给已加入本局背包':result.error);update();};
    const bosses=document.createElement('div');bosses.id='stage-boss-portraits';bosses.hidden=true;bosses.setAttribute('aria-label','本阶段首领');$('#stage').append(bosses);
    const recall=document.createElement('button');recall.id='battle-intel-button';recall.className='square-button';recall.textContent='教学';recall.title='重新查看本关角色教学';recall.onclick=()=>{lessonUntil=performance.now()+HINT_MS;hintVisibility(ui.getGame());};$('.dashboard .battle-controls').prepend(recall);
    const lesson=document.createElement('details');lesson.id='lesson-intel';lesson.hidden=true;lesson.open=true;lesson.innerHTML='<summary></summary><p></p>';$('#stage').append(lesson);
    const cash=document.createElement('button');cash.id='cashout-button';cash.className='text-button';cash.textContent='收工结算';cash.onclick=()=>ui.end();$('.pause-actions').append(cash);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#store').hidden){e.stopImmediatePropagation();closeStore();}},true);
    window.setInterval(()=>hintVisibility(ui.getGame()),250);
    update();
  }
  function openStore(){if(!ui.getReady())return;$('#store').hidden=false;renderStore();ui.syncDialogs();$('#close-store').focus();}
  function closeStore(){$('#store').hidden=true;ui.syncDialogs();$('#menu-store-button').focus();}
  function productArt(id){return '<img class="product-picture" src="assets/pop-ui-v2/shop-'+id+'.png" alt="">';}
  const shopCopy={cat:'使敌人反攻8秒 · 每局限两次',medkit:'全队回复35%生命',cleanse:'解除负面状态 · 抗性4秒',lamp:'识破幻象 · 驱散遮蔽10秒',reserve:'每级开局增加50方斯',durability:'每级角色生命增加5%',zero:'四连斩 · 群攻助手'};
  function renderStore(){const m=ui.getMeta();$('#store-bank').textContent=fmt(m.bank);$('#store-products').replaceChildren();for(const [id,s] of Object.entries(A.STORE)){const owned=s.type==='item'?m.items[id]||0:s.type==='perk'?m.perks[id]||0:m.owned.includes(id)?1:0,price=s.price*(s.type==='perk'?owned+1:1);const card=document.createElement('article');card.className='store-product'+(id==='zero'?' featured':'');card.dataset.product=id;card.innerHTML=`<div class="product-emblem ${s.type}">${productArt(id)}</div><div class="product-copy"><h3>${s.name}</h3><p title="${s.description}">${shopCopy[id]}</p><small>${s.type==='roster'?(owned?'已招募':'未招募'):(s.type==='perk'?'强化':'持有')+' <b>'+owned+'</b> / <b>'+s.cap+'</b>'}</small></div><button aria-label="${owned>=s.cap?s.name+'已满':'购买'+s.name+'，'+fmt(price)+'方斯'}" ${owned>=s.cap||m.bank<price?'disabled':''}>${owned>=s.cap?(s.type==='roster'?'已招募':'已满'):fmt(price)+' 方斯'}</button>`;card.querySelector('button').onclick=()=>{const r=A.buy(ui.getMeta(),id);if(r.ok){ui.setMeta(r.meta);ui.toast(s.name+'已购入');renderStore();update();}else ui.toast(r.error);};$('#store-products').append(card);}}
  function selectItem(id,queueId=null){const g=ui.getGame();$('#supply-panel').hidden=true;if(id==='cat'){ui.select('item:cat',queueId);ui.toast('选择要反攻的敌人附近格子');}else{g.queueSelected=queueId;const r=g.useItem(id);ui.toast(r.ok?A.STORE[id].name+'已使用':r.error);if(r.ok)ui.select(null);ui.refresh();}}
  function update(){if(!ui)return;const g=ui.getGame(),m=ui.getMeta();$('#menu-bank').textContent=fmt(m.bank);$('#menu-store-button').disabled=!ui.getReady();$('#cashout-button').hidden=!g.endless;$('#supply-button').disabled=!['running','preparing'].includes(g.phase);$('#battle-items').hidden=ui.isMenu();
    $('#cards').hidden=g.mode==='random';
    if(ui.isMenu())$('#supply-panel').hidden=true;
    $('#battle-intel-button').hidden=ui.isMenu()||!g.chapter?.lesson;
    const bosses=g.stageBosses(),bossKey=g.runId+':'+bosses.join(','),portraits=$('#stage-boss-portraits');portraits.hidden=ui.isMenu()||!bosses.length;
    if(bossKey!==lastStageBosses){lastStageBosses=bossKey;portraits.replaceChildren();for(const kind of bosses){const img=document.createElement('img');img.src=ui.enemyPortrait(kind);img.alt=A.ENEMIES[kind].name;img.title=A.ENEMIES[kind].name;img.dataset.kind=kind;portraits.append(img);}}
    const teaching=g.chapter?.lesson,lessonPanel=$('#lesson-intel');
    const lessonKey=g.runId+':'+g.stageIndex;
    if(teaching&&lessonKey!==lastLesson){lastLesson=lessonKey;lessonUntil=performance.now()+HINT_MS;lessonPanel.open=true;lessonPanel.querySelector('summary').textContent='本关练习 · '+A.UNITS[g.trial[0]].name+'：'+teaching.title;lessonPanel.querySelector('p').textContent=teaching.tip+(g.chapter.challengeKind?' 最后一波有强化领队，先处理机制再集火。':'');}
    hintVisibility(g);
    $('#conveyor').hidden=g.mode!=='random'||ui.isMenu();if(g.mode==='random'){$('#queue-clock').textContent=g.queue.length>=6?'队列已满 · 传送暂停':Math.ceil(Math.max(0,g.queueTimer))+'s';const key=g.runId+':'+g.queue.map(q=>q.id+q.kind).join('|')+':'+g.queueSelected;if(key!==lastQueue){lastQueue=key;$('#conveyor-cards').replaceChildren();for(let i=0;i<6;i++){const q=g.queue[i],b=document.createElement('button');b.className='conveyor-card'+(!q?' empty':q.id===g.queueSelected?' selected':'');b.disabled=!q;b.dataset.queueId=q?.id||'';if(q){const d=q.type==='unit'?A.UNITS[q.kind]:A.STORE[q.kind];b.innerHTML=q.type==='unit'?`<img src="${ui.portrait(q.kind)}" alt=""><strong>${d.name}</strong><small>免费上岗</small>`:`<span class="queue-item-art">${productArt(q.kind)}</span><strong>${d.name}</strong><small>本局道具</small>`;b.title=d.description;b.onclick=()=>{if(q.type==='unit')ui.select(q.kind,q.id);else selectItem(q.kind,q.id);update();};}else b.innerHTML='<span>等待传送</span>';$('#conveyor-cards').append(b);}}}
    const itemKey=g.runId+':'+JSON.stringify(g.inventory)+':'+JSON.stringify(g.itemsUsed);if(itemKey!==lastItems){lastItems=itemKey;$('#item-slots').replaceChildren();for(const id of ['cat','medkit','cleanse','lamp']){const n=g.inventory[id]||0;if(!n)continue;const b=document.createElement('button');b.dataset.item=id;b.className='item-slot';b.title=A.STORE[id].description;b.innerHTML=`<span>${A.STORE[id].name}</span><strong>${n}</strong>`;b.disabled=id==='cat'&&(g.itemsUsed.cat||0)>=2;b.onclick=()=>selectItem(id);$('#item-slots').append(b);}}
  }
  function label(c,words,x,y,color,size=10){c.font=`700 ${size}px "Microsoft YaHei",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(words,x,y);}
  function drawUnitMarks(c,g,u,x,y,h){
    const rank=u.rank||1;c.save();
    // Preserve the original three diamonds, aligned with the health bar.
    const markY=y-h-8;
    for(let i=0;i<3;i++){
      const markX=x+30+i*12;
      c.fillStyle=i<rank?(rank===3?'#d7ba67':'#bca6d3'):'#f5eede88';c.strokeStyle='#fff5df';c.lineWidth=1;
      c.beginPath();c.moveTo(markX,markY-5);c.lineTo(markX+4,markY);c.lineTo(markX,markY+5);c.lineTo(markX-4,markY);c.closePath();c.fill();c.stroke();
    }
    const active=statusDefs.filter(([key])=>u[key]>g.time);
    for(let i=0;i<active.length;i++){
      const [key,name,color]=active[i],width=key==='burnUntil'?74:64,yy=y-h-27-i*19;
      c.fillStyle='#e7e3edf2';c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.roundRect(x-width/2,yy-8,width,16,4);c.fill();c.stroke();
      label(c,(name==='灼烧'?name+(u.burnStacks||1):name)+' '+(u[key]-g.time).toFixed(1)+'s',x,yy,'#493859',9);
    }
    if(u.rank===3&&u.hotUntil>g.time)label(c,'红温 '+Math.ceil(u.hotUntil-g.time)+'s',x,y-h-25,'#b65637',10);
    if(u.kind==='daffodil'&&rank===3)label(c,'残虹 '+((u.attackCount||0)%3)+'/3',x,y-h+12,'#7b66a8',9);
    if(u.kind==='lingko')label(c,'连携 '+((u.linkCount||0)%3)+'/3',x,y+17,'#286d85',10);
    c.restore();
  }
  function drawEnvironment(c,g,p,{W,H,CW,CH,paintArea,images,reducedMotion,placing}){const kind=g.environment||g.environmentLeaving?.kind,env=A.ENVIRONMENTS[kind];if(!env)return;const amount=g.environment?Math.min(1,Math.max(0,(g.time-g.environmentStarted)/1.8)):Math.max(0,(g.environmentLeaving.until-g.time)/1.5),color=env.color;c.save();c.globalAlpha=amount;
    const image=images['v2/environment-'+kind];if(image){const b=p.background;c.drawImage(image,b.x,b.y,b.w,b.h);}
    if(image&&placing)for(let lane=0;lane<5;lane++)for(let col=0;col<11;col++)paintArea(col,col+1,lane,lane+1,null,'#f6efffc0',1.1);
    const edge=c.createLinearGradient(W*.77,0,W,0);edge.addColorStop(0,'transparent');edge.addColorStop(1,color+'75');c.fillStyle=edge;c.fillRect(W*.75,0,W*.25,H);
    if(g.environment==='morpheus'){const fog=c.createRadialGradient(W*.9,H*.3,0,W*.6,H*.5,W*.6);fog.addColorStop(0,'#9477d52a');fog.addColorStop(1,'transparent');c.fillStyle=fog;c.fillRect(0,0,W,H);paintArea(0,11,0,5,null,'#a99bc477',2);}
    if(g.environment==='rider'){for(let lane=0;lane<5;lane++){const from=p.point(7,lane+.9),to=p.point(11,lane+.9);c.strokeStyle='#dca16d55';c.lineWidth=1.5;c.beginPath();c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);c.stroke();}}
    if(['mammon','debtCollector','blackBook','musicKing','foreman','parcelKing','boss'].includes(g.environment)){for(let lane=0;lane<5;lane++){const a=p.point(8,lane+.3),b=p.point(11,lane+.3);c.strokeStyle=color+'66';c.setLineDash(g.environment==='musicKing'?[4,10]:g.environment==='debtCollector'?[18,6]:[]);c.lineWidth=1.3;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}c.setLineDash([]);}
    for(const w of g.raidWarnings){paintArea(0,1,w.lane,w.lane+1,'#9e73bf35','#8e61b0',2);const a=p.point(.6,w.lane+.42);label(c,'后门 '+Math.max(0,w.at-g.time).toFixed(1)+'s',a.x,a.y,'#765292',12);}
    for(const h of g.hazards.filter(h=>['crumbs','conveyor','cracked','silence'].includes(h.kind)&&h.until>g.time)){
      const warning=(h.at||0)>g.time,ink=h.kind==='crumbs'?'#8d957d':h.kind==='conveyor'?'#ac8963':h.kind==='cracked'?'#8a8790':'#b47794';
      for(let i=0;i<h.cells.length;i++){const cell=h.cells[i],a=p.point(cell.col+.5,cell.lane+.72);paintArea(cell.col,cell.col+1,cell.lane,cell.lane+1,warning?null:ink+'19',ink+(warning?'75':'50'),1);
        if(h.kind==='conveyor'){c.strokeStyle=ink+(warning?'80':'b0');c.lineWidth=1.5;const flow=warning||reducedMotion?0:(g.time*.5)%1;for(let n=0;n<2;n++){const q=p.point(cell.col+.15+n*.4+flow*.2,cell.lane+.72);c.beginPath();c.moveTo(q.x+5,q.y-4);c.lineTo(q.x-2,q.y);c.lineTo(q.x+5,q.y+4);c.stroke();}}
        if(h.kind==='crumbs'){c.fillStyle='#9aa19d';c.strokeStyle='#667069';c.lineWidth=1;c.beginPath();c.moveTo(a.x-9,a.y+1);c.lineTo(a.x-4,a.y-5);c.lineTo(a.x+4,a.y-2);c.lineTo(a.x+8,a.y+4);c.lineTo(a.x-2,a.y+6);c.closePath();c.fill();c.stroke();}
        if(h.kind==='cracked'){c.strokeStyle='#746d8260';c.lineWidth=1.4;c.beginPath();c.moveTo(a.x-CW*.2,a.y-CH*.1);c.lineTo(a.x-4,a.y);c.lineTo(a.x+4,a.y-6);c.lineTo(a.x+CW*.2,a.y+CH*.1);c.stroke();}
        if(i===0){const name=h.kind==='crumbs'?'碎罐减速':h.kind==='conveyor'?warning?'加速预警':'配送加速':'禁疗地块';label(c,name+' '+Math.max(0,(warning?h.at:h.until)-g.time).toFixed(1)+'s',a.x,a.y-CH*.32,ink,9);}
      }
    }
    c.restore();
  }
  function drawEffects(c,g,lane,p,{CW,CH,sprite,unitSprite,unitHeight,enemyHeight}){const point=x=>p.point(x,lane+.7);c.save();for(const s of g.structures.filter(s=>s.lane===lane)){const a=point(s.x);c.strokeStyle='#a48dcc';c.fillStyle='#77609855';c.lineWidth=2;c.beginPath();c.ellipse(a.x,a.y,CW*.65,CH*.16,0,0,Math.PI*2);c.fill();c.stroke();label(c,'构造物 '+Math.ceil(s.until-g.time)+'s',a.x,a.y+15,'#8c73ab',10);}
    for(const enemy of g.enemies.filter(e=>e.hp>0&&e.lane===lane&&e.soulMarkUntil>g.time)){const at=p.point(enemy.x,lane+.78),h=enemyHeight?.(enemy)||CH;label(c,'标记 '+(enemy.soulMarkUntil-g.time).toFixed(1)+'s',at.x,at.y-h-24,'#8662b8',10);}
    for(const f of g.effects.filter(f=>(f.kind==='soulBurst'?Math.abs(f.lane-lane)<=1:f.lane===lane)&&['rankUp','canhong','torch','crimsonClaw','link','blackFeatherShot','soulBurst','reveal','cleanse','charge','relocate','catItem','timeStop','construct'].includes(f.kind))){const a=point(f.x),progress=1-f.ttl/f.total;c.globalAlpha=Math.min(1,f.ttl/f.total*2);
      if(f.kind==='canhong'){if(root.ATLAS_META['v2/canhong'])sprite(c,'v2/canhong',0,Math.min(3,Math.floor(progress*4)),a.x,a.y+CH*.25,CH*1.2,.9);c.strokeStyle='#b48ad7';c.lineWidth=4*(1-progress)+1;c.beginPath();c.arc(a.x,a.y,CW*.5*(.6+progress),-2.7,-.2);c.stroke();label(c,'残虹连携',a.x,a.y-CH*.5,'#8a64ab',12);}
      else if(f.kind==='link'){
        const fade=Math.min(1,f.ttl/f.total*3),hit={x:a.x,y:a.y-CH*.45};c.globalAlpha=fade;
        if(!f.secondary){
          const clone=p.point(Math.max(0,f.x-.82),lane+.78),h=(unitHeight?.('lingko',lane)||CH)*.86,ghost={kind:'lingko',rank:f.rank||1,anim:.7,hurt:0,skillPoseUntil:0};
          c.fillStyle='#64d7ef44';c.strokeStyle='#60cfe6';c.lineWidth=2;c.beginPath();c.ellipse(clone.x,clone.y,CW*.35,CH*.1,0,0,Math.PI*2);c.fill();c.stroke();
          c.globalAlpha=1;unitSprite?.(c,'lingko',1,clone.x,clone.y,h,.78*fade,null,ghost);
          label(c,'分身追击',clone.x,clone.y-h-12,'#286d85',12);c.globalAlpha=fade;
        }
        c.strokeStyle='#b0f7ff';c.lineWidth=4;c.beginPath();c.arc(hit.x,hit.y,CH*(.1+progress*.16),0,Math.PI*2);c.stroke();
        c.strokeStyle='#397c9c';c.lineWidth=2;c.beginPath();c.moveTo(hit.x-CH*.1,hit.y);c.lineTo(hit.x+CH*.1,hit.y);c.moveTo(hit.x,hit.y-CH*.1);c.lineTo(hit.x,hit.y+CH*.1);c.stroke();
      }
      else if(f.kind==='blackFeatherShot'){
        const from=p.point(f.sourceX,(f.sourceLane??lane)+.78),t=Math.min(1,progress*3),start={x:from.x,y:from.y-CH*.58},end={x:a.x,y:a.y-CH*.45},at={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};
        c.strokeStyle='#8462bc';c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(at.x-(end.x-start.x)*.1,at.y-(end.y-start.y)*.1);c.lineTo(at.x,at.y);c.stroke();
        c.fillStyle='#51406e';c.strokeStyle='#e2c3ff';c.lineWidth=3;c.beginPath();c.arc(at.x,at.y,CH*.09+3,0,Math.PI*2);c.fill();c.stroke();
        if(t===1){c.strokeStyle='#af7ce0';c.lineWidth=3;c.beginPath();c.ellipse(end.x,end.y,CH*(.16+progress*.12),CH*(.2+progress*.16),-.35,0,Math.PI*2);c.stroke();}
      }
      else if(f.kind==='soulBurst'){
        c.fillStyle='#9572cd33';c.strokeStyle='#a57bd8';c.lineWidth=4;c.beginPath();c.ellipse(a.x,a.y-CH*.4,CW*(.3+progress*.7),CH*(.15+progress*.3),0,0,Math.PI*2);c.fill();c.stroke();
        if(f.lane===lane)label(c,'标记引爆',a.x,a.y-CH*.9,'#7955a5',12);
      }
      else if(['torch','crimsonClaw'].includes(f.kind)){const end=point(f.endX||f.x+.8);c.strokeStyle=f.kind==='torch'?'#e881d3':'#b65b8f';c.lineWidth=f.kind==='torch'?7:4;c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo((a.x+end.x)/2,a.y-CH*.35*Math.sin(progress*Math.PI),end.x,end.y);c.stroke();}
      else if(f.kind==='catItem'){sprite(c,A.UNITS.mintCat.sheet,A.UNITS.mintCat.row,Math.min(3,Math.floor(progress*4)),a.x,a.y-CH*.2,CH*.8);}
      else{c.strokeStyle=f.kind==='rankUp'?'#e8c771':f.kind==='cleanse'?'#9bc6aa':'#bba2d4';c.lineWidth=2.5;c.beginPath();c.ellipse(a.x,a.y,CW*(.2+progress*.55),CH*(.08+progress*.18),0,0,Math.PI*2);c.stroke();if(f.kind==='rankUp')label(c,f.rank+'叠',a.x,a.y-CH*.45,'#a17c42',18);}
    }c.restore();}
  root.EibonEvolutionUI={init,update,drawEnvironment,drawUnitMarks,drawEffects};
})(window);
