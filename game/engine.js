(function (root) {
  'use strict';
  const BOARD_ROWS=5,BOARD_COLS=11;
  const UNITS = {
    chiz: {name:'小吱',role:'经济 · 盖章产钱',cost:50,hp:170,cooldown:5,interval:10,production:25,sheet:'heroes-a',row:0,color:'#f297b8',description:'每 10 秒产出 25 方斯。先安排两位小吱，守店才有底气。'},
    mint: {name:'薄荷',role:'远程 · 穿透旋风',cost:125,hp:230,cooldown:6,interval:2.4,sheet:'heroes-a',row:1,color:'#4ac9c6',description:'原地转身蓄力，向前发射龙卷风。旋风沿本路远程飞行，穿透沿途多个敌人。'},
    requiem: {name:'安魂曲',role:'抛射 · 番茄果冻',cost:175,hp:180,cooldown:8,interval:2.7,sheet:'heroes-a',row:2,color:'#e86970',description:'越过前排抛射番茄，留下 4 秒持续伤害区域。挨打时触发一次起床气。'},
    sakiri: {name:'早雾',role:'吞噬 · 鬼郎丸',cost:150,hp:270,cooldown:9,interval:1,range:2,sheet:'heroes-a',row:3,color:'#f19561',description:'一口吞掉前方两格内的普通或精英敌人，消化 12 秒。对首领改为重咬。'},
    daffodil: {name:'达芙蒂尔',role:'近战 · 精准破甲',cost:175,hp:320,cooldown:7,interval:1.05,sheet:'heroes-b',row:0,color:'#728ae2',description:'斩击前方一格，优先削去 30 护甲，再造成 48 伤害。适合解决铁桶。'},
    nanally: {name:'娜娜莉',role:'远射 · 连续双发',cost:150,hp:210,cooldown:6,interval:1.55,sheet:'heroes-b',row:1,color:'#e779a4',description:'射击本路敌人。连续攻击同一目标 3 次后变成双发，转火时重置。'},
    adler: {name:'阿德勒',role:'承伤 · 管家护盾',cost:100,hp:900,cooldown:10,interval:8,sheet:'heroes-b',row:2,color:'#d9ac53',description:'撑起 180 点护盾，并保护身后一格的队友。盾碎后等待恢复。'},
    xun: {name:'浔',role:'一次性 · 全场时停',cost:175,hp:1,cooldown:32,interval:0,sheet:'one-shots',row:0,color:'#7ac7d4',oneShot:true,description:'上场后暂停全部敌人和敌方飞弹 6 秒，连 Boss 蓄力也会暂停。施放后离场，冷却 32 秒。'},
    crimson: {name:'真红',role:'一次性 · 龙焰吐息',cost:250,hp:1,cooldown:40,interval:0,sheet:'one-shots',row:1,color:'#ed7548',oneShot:true,description:'对落点及前方两列、上下相邻路组成的区域吐息，造成 800 点无视护甲伤害。施放后离场，冷却 40 秒。'}
  };
  const ORDER = Object.keys(UNITS);
  const CAMPAIGN = [
    {name:'第一天营业',waves:3,reward:'requiem',hp:.65,money:325,count:3},
    {name:'番茄特别供应',waves:3,reward:'sakiri',hp:.8,money:300,count:4},
    {name:'请勿乱吃快递',waves:4,reward:'adler',hp:.9,money:300,count:4},
    {name:'自动售货危机',waves:4,reward:'nanally',hp:1,money:300,count:5,boss:'boss'},
    {name:'夜归的账单',waves:5,reward:'daffodil',hp:1.08,money:300,count:5},
    {name:'鬼火不准进店',waves:5,reward:'xun',hp:1.12,money:300,count:5,boss:'rider'},
    {name:'加急配送风暴',waves:6,reward:'crimson',hp:1.16,money:300,count:5,boss:'parcelKing'},
    {name:'最后一场谢幕',waves:8,reward:null,hp:1.2,money:325,count:5,boss:'arachne'}
  ];
  function normalizeProgress(value){return {cleared:Number.isInteger(value?.cleared)?Math.max(0,Math.min(CAMPAIGN.length,value.cleared)):0};}
  function unlockedRoster(value){const {cleared}=normalizeProgress(value);return ['chiz','mint',...CAMPAIGN.slice(0,cleared).map(s=>s.reward).filter(Boolean)];}
  function completeCampaign(progress,game){
    const next=normalizeProgress(progress);
    if(game.mode==='campaign'&&game.phase==='won'&&game.stageIndex===next.cleared&&next.cleared<CAMPAIGN.length)next.cleared++;
    return next;
  }
  const ENEMIES = {
    box:{name:'暴走快递',hp:195,armor:0,speed:.125,damage:22,reward:10,row:0},
    bill:{name:'催命账单',hp:138,armor:0,speed:.18,damage:17,reward:10,row:1},
    bin:{name:'铁桶异象',hp:320,armor:135,speed:.09,damage:32,reward:20,row:2},
    boss:{name:'暴走贩卖机',hp:2200,armor:230,speed:.04,damage:58,reward:140,row:3,boss:true,skill:'三路罐头齐射'},
    parcelKing:{name:'加急快递王',hp:2700,armor:180,speed:.042,damage:52,reward:180,row:0,sheet:'bosses',boss:true,skill:'召唤加急快递'},
    foreman:{name:'铁桶主管',hp:3400,armor:420,speed:.035,damage:65,reward:200,row:1,sheet:'bosses',boss:true,skill:'三路震地'},
    rider:{name:'无首铁驭',hp:3200,armor:300,speed:.052,damage:62,reward:220,row:0,sheet:'nte-bosses',boss:true,skill:'鬼火冲袭 · 一路横扫 / 两侧爆焰'},
    arachne:{name:'永不谢幕的阿拉克涅',hp:4200,armor:220,speed:.034,damage:68,reward:280,row:1,sheet:'nte-bosses',boss:true,skill:'赤幕圆舞 · 三路大范围斩击'}
  };
  function makeRng(seed) {let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
  class Game {
    constructor(options={}) {
      this.random=options.random || Math.random;
      this.mode=options.mode||'day'; this.sandbox=this.mode==='sandbox';this.endless=this.mode==='endless';
      const cleared=normalizeProgress({cleared:options.cleared}).cleared;
      this.stageIndex=Math.max(0,Math.min(Number.isInteger(options.stage)?options.stage:cleared,cleared,CAMPAIGN.length-1));
      this.chapter=this.mode==='campaign'?CAMPAIGN[this.stageIndex]:null;
      this.available=this.mode==='campaign'?unlockedRoster({cleared}):ORDER.slice();
      this.phase='ready';this.time=0;this.money=this.sandbox?9999:(this.mode==='night'?175:225);this.hearts=3;
      this.units=[];this.enemies=[];this.projectiles=[];this.pools=[];this.coins=[];this.effects=[];
      this.guards=Array.from({length:5},(_,lane)=>({lane,state:'ready',x:-.55}));
      this.cooldowns=Object.fromEntries(ORDER.map(k=>[k,0]));this.nextId=1;this.events=[];
      this.wave=0;this.maxWaves=this.endless?Infinity:this.mode==='night'?8:6;this.spawns=[];this.spawnTimer=0;this.waveWait=0;this.bossKills=0;
      this.support=1;this.supportUntil=0;this.freezeUntil=0;this.skyTimer=5;this.kills=0;this.earned=0;this.spent=0;
      if(this.chapter){this.maxWaves=this.chapter.waves;this.money=this.chapter.money;}
    }
    emit(type,data={}){this.events.push({type,...data});if(this.events.length>120)this.events.shift();}
    drainEvents(){return this.events.splice(0);}
    feedback(text,lane=2,x=4,color='#263b46'){this.effects.push({kind:'text',text,lane,x,color,ttl:1.5,total:1.5});}
    canPlace(kind,lane,col){
      if(!UNITS[kind])return '请先选择角色';
      if(!this.available.includes(kind))return '主线通关后可招募这位角色';
      if(this.phase!=='running')return '当前不能布阵';
      if(!Number.isInteger(lane)||!Number.isInteger(col)||lane<0||lane>=BOARD_ROWS||col<0||col>=BOARD_COLS)return '请选择街道格子';
      if(this.units.some(u=>u.lane===lane&&u.col===col))return '这里已经有人值班啦';
      if(this.enemies.some(e=>e.hp>0&&e.lane===lane&&Math.abs(e.x-(col+.5))<.7))return '敌人占着这格，先把它赶走';
      if(this.money<UNITS[kind].cost)return '方斯不够，再等小吱盖个章';
      if(this.cooldowns[kind]>0)return '角色还在准备中';
      return null;
    }
    place(kind,lane,col){
      const error=this.canPlace(kind,lane,col);if(error)return {ok:false,error};
      const d=UNITS[kind];this.money-=d.cost;this.spent+=d.cost;
      this.cooldowns[kind]=d.cooldown;
      const u={id:this.nextId++,kind,lane,col,x:col+.5,hp:d.hp,maxHp:d.hp,shield:kind==='adler'?180:0,
        timer:kind==='chiz'?5:d.interval*.45,anim:0,digest:0,streak:0,target:null,enraged:false,hurt:0,born:.45,oneShot:!!d.oneShot,castAt:.32,cast:false,lifetime:1.6};
      this.effects.push({kind:'landing',lane,x:col+.5,ttl:.55,total:.55});
      this.units.push(u);this.emit('place',{kind,lane,col});return {ok:true,unit:u};
    }
    remove(lane,col){
      if(this.phase!=='running')return false;
      const u=this.units.find(u=>u.lane===lane&&u.col===col);if(!u||u.oneShot)return false;
      const refund=Math.floor(UNITS[u.kind].cost*.5);
      this.money+=refund;this.units=this.units.filter(v=>v!==u);this.feedback('返还 +'+refund,lane,u.x,'#38926e');this.emit('remove',{kind:u.kind});return true;
    }
    start(){if(this.phase!=='ready')return false;this.phase='running';this.beginWave();return true;}
    pause(){if(this.phase==='running'){this.phase='paused';return true;}if(this.phase==='paused'){this.phase='running';return true;}return false;}
    beginWave(){
      this.wave++;this.waveWait=0;
      const count=this.chapter?this.chapter.count+this.wave:Math.min(48,4+this.wave*2+Math.floor(this.wave/2)+(this.mode==='night'?3:0));
      const lanes=[0,1,2,3,4].sort(()=>this.random()-.5);
      this.spawns=[];
      for(let i=0;i<count;i++){
        const roll=this.random();const kind=this.wave>=3&&(!this.chapter||this.stageIndex>=2)&&roll<.22?'bin':this.wave>=2&&(!this.chapter||this.stageIndex>=1)&&roll<.47?'bill':'box';
        this.spawns.push({kind,lane:lanes[i%5]});
      }
      const bossKind=this.chapter?(this.wave===this.maxWaves?this.chapter.boss:null):this.endless&&this.wave%5===0?['rider','arachne','boss','parcelKing','foreman'][(this.wave/5-1)%5]:this.wave===this.maxWaves?(this.mode==='night'?'arachne':'rider'):this.mode==='night'&&this.wave===4?'boss':null;
      if(bossKind)this.spawns.splice(Math.floor(count*.5),0,{kind:bossKind,lane:Math.floor(this.random()*5)});
      this.spawnTimer=this.wave===1?8:2;
      if(this.wave>1){this.money+=70;this.earned+=70;}
      if(this.endless&&this.wave>1&&this.wave%5===1){
        this.hearts=Math.min(3,this.hearts+1);this.support=1;
        for(const u of this.units)u.hp=Math.min(u.maxHp,u.hp+100);
        const spent=this.guards.find(g=>g.state==='spent');if(spent){spent.state='ready';spent.x=-.55;}
        this.emit('respite');
      }
      this.emit('wave',{wave:this.wave,last:this.wave===this.maxWaves,bossKind});
    }
    spawn(kind,lane){
      const d=ENEMIES[kind];if(!d||!Number.isInteger(lane)||lane<0||lane>4)return null;
      const scale=this.enemyHealthScale();
      const e={id:this.nextId++,kind,lane,x:d.boss?BOARD_COLS-.85:BOARD_COLS+.4,hp:d.hp*scale,maxHp:d.hp*scale,armor:d.armor*scale,attack:0,hurt:0,anim:0,shot:6,windup:0,enter:.8,recovery:0,enraged:false,telegraph:null,
        damage:d.damage*(this.endless?1+(this.wave-1)*.025:1),speed:d.speed*(this.endless?Math.min(1.8,1+(this.wave-1)*.012):1)};
      this.enemies.push(e);if(d.boss)this.emit('boss',{kind,lane});return e;
    }
    enemyHealthScale(){return this.endless?(1+Math.max(0,this.wave-1)*.085)*Math.pow(1.12,this.time/60):this.chapter?this.chapter.hp:this.mode==='night'?1.18:1;}
    collect(id){const c=this.coins.find(c=>c.id===id);if(!c||c.collected)return false;c.collected=true;this.money+=c.value;this.earned+=c.value;this.feedback('+'+c.value,c.lane,c.x,'#976315');this.emit('coin',{value:c.value});return true;}
    collectAll(){if(this.phase!=='running')return;this.coins.forEach(c=>this.collect(c.id));}
    dropCoin(lane,x,value){this.coins.push({id:this.nextId++,lane,x,value,ttl:8,collected:false});}
    teamSupport(){
      if(this.phase!=='running'||this.support<1)return false;
      this.support--;this.supportUntil=this.time+8;
      for(const u of this.units){if(u.oneShot)continue;u.hp=Math.min(u.maxHp,u.hp+100);if(u.kind==='sakiri')u.digest=0;u.anim=.65;}
      this.emit('support');this.feedback('全员支援！攻速提升 · 回复生命',2,4,'#e76e80');return true;
    }
    damageEnemy(e,amount,options={}){
      if(!e||e.hp<=0)return;
      if(options.shred)e.armor=Math.max(0,e.armor-options.shred);
      if(e.recovery>0)amount*=1.25;
      let left=amount;
      if(e.armor>0&&!options.bypass){const block=Math.min(e.armor,amount*.65);e.armor-=block;left-=block;}
      e.hp-=left;e.hurt=.16;
      this.emit('hit');
      if(options.show!==false){
        // Merge only the visual numbers from near-simultaneous hits; damage and hit events stay individual.
        let number=e.damageNumber;
        if(number&&number.ttl>0&&this.time-number.started<.14){number.value+=left;number.text=String(Math.ceil(number.value));number.x=e.x;number.lane=e.lane;}
        else{number={kind:'damage',value:left,text:String(Math.ceil(left)),started:this.time,lane:e.lane,x:e.x,color:'#c55552',ttl:.65,total:.65};this.effects.push(number);e.damageNumber=number;}
      }
      if(e.hp<=0)this.kill(e,options.swallowed);
    }
    kill(e,swallowed=false){
      if(e.dead)return;e.hp=0;e.dead=true;this.kills++;
      if(ENEMIES[e.kind].boss){this.bossKills++;this.emit('bossDefeated',{kind:e.kind});}
      this.money+=ENEMIES[e.kind].reward;this.earned+=ENEMIES[e.kind].reward;
      this.effects.push({kind:'defeat',enemy:e.kind,lane:e.lane,x:e.x,ttl:.45,total:.45,swallowed});
      this.emit('kill',{kind:e.kind,swallowed});
    }
    damageUnit(u,amount,options={}){
      if(!u||u.hp<=0||u.oneShot)return;
      let shieldable=amount*(options.shieldFraction??1);
      if(u.kind!=='adler'){
        const protector='protector' in options?options.protector:this.units.find(a=>a.kind==='adler'&&a.lane===u.lane&&a.col===u.col+1&&a.shield>0&&a.hp>0);
        if(protector){const taken=Math.min(protector.shield,shieldable*.7);protector.shield-=taken;amount-=taken;shieldable-=taken;}
      }
      const blocked=Math.min(u.shield,shieldable);u.shield-=blocked;amount-=blocked;u.hp-=amount;u.hurt=.22;
      this.emit('hurt');
      if(u.kind==='requiem'&&!u.enraged){
        u.enraged=true;u.anim=.8;this.feedback('起床气！',u.lane,u.x,'#ae527c');
        for(const e of this.enemies)if(e.lane===u.lane&&e.hp>0&&Math.abs(e.x-u.x)<1.8){this.damageEnemy(e,75,{bypass:true});e.x+=.65;}
        this.emit('attack',{kind:'requiem'});
      }
      if(u.hp<=0)this.emit('unitLost',{kind:u.kind});
    }
    bossAreas(e){
      if(e.telegraph)return e.telegraph;
      return [{laneMin:Math.max(0,e.lane-1),laneMax:Math.min(4,e.lane+1),x1:Math.max(0,e.x-3),x2:Math.min(BOARD_COLS,e.x+.3),power:1}];
    }
    chargeBoss(e){
      if(e.kind==='rider'){
        const end=Math.max(.8,e.x-3.2);
        e.telegraph=[{laneMin:e.lane,laneMax:e.lane,x1:Math.max(0,e.x-4.5),x2:Math.min(BOARD_COLS,e.x+.2),power:1},
          ...[e.lane-1,e.lane+1].filter(l=>l>=0&&l<5).map(l=>({laneMin:l,laneMax:l,x1:Math.max(0,end-1),x2:Math.min(BOARD_COLS,end+1),power:.7}))];
        e.windup=2;e.windupTotal=2;
      }else{
        const targets=this.units.filter(u=>u.hp>0&&!u.oneShot);
        const anchor=targets.length?targets[Math.floor(this.random()*targets.length)]:{lane:e.lane,x:4.5};
        const centerLane=Math.max(1,Math.min(3,anchor.lane));
        e.telegraph=[{laneMin:centerLane-1,laneMax:centerLane+1,x1:Math.max(0,anchor.x-1.7),x2:Math.min(BOARD_COLS,anchor.x+1.7),power:1}];
        e.windup=2.2;e.windupTotal=2.2;
      }
      this.emit('warning');this.feedback(e.kind==='rider'?'鬼火冲袭！':'赤幕圆舞！',e.lane,e.x,'#bb3445');
    }
    releaseBoss(e){
      const areas=this.bossAreas(e),multiplier=e.enraged?1.25:1;
      for(const u of this.units){
        const hit=areas.find(a=>u.lane>=a.laneMin&&u.lane<=a.laneMax&&u.x>=a.x1&&u.x<=a.x2);
        if(hit)this.damageUnit(u,(e.kind==='rider'?105:95)*multiplier*hit.power);
      }
      this.effects.push({kind:e.kind==='rider'?'ghostRush':'redDance',lane:e.lane,x:e.x,areas:areas.map(a=>({...a})),ttl:.9,total:.9});
      e.telegraph=null;e.recovery=2.4;e.anim=1;e.shot=e.enraged?7:10;this.emit('bossSkill',{kind:e.kind});
    }
    skillArea(kind,lane,col){
      return kind==='xun'?{laneMin:0,laneMax:4,x1:0,x2:BOARD_COLS}:{laneMin:Math.max(0,lane-1),laneMax:Math.min(4,lane+1),x1:col,x2:Math.min(BOARD_COLS,col+3)};
    }
    castOneShot(u){
      const area=this.skillArea(u.kind,u.lane,u.col);u.cast=true;u.anim=1;
      if(u.kind==='xun')this.freezeUntil=Math.max(this.freezeUntil,this.time+6);
      else for(const e of this.enemies)if(e.hp>0&&e.lane>=area.laneMin&&e.lane<=area.laneMax&&e.x>=area.x1&&e.x<=area.x2)this.damageEnemy(e,800,{bypass:true});
      this.effects.push({kind:u.kind==='xun'?'timeStop':'breath',lane:u.lane,x:u.x,area,ttl:1.25,total:1.25});
      this.emit('attack',{kind:u.kind});this.feedback(u.kind==='xun'?'时间，停在此刻。':'龙焰吐息！',u.lane,u.x,u.kind==='xun'?'#278a99':'#d74529');
    }
    tick(dt){
      if(this.phase!=='running')return;
      dt=Math.min(Math.max(dt,0),.1);this.time+=dt;
      for(const k of ORDER)this.cooldowns[k]=Math.max(0,this.cooldowns[k]-dt);
      this.skyTimer-=dt;if(this.skyTimer<=0){this.dropCoin(Math.floor(this.random()*5),1+this.random()*6,25);this.skyTimer=7;}
      if(this.spawns.length){this.spawnTimer-=dt;if(this.spawnTimer<=0){const s=this.spawns.shift();this.spawn(s.kind,s.lane);this.spawnTimer=Math.max(.9,2.4-this.wave*.14);}}
      for(const u of this.units){
        if(u.hp<=0)continue;
        if(u.oneShot){u.lifetime-=dt;u.born=Math.max(0,u.born-dt);u.castAt-=dt;if(!u.cast&&u.castAt<=0)this.castOneShot(u);if(u.lifetime<=0)u.hp=0;continue;}
        const d=UNITS[u.kind];u.anim=Math.max(0,u.anim-dt);u.hurt=Math.max(0,u.hurt-dt);u.digest=Math.max(0,u.digest-dt);u.born=Math.max(0,(u.born||0)-dt);
        u.timer-=dt*(this.time<this.supportUntil?1.55:1);
        if(u.kind==='chiz'){
          if(u.timer<=0){this.dropCoin(u.lane,u.x+.15,d.production);u.timer=d.interval;u.anim=.8;this.emit('produce');}continue;
        }
        if(u.kind==='adler'){
          if(u.timer<=0){u.shield=180;u.timer=d.interval;u.anim=.8;this.emit('shield');}continue;
        }
        const ahead=this.enemies.filter(e=>e.hp>0&&e.lane===u.lane&&e.x>=u.x-.25).sort((a,b)=>a.x-b.x);
        if(!ahead.length||u.timer>0||u.digest>0)continue;
        const target=ahead[0],dist=target.x-u.x;
        if(u.kind==='mint'){
          this.projectiles.push({kind:'wind',lane:u.lane,x:u.x+.4,speed:3.6,damage:32,ttl:4,hitIds:[]});
          u.anim=.7;u.timer=d.interval;this.emit('attack',{kind:u.kind});
        }else if(u.kind==='sakiri'){
          if(dist>d.range)continue;
          if(ENEMIES[target.kind].boss){this.damageEnemy(target,200,{bypass:true});u.digest=6;this.feedback('太大了，咬一口！',u.lane,u.x);}
          else{this.kill(target,true);u.digest=12;this.feedback('嚼嚼嚼…',u.lane,u.x);}
          u.anim=1;u.timer=d.interval;this.emit('attack',{kind:u.kind});
        }else if(u.kind==='daffodil'){
          if(dist>1.3)continue;this.damageEnemy(target,48,{shred:30});u.anim=.5;u.timer=d.interval;
          this.effects.push({kind:'slash',lane:u.lane,x:u.x+.6,ttl:.3,total:.3});this.emit('attack',{kind:u.kind});
        }else if(u.kind==='nanally'){
          if(u.target===target.id)u.streak++;else{u.target=target.id;u.streak=1;}
          const count=u.streak>=3?2:1;
          for(let i=0;i<count;i++)this.projectiles.push({kind:'paw',lane:u.lane,x:u.x+.2-i*.22,speed:6.2,damage:28,ttl:4});
          u.anim=.5;u.timer=d.interval;this.emit('attack',{kind:u.kind});
        }else if(u.kind==='requiem'){
          const destination=ahead.find(e=>e.x>target.x+.6)||target;
          this.projectiles.push({kind:'tomato',lane:u.lane,x:u.x,startX:u.x,endX:destination.x,age:0,duration:.82,ttl:1.5,damage:34});
          u.anim=.8;u.timer=d.interval;this.emit('attack',{kind:u.kind});
        }
      }
      for(const p of this.projectiles){
        if(p.kind==='can'&&this.time<this.freezeUntil)continue;
        p.ttl-=dt;
        if(p.kind==='tomato'){
          p.age+=dt;p.x=p.startX+(p.endX-p.startX)*Math.min(1,p.age/p.duration);
          if(p.age>=p.duration&&!p.hit){p.hit=true;p.ttl=0;this.emit('splat');this.pools.push({lane:p.lane,x:p.endX,ttl:4,tick:0});
            for(const e of this.enemies)if(e.hp>0&&e.lane===p.lane&&Math.abs(e.x-p.endX)<.9)this.damageEnemy(e,p.damage,{bypass:true});}
        }else if(p.kind==='wind'){
          const oldX=p.x;p.x+=p.speed*dt;
          for(const e of this.enemies){
            if(e.hp>0&&e.lane===p.lane&&e.x>=oldX-.5&&e.x<=p.x+.5&&!p.hitIds.includes(e.id)){
              p.hitIds.push(e.id);this.damageEnemy(e,p.damage);
            }
          }
        }else if(p.kind==='can'){
          p.x-=3.3*dt;
          const hit=this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane===p.lane&&Math.abs(u.x-p.x)<.45).sort((a,b)=>b.x-a.x)[0];
          if(hit){this.damageUnit(hit,p.damage||28);p.ttl=0;}
        }else{
          p.x+=p.speed*dt;
          const hit=this.enemies.filter(e=>e.hp>0&&e.lane===p.lane&&Math.abs(e.x-p.x)<.38).sort((a,b)=>a.x-b.x)[0];
          if(hit){this.damageEnemy(hit,p.damage);p.ttl=0;}
        }
      }
      for(const p of this.pools){p.ttl-=dt;p.tick-=dt;if(p.tick<=0){p.tick=.5;for(const e of this.enemies)if(e.hp>0&&e.lane===p.lane&&Math.abs(e.x-p.x)<.95)this.damageEnemy(e,10,{bypass:true,show:false});}}
      for(const e of this.enemies){
        if(e.hp<=0)continue;e.hurt=Math.max(0,e.hurt-dt);e.attack-=dt;e.anim=Math.max(0,e.anim-dt);e.enter=Math.max(0,e.enter-dt);
        if(this.time<this.freezeUntil){e.attack+=dt;continue;}
        e.recovery=Math.max(0,e.recovery-dt);
        if(ENEMIES[e.kind].boss&&!e.enraged&&e.hp<=e.maxHp*.5){e.enraged=true;this.feedback('半血狂暴！',e.lane,e.x,'#c42b40');this.emit('warning');}
        const blocker=this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane===e.lane&&e.x-u.x>=-.12&&e.x-u.x<.7).sort((a,b)=>b.x-a.x)[0];
        if(blocker){if(e.attack<=0&&!e.windup&&!e.recovery){this.damageUnit(blocker,e.damage*(e.enraged?1.2:1));e.attack=e.enraged?.8:1;e.anim=.4;}}
        else if(!e.windup&&!e.recovery)e.x-=e.speed*dt;
        if(e.kind==='boss'){
          e.shot-=dt;if(e.shot<=0){e.shot=e.enraged?5:7;e.anim=.7;this.emit('can');for(const lane of [e.lane-1,e.lane,e.lane+1].filter(l=>l>=0&&l<5))this.projectiles.push({kind:'can',lane,x:e.x-.3,ttl:5,damage:e.enraged?42:34});this.feedback('买！买！买！',e.lane,e.x);}
        }else if(e.kind==='parcelKing'){
          e.shot-=dt;if(e.shot<=0){e.shot=10;e.anim=1;
            for(const lane of [e.lane,(e.lane+1)%5,(e.lane+4)%5])if(this.enemies.length<65){const child=this.spawn('box',lane);child.x=Math.max(1.1,e.x-.25);child.enter=.6;}
            this.feedback('您的加急件到了！',e.lane,e.x);this.emit('bossSkill',{kind:e.kind});
          }
        }else if(e.kind==='foreman'){
          if(e.windup>0){e.windup=Math.max(0,e.windup-dt);e.anim=.7;if(!e.windup){
            for(const u of this.units)if(Math.abs(u.lane-e.lane)<=1&&u.x<=e.x+.3&&u.x>=e.x-3)this.damageUnit(u,e.damage*(e.enraged?1.9:1.5));
            this.effects.push({kind:'slam',lane:e.lane,x:e.x-1.3,ttl:.7,total:.7});this.emit('bossSkill',{kind:e.kind});
          }}else{e.shot-=dt;if(e.shot<=0){e.shot=e.enraged?7:9;e.windup=1.8;e.windupTotal=1.8;this.emit('warning');this.feedback('三路砸地预警！',e.lane,e.x);}}
        }else if(e.kind==='rider'||e.kind==='arachne'){
          if(e.windup>0){e.windup=Math.max(0,e.windup-dt);e.anim=.7;if(!e.windup)this.releaseBoss(e);}
          else if(!e.recovery){e.shot-=dt;if(e.shot<=0)this.chargeBoss(e);}
        }
        const guard=this.guards[e.lane];
        if(e.x<.05&&guard.state==='ready'){guard.state='running';guard.x=-.5;this.emit('guard',{lane:e.lane});this.feedback('塔吉多——！',e.lane,1,'#da8c29');}
        if(e.x<-.75){e.hp=0;e.escaped=true;this.hearts=Math.max(0,this.hearts-1);this.emit('breach');if(this.hearts<=0&&this.phase==='running'){this.phase='lost';this.emit('end',{won:false});}}
      }
      for(const g of this.guards)if(g.state==='running'){
        g.x+=6.8*dt;
        for(const e of this.enemies)if(e.hp>0&&e.lane===g.lane&&Math.abs(e.x-g.x)<.7){if(ENEMIES[e.kind].boss){if(e.lastGuard!==g){e.lastGuard=g;this.damageEnemy(e,4000,{bypass:true});}}else this.kill(e);}
        if(g.x>BOARD_COLS+1)g.state='spent';
      }
      for(const c of this.coins){c.ttl-=dt;if(c.ttl<=0&&!c.collected)this.collect(c.id);}
      for(const f of this.effects)f.ttl-=dt;
      this.units=this.units.filter(u=>u.hp>0);this.enemies=this.enemies.filter(e=>e.hp>0);
      this.projectiles=this.projectiles.filter(p=>p.ttl>0&&p.x<BOARD_COLS+1&&p.x>-1);this.pools=this.pools.filter(p=>p.ttl>0);
      this.coins=this.coins.filter(c=>!c.collected);this.effects=this.effects.filter(f=>f.ttl>0);
      if(this.phase==='running'&&!this.spawns.length&&!this.enemies.length){
        this.waveWait+=dt;
        if(this.wave>=this.maxWaves&&!this.sandbox){this.phase='won';this.emit('end',{won:true});}
        else if(this.waveWait>6){if(this.sandbox&&this.wave>=this.maxWaves)this.maxWaves++;this.beginWave();}
      }
    }
  }
  const api={Game,BOARD_ROWS,BOARD_COLS,UNITS,ORDER,ENEMIES,makeRng,CAMPAIGN,normalizeProgress,unlockedRoster,completeCampaign};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.EibonTD=api;
})(typeof window!=='undefined'?window:globalThis);
