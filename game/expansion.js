/* Gameplay expansion. The original save order and public API stay compatible. */
(function(root){
  'use strict';
  const api=root.EibonTD||(typeof require==='function'?require('./engine.js'):null);
  const {Game:BaseGame,UNITS,ORDER,ENEMIES,CAMPAIGN,BOARD_ROWS,BOARD_COLS}=api;
  const ATTRIBUTES={light:{name:'光',color:'#d5ac49'},spirit:{name:'灵',color:'#5da791'},curse:{name:'咒',color:'#c177aa'},dark:{name:'暗',color:'#7776ba'},soul:{name:'魂',color:'#6caac6'},phase:{name:'相',color:'#d58059'}};
  const attributeMap={chiz:'light',mint:'spirit',requiem:'dark',sakiri:'curse',daffodil:'dark',nanally:'spirit',adler:'curse',xun:'light',crimson:'light'};
  for(const [kind,attribute] of Object.entries(attributeMap))UNITS[kind].attribute=attribute;
  Object.assign(UNITS.chiz,{interval:15,description:'首次 5 秒、之后每 15 秒产出 25 方斯。先安排经济与防线，海啸关卡保留重部署资金。'});
  const REACTION_SECONDS=6,CAT_CONTROL_SECONDS=8,TRAP_SECONDS=180,SUBMERGED_DAMAGE_MULTIPLIER=.2;
  Object.assign(UNITS.mint,{description:'本路穿透旋风。与光属性同路具备创生条件，旋风命中才触发，效果持续 6 秒；猫猫形态是独立的限时反攻控制。'});
  Object.assign(UNITS.sakiri,{sheet:'zaowu-v03',row:0});
  Object.assign(UNITS.daffodil,{damage:84,bossDamage:126,range:1.3,comboMax:6,comboStep:.05,comboTimeout:3,description:'近战优先迎击前方首领，按首领身体边缘计算 1.3 格距离，也能斩击大型飞行首领。每刀削去 30 护甲，造成 84 伤害，对首领造成 126 伤害。连续命中同一目标每刀增加 5% 攻速，最多 30%；换目标或停手 3 秒重置。'});
  UNITS.sakiri.description='食人花式近程吞噬：前方两格内可整吞小型地面异象、铁桶和部分精英，消化 12 秒。大型异象与首领只受重咬，不能整吞；不攻击飞行目标。';
  Object.assign(UNITS,{
    skia:{name:'翳',role:'地刺 · 持续伤害',cost:75,hp:350,cooldown:5,interval:.8,sheet:'crew-expansion',row:0,color:'#727287',attribute:'phase',ground:true,duration:TRAP_SECONDS,description:'地刺存续 3 分钟：敌人经过所在格子时每 0.8 秒受到 24 点穿甲伤害，仍能继续行走。不阻挡，可与普通角色共格；首领攻击可摧毁，时间耗尽也会消失。'},
    mintCat:{name:'薄荷·猫猫',role:'一次性 · 限时反攻',cost:100,hp:150,cooldown:20,interval:0,sheet:'crew-expansion',row:1,color:'#54aa9c',attribute:'spirit',oneShot:true,description:'敌人走近后哈气并跳跃，实际命中后令其转身反攻同路后方的怪物，持续 8 秒，到期恢复。对普通怪和精英怪有效，首领不受控制；触发后不再占格。'},
    haiyue:{name:'海月',role:'穿透群攻 · 水母共鸣',cost:150,hp:220,cooldown:7,interval:1.7,range:4,damage:42,sheet:'crew-expansion',row:2,color:'#83b4d3',attribute:'soul',description:'必须站在水母上。每 1.7 秒喷出前方 4 格的同路共鸣波，穿透范围内所有敌人，每个目标受到 42 伤害；无视潜水减伤，普通攻击对潜水目标仅造成 20% 伤害。退水后保留水母，平台被破坏时一起退场。'},
    iroi:{name:'伊洛伊',role:'羊群攻击 · 命中治疗',cost:150,hp:250,cooldown:8,interval:2.4,sheet:'crew-expansion',row:3,color:'#b4caaa',attribute:'spirit',description:'每 2.4 秒派小羊攻击本路敌人，命中造成 16 伤害，同时为自身周围三路、前后两格内的队友回复 28 生命并缩短惑音。不复活、不修复水母或地刺；放置预览会显示治疗范围。'},
    jelly:{name:'水母',role:'平台 · 应急浮台',cost:25,hp:190,cooldown:.65,interval:0,sheet:'utility-expansion',row:0,color:'#88bcdb',utility:true,description:'25 方斯。可放陆地、水格，也可直接垫在已有角色脚下。水母被破坏，上方角色一起退场；退水后普通角色的水母消失。'}
  });
  ORDER.push('skia','mintCat','haiyue','iroi');
  const REACTIONS=[
    {id:'genesis',name:'创生',attrs:['light','spirit'],color:'#77a978',description:'相关属性命中后，本路生成持续 6 秒的创生花，自动攻击前方目标。'},
    {id:'delay',name:'延滞',attrs:['light','phase'],color:'#d6b65c',description:'相关属性命中后，目标减速 35%，首领减速 15%，持续 6 秒。'},
    {id:'cover',name:'覆纹',attrs:['spirit','curse'],color:'#ae80b4',description:'命中触发，持续 6 秒；灵、咒攻击追加 20% 伤害，每目标每 0.7 秒一次。'},
    {id:'burn',name:'浊燃',attrs:['curse','dark'],color:'#c47779',description:'命中后灼烧目标 6 秒，每秒 12 点伤害，并降低目标受到的治疗。'},
    {id:'star',name:'黯星',attrs:['dark','soul'],color:'#8589be',description:'命中触发 6 秒印记，积蓄 4 秒后爆发；重复命中延长印记，不重置爆发倒计时。'},
    {id:'stain',name:'浸染',attrs:['soul','phase'],color:'#6ca9bf',description:'命中后，魂、相属性对该目标增伤 20%，持续 6 秒。'},
    {id:'surplus',name:'盈蓄',attrs:['light','spirit','phase'],color:'#d7b97c',description:'命中触发，持续 6 秒；创生花对延滞目标加强伤害，并少量治疗本路队友。'},
    {id:'discord',name:'失谐',attrs:['curse','dark','soul'],color:'#ab799c',description:'命中后，目标受到的伤害提升 18%，攻击可穿透护甲，持续 6 秒。'}
  ];
  const addedEnemies={
    runner:{name:'加急信使',hp:130,armor:0,speed:.27,damage:16,reward:12,sheet:'enemies',row:0,variant:'runner',weakness:['delay']},
    flyer:{name:'浮游纸鸢',hp:130,armor:0,speed:.16,damage:18,reward:16,sheet:'anomaly-minions',row:0,air:true,weakness:['cover','genesis']},
    diver:{name:'潜潮异象',hp:220,armor:35,speed:.12,damage:40,reward:18,sheet:'anomaly-minions',row:1,variant:'diver',weakness:['stain']},
    healer:{name:'修补异象',hp:240,armor:0,speed:.095,damage:15,reward:20,sheet:'anomaly-minions',row:2,variant:'healer',weakness:['burn']},
    shield:{name:'护盾使徒',hp:310,armor:220,speed:.09,damage:25,reward:25,sheet:'anomaly-minions',row:3,variant:'shield',elite:true,weakness:['discord']},
    fireRunner:{name:'鬼火信使',hp:190,armor:0,speed:.22,damage:22,reward:18,sheet:'boss-minions-a',row:0,variant:'fireRunner',weakness:['stain','delay']},
    chainAcolyte:{name:'锁页使徒',hp:280,armor:70,speed:.1,damage:23,reward:22,sheet:'boss-minions-a',row:1,variant:'binder',weakness:['discord','star']},
    petalThrall:{name:'荆棘花仆',hp:240,armor:0,speed:.095,damage:19,reward:22,sheet:'boss-minions-a',row:2,variant:'healer',weakness:['burn']},
    echoDrone:{name:'回声飞箱',hp:155,armor:0,speed:.15,damage:18,reward:20,sheet:'boss-minions-a',row:3,air:true,weakness:['stain','cover']},
    coinImp:{name:'拾金小兽',hp:350,armor:150,speed:.11,damage:28,reward:32,sheet:'boss-minions-b',row:0,variant:'shield',weakness:['discord','stain']},
    debtSlip:{name:'催缴单',hp:170,armor:0,speed:.25,damage:20,reward:18,sheet:'boss-minions-b',row:1,weakness:['delay']},
    dreamHound:{name:'梦行猎犬',hp:270,armor:35,speed:.18,damage:28,reward:24,sheet:'boss-minions-b',row:2,weakness:['genesis','burn']},
    prismMoth:{name:'棱光蝶卫',hp:185,armor:35,speed:.16,damage:20,reward:22,sheet:'boss-minions-c',row:0,air:true,weakness:['cover','genesis']},
    veilDoll:{name:'赤幕线偶',hp:310,armor:130,speed:.1,damage:25,reward:25,sheet:'boss-minions-c',row:1,variant:'binder',weakness:['delay','cover']}
  };
  Object.assign(ENEMIES.box,{hp:170,damage:18,weakness:['genesis']});
  Object.assign(ENEMIES.bill,{weakness:['delay']});Object.assign(ENEMIES.bin,{weakness:['discord','star']});
  const bossData={
    whale:{name:'海囚',hp:5400,armor:140,speed:0,damage:44,reward:300,sheet:'boss-expansion-a',row:0,boss:true,skill:'海啸改地形 · 拍浪 · 潜伏跃击',weakness:['delay','genesis'],mechanic:'whale',troops:['diver','diver','box'],advice:'预警时补水母或撤回。所有输出都能低伤攻击潜水目标；海月的同路穿透喷波无视潜水减伤，伊洛伊可恢复拍浪伤害。'},
    blackBook:{name:'黑之书',hp:3300,armor:210,speed:.022,damage:44,reward:220,sheet:'boss-expansion-a',row:1,boss:true,skill:'锁链标记 · 横贯光束',weakness:['discord','star'],mechanic:'laser',advice:'避开整路激光预警，利用施放后的破绽。'},
    morpheus:{name:'墨菲克斯',hp:4500,armor:180,speed:.027,damage:54,reward:260,sheet:'boss-expansion-a',row:2,boss:true,skill:'尾扫 · 梦境侵蚀 · 双形态',weakness:['genesis','burn'],mechanic:'dream',advice:'分散队伍；半血后加入持续梦境侵蚀，治疗更有用。'},
    bird:{name:'囿巢鸟',hp:3500,armor:110,speed:.035,damage:40,reward:220,sheet:'boss-expansion-a',row:3,boss:true,air:true,skill:'掠地俯冲 · 逆风羽阵 · 护身羽幕',weakness:['genesis','cover'],mechanic:'dive',advice:'俯冲锁定后撤回落点队员；逆风区降低攻击与治疗节奏，并加速它的飞兵。创生或覆纹可穿透羽幕，打出硬直会清除风区。带薄荷或娜娜莉处理纸鸢。'},
    butterfly:{name:'斑蝶',hp:3500,armor:100,speed:.032,damage:42,reward:230,sheet:'boss-expansion-b',row:0,boss:true,air:true,skill:'蝶影分身 · 粉尘遮蔽',weakness:['cover','genesis'],mechanic:'dust',advice:'半透明无影的是假身。清除两道蝶影，或用覆纹/创生命中真身，可破除掩护并获得 4 秒易伤窗口。'},
    butterflyEcho:{name:'蝶影',hp:85,armor:0,speed:0,damage:0,reward:0,sheet:'boss-expansion-b',row:0,air:true,weakness:[],illusion:true},
    serenetti:{name:'塞润尼缇',hp:4300,armor:160,speed:0,damage:47,reward:260,sheet:'boss-expansion-b',row:1,boss:true,skill:'前排催眠 · 惑音反攻 · 荆棘舞台 · 终幕安眠',weakness:['burn','discord'],mechanic:'song',troops:['petalThrall','petalThrall','shield'],advice:'催眠曲令前排暂停行动，惑音可能使其反攻；浊燃与失谐压制干扰，伊洛伊治疗可缩短沉睡和惑音。'},
    musicKing:{name:'音霸魔王',hp:3900,armor:160,speed:.03,damage:45,reward:250,sheet:'boss-expansion-b',row:2,boss:true,skill:'重拍爆发 · 交替震荡',weakness:['delay','stain'],mechanic:'rhythm',advice:'节拍区每 2 秒爆发一次，亮起倒计时后撤回；拍间不受区域伤害，可补位。打出弱势硬直可清除节拍区。'},
    mammon:{name:'玛门',hp:4500,armor:260,speed:.025,damage:48,reward:350,sheet:'boss-expansion-b',row:3,boss:true,skill:'贪婪抽取 · 方斯返还',weakness:['stain','discord'],mechanic:'tax',advice:'保护经济单位；破甲形成破绽时追回被扣的方斯。'},
    debtCollector:{name:'讨债人',hp:4500,armor:210,speed:.04,damage:55,reward:300,sheet:'boss-expansion-c',row:0,boss:true,skill:'追债标记 · 高速突袭',weakness:['delay','genesis'],mechanic:'debt',advice:'追债优先锁定经济队员，4 秒后结算并引来部属。撤回被标记者、击破带标识的催缴契纸，或打出弱势硬直即可解除。'}
  };
  Object.assign(ENEMIES,addedEnemies,bossData);
  const SWALLOWABLE=new Set(['box','bill','bin','runner','fireRunner','debtSlip','petalThrall','chainAcolyte','shield']);
  for(const [kind,d] of Object.entries(ENEMIES))d.swallowable=SWALLOWABLE.has(kind)&&!d.boss&&!d.air;
  ENEMIES.chainAcolyte.elite=true;
  Object.assign(ENEMIES.rider,{weakness:['burn','stain'],advice:'一路冲袭，两侧爆焰；出招后集中输出。'});
  Object.assign(ENEMIES.arachne,{weakness:['delay','cover'],advice:'三路圆舞预警；错开前排和治疗位置。'});
  Object.assign(ENEMIES.boss,{weakness:['genesis','cover'],advice:'阿德勒保护后排，挡住罐头弹。'});
  Object.assign(ENEMIES.parcelKing,{weakness:['genesis','burn']});Object.assign(ENEMIES.foreman,{weakness:['discord']});
  const bossTroops={rider:['fireRunner','fireRunner','bin'],arachne:['veilDoll','veilDoll','bill'],blackBook:['chainAcolyte','chainAcolyte','shield'],morpheus:['dreamHound','dreamHound','healer'],bird:['flyer','flyer','box'],butterfly:['prismMoth','prismMoth','flyer'],musicKing:['echoDrone','echoDrone','runner'],mammon:['coinImp','coinImp','shield'],debtCollector:['debtSlip','debtSlip','runner'],boss:['bin','bill','box'],parcelKing:['box','runner','box'],foreman:['bin','shield','box']};
  for(const [kind,d] of Object.entries(ENEMIES))if(d.boss){d.speed=0;d.radius=kind==='whale'?2:1;d.troops=d.troops||bossTroops[kind]||['box'];}
  const BOSS_HEALTH={boss:65000,rider:95000,parcelKing:78000,foreman:85000,arachne:100000,whale:100000,blackBook:100000,morpheus:110000,bird:80000,butterfly:80000,serenetti:105000,musicKing:100000,mammon:115000,debtCollector:110000};
  // Endless starts with the full roster: its fixed preset accounts for an established formation.
  const ENDLESS_BOSS_HEALTH={rider:150000,blackBook:150000,bird:140000,butterfly:140000,serenetti:150000,musicKing:150000,morpheus:155000,whale:105000,arachne:150000,mammon:160000,debtCollector:160000};
  const BOSS_ENTRY_SECONDS=2.4,BOSS_X=BOARD_COLS+.6;
  // Attack budgets are independent from HP: telegraphed bursts must threaten a formation.
  const BOSS_THREAT={
    whale:{normal:70,burst:180,color:'#168cce',fx:0},blackBook:{normal:65,burst:200,color:'#9734d9',fx:1},
    morpheus:{normal:80,burst:205,color:'#b52967',fx:2},bird:{normal:65,burst:225,color:'#8d254b',fx:3},
    butterfly:{normal:55,burst:170,color:'#358eae',fx:4},serenetti:{normal:60,burst:240,color:'#b73585',fx:5},
    musicKing:{normal:65,burst:190,color:'#c329b8',fx:6},mammon:{normal:85,burst:215,color:'#b57c13',fx:7},
    rider:{normal:75,burst:210,color:'#188bea',fx:8},arachne:{normal:70,burst:200,color:'#cf274d',fx:9},
    debtCollector:{normal:80,burst:220,color:'#7435b8',fx:10}
  };
  const HAZARD_DAMAGE={fire:22,thorns:15,dream:12,dust:10,beat:8,chains:0,web:0};
  for(const threat of Object.values(BOSS_THREAT)){threat.normal=Math.round(Math.round(threat.normal*1.1)*1.2);threat.burst=Math.round(threat.burst*1.12);}
  const ENEMY_RANKS={normal:{name:'普通',health:1,attack:1},elite:{name:'精英',health:1.5,attack:1.08},armored:{name:'重甲',health:1.7,attack:1.08}};
  const BOSS_SKILL_HP_FLOOR=.02,WHALE_WATER_SECONDS=120;
  const BOSS_TROOP_ORDERS={
    rider:{name:'铁骑冲锋',duration:6,speed:2.1,attack:1.2},
    serenetti:{name:'舞台换位',duration:6,speed:1.15,swap:true},
    whale:{name:'乘潮突进',duration:7,waterSpeed:2},
    blackBook:{name:'锁页护符',duration:8,shield:80},
    bird:{name:'空袭编队',duration:6,airSpeed:1.9,speed:1.2},
    butterfly:{name:'蝶粉掩护',duration:7,damageTaken:.65},
    musicKing:{name:'狂热节拍',duration:7,attackInterval:.65,speed:1.25},
    morpheus:{name:'梦猎追击',duration:7,speed:1.35,woundedAttack:1.4},
    arachne:{name:'牵丝救场',duration:6,rescue:true},
    mammon:{name:'金铠武装',duration:8,armor:90,attack:1.15},
    debtCollector:{name:'集中催缴',duration:6,speed:1.7,focus:true},
    boss:{name:'罐头补给',duration:6,heal:.15},
    parcelKing:{name:'加急配送',duration:6,speed:1.8},
    foreman:{name:'重甲推进',duration:7,armor:70,attack:1.25}
  };
  const BOSS_CADENCE={firstSkill:3,firstWhaleSkill:8,firstNormal:3,normal:.8,enragedNormal:.8,normalRange:3,normalHalfWidth:1.5,normalWindup:.32,skill:3,enragedSkill:2,whaleSkill:8,enragedWhaleSkill:6,recovery:1.8,staggerResistance:28,reinforcementSize:6,reinforcementInterval:12,commandSize:12,commandDelay:1.1,minionLimit:75};
  // Each pair is [minor/major, signature variant]. Timing and shape are shared policies.
  const BOSS_SKILL_CHAINS={
    rider:[['minor',0],['minor',1],['major',0],['major',1]],
    blackBook:[['minor',1],['minor',1],['major',0],['major',1]],
    bird:[['minor',0],['major',1],['minor',0],['major',2]],
    butterfly:[['minor',0],['minor',1],['major',0],['major',1]],
    serenetti:[['minor',2],['minor',0],['major',1],['major',3]],
    musicKing:[['minor',1],['minor',1],['major',0],['major',1]],
    morpheus:[['minor',0],['minor',0],['major',1],['major',1]],
    whale:[['minor',1],['minor',1],['major',0],['major',2]],
    arachne:[['minor',1],['minor',1],['major',0],['major',1]],
    mammon:[['minor',0],['minor',0],['major',1],['major',1]],
    debtCollector:[['minor',0],['major',1],['minor',0],['major',1]]
  };
  for(const [kind,d] of Object.entries(ENEMIES)){
    if(d.boss){d.hp=BOSS_HEALTH[kind]||90000;d.damage=Math.round(d.damage*1.15);d.footprint={columns:kind==='whale'?2.8:2.5,rows:kind==='whale'?2.2:2.5};}
    else{d.rank=['bin','shield','coinImp'].includes(kind)?'armored':d.elite||['chainAcolyte','veilDoll','dreamHound'].includes(kind)?'elite':'normal';d.hp=Math.round(d.hp*1.5*ENEMY_RANKS[d.rank].health);d.damage=Math.round(d.damage*1.35*ENEMY_RANKS[d.rank].attack);}
  }
  Object.assign(ENEMIES.rider,{skill:'火焰地形 · 冲袭 · 持续灼烧',mechanic:'fire',advice:'火焰格持续灼烧。用治疗续航或撤回避火，浸染与失谐可压制首领。'});
  Object.assign(ENEMIES.arachne,{mechanic:'web',skill:'赤幕圆舞 · 丝网地形 · 护幕部队'});
  for(const [kind,order] of Object.entries(BOSS_TROOP_ORDERS))ENEMIES[kind].advice=(ENEMIES[kind].advice||'')+' 连段后指挥部属：'+order.name+'。';
  // Keep the first eight rewards in their previous order so existing saves migrate.
  const firstPools=[['box'],['box','bill'],['box','bill','bin'],['box','bill','bin'],['box','runner','bin'],['box','bill','runner'],['box','runner','bin'],['box','bill','bin']];
  CAMPAIGN.forEach((s,i)=>{s.pool=firstPools[i];s.count=i<2?2:i<4?3:4;s.money=i<2?300:325;s.hp=i<2?.68:.78+i*.035;s.intro=[
    '先安排小吱与薄荷。第一波只走两路，方斯会自动入账。',
    '账单走得更快。光与灵同路时，创生花会加入攻击。',
    '鬼郎丸吞噬前方普通异象，消化时需要队友保护。',
    '阿德勒承伤；把他放在输出角色前一格。',
    '加急信使速度快，近战破甲能处理铁桶。',
    '铁驭会提前标记冲袭范围，技能结束后有破绽。',
    '快递王会召唤异象，穿透与持续伤害适合清群。',
    '圆舞覆盖三路。合理撤回与浔的时停可以救场。'][i];});
  CAMPAIGN.forEach(s=>{s.waves=Math.min(s.waves,4);});
  CAMPAIGN.push(
    {name:'影犬与哈气特训',waves:3,reward:'skia',rewards:['skia','mintCat'],money:350,hp:.95,count:4,pool:['box','runner','bin'],intro:'一起招募翳与猫猫薄荷。暗刺能与队友共格；猫猫哈气后让普通怪或精英怪转身，首领不受控制。'},
    {name:'水母与梦境羊群',waves:3,reward:'haiyue',rewards:['haiyue','iroi'],money:400,hp:1,count:4,pool:['box','healer','shield'],intro:'一起招募海月与伊洛伊。海月必须站在水母上；羊群治疗附近队友，为海啸和持续伤害做好准备。'},
    {name:'海啸营业预案',waves:4,reward:null,money:450,hp:1,count:4,boss:'whale',pool:['box','diver','runner'],intro:'海囚的海啸会暂时淹没街道：预警时补水母或撤回，退水后普通平台消失。'},
    {name:'锁链与黑之书',waves:4,reward:null,money:400,hp:1.02,count:4,boss:'blackBook',pool:['bin','bill','shield'],intro:ENEMIES.blackBook.advice},
    {name:'不要梦游加班',waves:4,reward:null,money:400,hp:1.04,count:4,boss:'morpheus',pool:['box','healer','runner'],intro:ENEMIES.morpheus.advice},
    {name:'花园禁止生长',waves:4,reward:null,money:425,hp:1.08,count:4,boss:'serenetti',pool:['healer','shield','box'],intro:ENEMIES.serenetti.advice},
    {name:'今天不接受追债',waves:5,reward:null,money:450,hp:1.12,count:4,boss:'debtCollector',pool:['runner','bill','bin'],intro:ENEMIES.debtCollector.advice}
  );
  for(const stage of CAMPAIGN)if(stage.boss)stage.waves=5;
  const BOSS_ORDER=['rider','blackBook','bird','butterfly','serenetti','musicKing','morpheus','whale','arachne','mammon','debtCollector'];
  const ENDLESS_CYCLE_WAVES=3,ENDLESS_DUO_ENCOUNTERS=5;
  const DEFAULT_DECK=['chiz','mint','requiem','sakiri','daffodil','nanally','adler','skia','haiyue','iroi'];
  const rewardsFor=stage=>stage.rewards||(stage.reward?[stage.reward]:[]);
  function normalizeProgress(value){return {version:2,cleared:Number.isInteger(value?.cleared)?Math.max(0,Math.min(CAMPAIGN.length,value.cleared)):0};}
  function migrateProgress(value){
    if(value?.version===2)return normalizeProgress(value);
    const old=Number.isInteger(value?.cleared)?Math.max(0,Math.min(21,value.cleared)):0;
    return {version:2,cleared:[0,1,2,3,4,5,6,7,8,9,9,10,10,11,12,13,13,13,14,14,14,15][old]};
  }
  function unlockedRoster(value){return [...new Set(['chiz','mint',...CAMPAIGN.slice(0,normalizeProgress(value).cleared).flatMap(rewardsFor)])];}
  function completeCampaign(progress,game){const next=normalizeProgress(progress);if(game.mode==='campaign'&&game.phase==='won'&&game.stageIndex===next.cleared&&next.cleared<CAMPAIGN.length)next.cleared++;return next;}
  const ENDLESS_THEMES={
    rider:'鬼火巡街',blackBook:'锁页封锁',bird:'高空来客',butterfly:'棱光蝶群',serenetti:'荆棘花园',musicKing:'夜班节拍',morpheus:'梦行猎场',whale:'潮汐入侵',arachne:'赤幕剧场',mammon:'贪婪集市',debtCollector:'加急催缴'
  };
  const BOSS_MOTION={};
  [['a',['whale','blackBook','morpheus','bird']],['b',['butterfly','serenetti','musicKing','mammon']],['c',['rider','arachne','debtCollector']]].forEach(([group,kinds])=>kinds.forEach((kind,row)=>BOSS_MOTION[kind]={basic:'boss-basic-'+group,control:'boss-control-'+group,row}));
  const sameCell=(a,l,c)=>a.lane===l&&a.col===c;
  class Game extends BaseGame{
    constructor(options={}){
      super({...options,random:options.random||(Number.isInteger(options.seed)?api.makeRng(options.seed):undefined)});
      this.available=this.mode==='campaign'?unlockedRoster({cleared:options.cleared}):ORDER.slice();
      const desired=Array.isArray(options.deck)?options.deck:DEFAULT_DECK;
      this.deck=[...new Set(desired.filter(k=>ORDER.includes(k)&&this.available.includes(k)))].slice(0,10);
      if(!this.deck.length)this.deck=this.available.slice(0,10);
      this.platforms=[];this.terrain=Array.from({length:BOARD_ROWS},()=>Array.from({length:BOARD_COLS},()=>({waterUntil:0})));
      this.floodWarnings=[];this.hazards=[];this.flowers=[];this.laneCombos=Array.from({length:5},()=>[]);
      this.reactionClock=0;this.reactionDamage=0;this.healing=0;this.drowned=0;this.platformLosses=0;this.weakBreaks=0;
      this.cooldowns.jelly=0;this.labBoss=options.boss&&ENEMIES[options.boss]?.boss?options.boss:null;
      this.autoCollect=options.autoCollect!==false;this.skyTimer=6;this.maxWaves=this.endless?Infinity:this.chapter?this.chapter.waves:this.mode==='night'?8:6;
      this.money=this.sandbox?9999:this.chapter?this.chapter.money:this.mode==='night'?325:300;
      this.waveHint='';this.lastIncome=0;
      const bossSeed=Number.isInteger(options.seed)?options.seed:this.endless?Math.floor(this.random()*0x100000000):617;
      this.bossRandom=api.makeRng((bossSeed^0x45d9f3b)>>>0);
      this.endlessBosses=[];this.endlessBlock=0;this.endlessTheme='开店准备';
    }
    endlessBossAt(block){
      while(this.endlessBosses.length<=block){
        const bag=BOSS_ORDER.slice();
        for(let i=bag.length-1;i>0;i--){const j=Math.floor(this.bossRandom()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
        if(this.endlessBosses.length&&bag[0]===this.endlessBosses.at(-1)){[bag[0],bag[1]]=[bag[1],bag[0]];}
        this.endlessBosses.push(...bag);
      }
      return this.endlessBosses[block];
    }
    endlessEncounter(block){
      const count=block<BOSS_ORDER.length?1:block<BOSS_ORDER.length+ENDLESS_DUO_ENCOUNTERS?2:3,bosses=[];
      // Skip duplicates across shuffled-bag boundaries, including three-boss encounters.
      for(let index=block;bosses.length<count;index++){const kind=this.endlessBossAt(index);if(!bosses.includes(kind))bosses.push(kind);}
      return bosses;
    }
    endlessPreview(count=1){
      const block=Math.floor(Math.max(0,this.wave-1)/ENDLESS_CYCLE_WAVES);
      return Array.from({length:count},(_,i)=>{const bosses=this.endlessEncounter(block+i),boss=bosses[0];return {wave:(block+i+1)*ENDLESS_CYCLE_WAVES,boss,partner:bosses[1]||null,bosses,name:bosses.map(k=>ENEMIES[k].name).join(' + '),theme:ENDLESS_THEMES[boss],advice:bosses.map(k=>ENEMIES[k].advice).join(' ')};});
    }
    bossStates(){
      return this.enemies.filter(e=>e.hp>0&&ENEMIES[e.kind].boss).map(e=>{
        const d=ENEMIES[e.kind];
        return {id:e.id,kind:e.kind,name:d.name,lane:e.lane,x:e.x,hp:e.hp,maxHp:e.maxHp,healthRatio:e.hp/e.maxHp,armor:e.armor,
          entry:{startedAt:e.entryStarted,duration:BOSS_ENTRY_SECONDS,remaining:Math.max(0,e.entryUntil-this.time)},footprint:{...d.footprint},
          position:{x:e.x,lane:e.travelLane??e.lane,targetLane:e.travelTarget??e.lane,moving:!!e.moving,outside:e.x>=BOARD_COLS},
          motion:{name:e.motion||'idle',family:e.skillFamily||null,remaining:Math.max(0,(e.motionUntil||0)-this.time),phaseRemaining:Math.max(0,(e.phaseUntil||0)-this.time),summonRemaining:Math.max(0,(e.summonUntil||0)-this.time)},
          phase:e.enraged?'enraged':'normal',weakness:[...d.weakness],advice:d.advice,activeReactions:this.activeReactions(e),
          skill:{name:e.skillName||d.skill,remaining:e.windup,total:e.windupTotal,casting:e.windup>0,color:BOSS_THREAT[e.kind]?.color,areas:e.windup>0?this.bossAreas(e).map(a=>({...a,damage:this.bossSkillDamage(e,a),flood:e.kind==='whale'&&e.skillName==='海啸'})):[]},
          normalAttack:e.normalCast?{remaining:e.normalCast.left,area:{...e.normalCast.area}}:null,
          combo:e.comboStep?{...e.comboStep,commandRemaining:Math.max(0,(e.commandAt||0)-this.time)}:null,
          troopOrder:e.orderUntil>this.time?{name:e.lastOrder,remaining:e.orderUntil-this.time}:null,
          featherGuardRemaining:Math.max(0,(e.featherGuardUntil||0)-this.time),swooping:!!e.birdSwoop,
          debtMark:e.debtMark?{...e.debtMark}:null,mirrorsRemaining:Math.max(0,(e.mirrorsUntil||0)-this.time),exposedRemaining:Math.max(0,(e.exposedUntil||0)-this.time),
          staggerRemaining:Math.max(0,e.stunUntil-this.time),vulnerableRemaining:e.recovery,
          hazards:this.hazards.filter(h=>h.bossId===e.id).map(h=>({kind:h.kind,remaining:Math.max(0,h.until-this.time),cells:h.cells.map(c=>({...c}))})),
          floodWarnings:this.floodWarnings.filter(w=>w.bossId===e.id).map(w=>({remaining:Math.max(0,w.at-this.time),cells:w.cells.map(c=>({...c}))}))};
      });
    }
    isWater(lane,col){return !!this.terrain[lane]?.[col]&&this.terrain[lane][col].waterUntil>this.time;}
    platformAt(lane,col){return this.platforms.find(p=>p.hp>0&&sameCell(p,lane,col));}
    unitsAt(lane,col){return this.units.filter(u=>u.hp>0&&!u.oneShot&&sameCell(u,lane,col));}
    platformOccupants(lane,col){return this.units.filter(u=>u.hp>0&&(!u.oneShot||u.kind==='mintCat')&&sameCell(u,lane,col));}
    canPlace(kind,lane,col){
      const d=UNITS[kind];if(!d)return '请先选择角色';
      if(this.phase!=='running')return '当前不能布阵';
      if(!Number.isInteger(lane)||!Number.isInteger(col)||lane<0||lane>=BOARD_ROWS||col<0||col>=BOARD_COLS)return '请选择街道格子';
      if(!d.utility&&!this.available.includes(kind))return '这位同事尚未招募';
      if(!d.utility&&!this.deck.includes(kind))return '这位同事不在本局编队中';
      if(kind==='jelly'){if(this.platformAt(lane,col))return '这里已经有水母啦';}
      else{
        if(kind==='mintCat'&&this.units.some(u=>u.hp>0&&u.kind===kind&&sameCell(u,lane,col)))return '这里已经有猫猫在等敌人';
        if(kind==='mintCat'&&this.isWater(lane,col)&&!this.platformAt(lane,col))return '猫猫等候时也需要水母';
        if(!d.oneShot&&this.unitsAt(lane,col).some(u=>!!UNITS[u.kind].ground===!!d.ground))return d.ground?'这里已经有影犬值班':'这里已经有角色值班';
        if(!d.oneShot&&kind==='haiyue'&&!this.platformAt(lane,col))return '海月必须站在水母上，陆地也一样';
        if(!d.oneShot&&this.isWater(lane,col)&&!this.platformAt(lane,col))return '水格需要水母：先部署 25 方斯的水母';
      }
      if(this.money<d.cost)return '方斯不足';
      if((this.cooldowns[kind]||0)>0)return '角色还在准备中';
      return null;
    }
    castOneShot(u){
      if(u.kind==='mintCat')return;
      super.castOneShot(u);
    }
    place(kind,lane,col){
      if(kind!=='jelly'){
        const result=super.place(kind,lane,col);if(result.ok){result.unit.platformId=this.platformAt(lane,col)?.id||null;result.unit.dotUntil=0;if(UNITS[kind].duration)result.unit.expiresAt=this.time+UNITS[kind].duration;if(kind==='mintCat'){result.unit.lifetime=Infinity;result.unit.castAt=Infinity;result.unit.catState='waiting';result.unit.catTimer=0;}this.refreshCombos();}return result;
      }
      const error=this.canPlace(kind,lane,col);if(error)return {ok:false,error};
      const d=UNITS.jelly;this.money-=d.cost;this.spent+=d.cost;this.cooldowns.jelly=d.cooldown;
      const platform={id:this.nextId++,kind,lane,col,x:col+.5,hp:d.hp,maxHp:d.hp,born:.45,hurt:0};this.platforms.push(platform);
      this.platformOccupants(lane,col).forEach(u=>u.platformId=platform.id);this.emit('place',{kind,lane,col});return {ok:true,unit:platform};
    }
    remove(lane,col){
      if(this.phase!=='running')return false;
      const u=this.unitsAt(lane,col).find(u=>!UNITS[u.kind].ground)||this.unitsAt(lane,col)[0]||this.units.find(u=>u.hp>0&&u.kind==='mintCat'&&u.catState==='waiting'&&sameCell(u,lane,col));
      if(u){const refund=Math.floor(UNITS[u.kind].cost*.5);this.money+=refund;this.units=this.units.filter(v=>v!==u);this.feedback('返还 +'+refund,lane,u.x,'#38926e');this.emit('remove',{kind:u.kind});this.refreshCombos();return true;}
      const p=this.platformAt(lane,col);if(p){p.hp=0;this.money+=12;this.feedback('返还 +12',lane,p.x,'#38926e');return true;}return false;
    }
    refreshCombos(){
      for(let lane=0;lane<5;lane++){
        const attrs=new Set(this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane===lane).map(u=>UNITS[u.kind].attribute));
        this.laneCombos[lane]=REACTIONS.filter(r=>r.attrs.every(a=>attrs.has(a))).map(r=>r.id);
      }
    }
    beginWave(){
      this.wave++;this.waveWait=0;this.spawns=[];
      const block=Math.floor((this.wave-1)/ENDLESS_CYCLE_WAVES),position=(this.wave-1)%ENDLESS_CYCLE_WAVES;
      const cycleBoss=this.endless?this.endlessBossAt(block):null;
      this.endlessBlock=block;this.endlessTheme=this.endless?ENDLESS_THEMES[cycleBoss]:'';
      const themePool=this.endless?[...new Set(ENEMIES[cycleBoss].troops)]:[];
      const pool=this.chapter?.pool||(this.endless&&this.wave>2?position===1?themePool:position===2?['bin','shield',...themePool]:position===3?['runner',...themePool]:['box','bill',...themePool]:this.wave<2?['box']:this.wave<3?['box','bill']:this.wave<4?['box','bill','bin']:['box','bill','runner','bin','flyer','healer','shield']);
      const baseCount=this.chapter?this.chapter.count+this.wave:this.endless?Math.min(160,4+position*3+block*3):Math.min(46,2+this.wave*2+(this.mode==='night'?2:0));
      const bossKind=this.labBoss?(this.wave===1?this.labBoss:null):this.chapter?(this.wave===this.maxWaves?this.chapter.boss:null):this.endless&&position===ENDLESS_CYCLE_WAVES-1?cycleBoss:this.wave===this.maxWaves?(this.mode==='night'?'whale':'rider'):null;
      const previousCount=this.chapter?this.stageIndex<3?baseCount:Math.ceil(baseCount*1.25):this.wave<3?baseCount:Math.ceil(baseCount*1.3);
      const count=bossKind?previousCount:Math.ceil(previousCount*1.25);
      const laneCount=this.wave===1?2:this.wave===2?3:5;
      const startLane=this.chapter?(this.stageIndex%4):Math.floor(this.random()*4);
      for(let i=0;i<count;i++){
        const lane=i===0?startLane:(startLane+i%laneCount)%5;
        const kind=this.wave===1?'box':pool[Math.floor(this.random()*pool.length)];
        this.spawns.push({kind,lane});
      }
      const bosses=bossKind?(this.endless?this.endlessEncounter(block):[bossKind]):[],partner=bosses[1]||null;
      if(bossKind){const troops=bosses.flatMap(k=>ENEMIES[k].troops),lanes=bosses.length===3?[0,2,4]:bosses.length===2?[1,3]:[2];this.spawns=this.spawns.map((s,i)=>({...s,kind:troops[i%troops.length]}));this.spawns.unshift(...bosses.map((kind,i)=>({kind,lane:lanes[i]})));}
      this.spawnTimer=this.wave===1?12:4;
      if(this.wave>1){const subsidy=bossKind==='whale'?110:60;this.money+=subsidy;this.earned+=subsidy;}
      this.waveHint=this.chapter?.intro||(this.endless?`${this.endlessTheme} · ${position===2?bosses.length===3?'三首领组合':partner?'双首领组合':'首领来袭':position===1?'异象前哨':'常规巡街'}。第 ${(block+1)*ENDLESS_CYCLE_WAVES} 波：${this.endlessEncounter(block).map(k=>ENEMIES[k].name).join(' + ')}。`:'同路不同属性形成环合；保留资金应对新路线。');this.emit('wave',{wave:this.wave,last:this.wave===this.maxWaves,bossKind,partner,bosses});
    }
    spawn(kind,lane){
      const e=super.spawn(kind,lane);if(e){e.status={};e.reactionLanes={};e.skillIndex=0;e.dot=0;e.shot=kind==='whale'?BOSS_CADENCE.firstWhaleSkill:BOSS_CADENCE.firstSkill;e.submerged=kind==='whale';e.air=!!ENEMIES[kind].air;e.healClock=4;e.taxed=0;e.phaseTwo=false;e.minionClock=12;e.breakMeter=0;e.breakReady=0;e.stunUntil=0;e.damage=ENEMIES[kind].damage;e.speed=ENEMIES[kind].speed;if(ENEMIES[kind].boss){e.x=BOSS_X;e.lane=lane;e.travelLane=lane;e.travelTarget=lane;e.hp=e.maxHp=this.endless?(ENDLESS_BOSS_HEALTH[kind]||ENEMIES[kind].hp):ENEMIES[kind].hp;e.entryStarted=this.time;e.entryUntil=this.time+BOSS_ENTRY_SECONDS;this.emit('bossEntry',{id:e.id,kind,lane,duration:BOSS_ENTRY_SECONDS,footprint:{...ENEMIES[kind].footprint}});}}return e;
    }
    enemyHealthScale(){return this.chapter?this.chapter.hp:this.mode==='night'?1.08:1;}
    arrivalInterval(){return this.wave===1?5:this.wave===2?4:this.endless?Math.max(.18,3.4-this.wave*.105):Math.max(1.5,3.4-this.wave*.1);}
    inLane(e,lane){return ENEMIES[e.kind]?.boss?Math.abs((e.travelLane??e.lane)-lane)<=(ENEMIES[e.kind].radius||1)+.5:e.lane===lane;}
    isLaneFrozen(lane){return this.time<this.freezeUntil||this.time<(this.laneFreezeUntil?.[Math.round(lane)]||0);}
    targetable(e,u){return e.hp>0&&!e.controlCat&&!(e.entryUntil>this.time)&&(!ENEMIES[e.kind].air||['mint','nanally','haiyue','requiem'].includes(u.kind)||u.kind==='daffodil'&&ENEMIES[e.kind].boss);}
    attackDistance(e,u){
      const d=ENEMIES[e.kind];if(!d.boss)return Math.max(0,e.x-u.x);
      // Large bosses are reachable at their body boundary, not only at the outside anchor.
      const dx=Math.max(0,e.x-u.x-(d.footprint?.columns||2.5)/2);
      const dy=Math.max(0,Math.abs((e.travelLane??e.lane)-u.lane)-(d.footprint?.rows||2.5)/2);
      return Math.hypot(dx,dy);
    }
    isSubmerged(e){return e.kind==='whale'?!!e.submerged&&!e.diveTarget:ENEMIES[e.kind].variant==='diver'&&this.isWater(e.lane,Math.floor(e.x));}
    birdWindAt(lane,col,bossId=null){return this.hazards.some(h=>h.kind==='headwind'&&h.until>this.time&&(bossId===null||h.bossId===bossId)&&h.cells.some(c=>c.lane===lane&&c.col===col));}
    troopOrder(e){return !e.controlCat&&e.orderUntil>this.time?BOSS_TROOP_ORDERS[e.orderKind]:null;}
    activeReactions(e){return REACTIONS.filter(r=>(e.status[r.id]||0)>this.time).map(r=>r.id);}
    applyReactions(e,ids,lane){
      for(const id of ids){
        const wasActive=(e.status[id]||0)>this.time;
        e.status[id]=this.time+REACTION_SECONDS;e.reactionLanes[id]=lane;
        if(id==='delay')e.status.slow=e.status[id];
        if(id==='burn')e.status.burn=e.status[id];
        if(id==='discord')e.status.vulnerable=e.status[id];
        if(id==='star'&&(!wasActive||!e.starAt))e.starAt=this.time+4;
        if(id==='genesis'){
          let flower=this.flowers.find(f=>f.lane===lane);
          const owners=this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane===lane);
          if(!flower&&owners.length){flower={lane,x:Math.min(...owners.map(u=>u.x))+.4,timer:.3,until:0};this.flowers.push(flower);}
          if(flower)flower.until=this.time+REACTION_SECONDS;
        }
      }
    }
    damageEnemy(e,amount,options={}){
      if(!e||e.hp<=0||amount<=0||e.entryUntil>this.time)return;
      const sourceLane=options.sourceLane??e.lane,element=options.attribute;
      const triggered=element&&!options.reaction?(this.laneCombos[sourceLane]||[]):[];
      const combos=[...new Set([...this.activeReactions(e),...triggered])];
      if(e.kind==='butterfly'&&e.mirrorsUntil>this.time&&!this.specialistCounters){if(combos.some(r=>['cover','genesis'].includes(r)))this.revealButterfly(e);else amount*=.7;}
      if(e.kind==='butterfly'&&e.exposedUntil>this.time)amount*=1.25;
      if(!options.reaction){
        if(combos.includes('stain')&&['soul','phase'].includes(element))amount*=1.2;
        if(combos.includes('cover')&&['spirit','curse'].includes(element)&&(e.coverAt||0)<=this.time){amount*=1.2;e.coverAt=this.time+.7;}
      }
      if(e.status?.vulnerable>this.time)amount*=1.18;
      if((ENEMIES[e.kind].weakness||[]).some(r=>combos.includes(r))){amount*=ENEMIES[e.kind].boss?1.35:1.12;e.status.weakUntil=this.time+1.5;}
      if(this.isSubmerged(e)&&!options.underwater)amount*=SUBMERGED_DAMAGE_MULTIPLIER;
      if(e.kind==='bird'&&e.featherGuardUntil>this.time&&!combos.some(r=>['genesis','cover'].includes(r)))amount*=.65;
      const order=this.troopOrder(e);if(order){amount*=order.damageTaken||1;if(e.orderShield>0){const efficiency=this.specialistCounters?.25:1,blocked=Math.min(e.orderShield,amount*efficiency);e.orderShield-=blocked;amount=Math.max(0,amount-blocked/efficiency);}if(e.orderArmor>0&&!options.bypass&&!combos.includes('discord')){const blocked=Math.min(e.orderArmor,amount*.65);e.orderArmor-=blocked;amount-=blocked;}}
      if(ENEMIES[e.kind].variant==='shield'&&e.armor>0&&!options.bypass)amount*=.9;
      const before=e.hp;super.damageEnemy(e,amount,{...options,bypass:options.bypass||combos.includes('discord')});if(options.reaction)this.reactionDamage+=Math.max(0,before-e.hp);
      if(before>e.hp&&triggered.length)this.applyReactions(e,triggered,sourceLane);
      if(options.impact&&before>e.hp){e.hitKind=options.impact;e.hitUntil=this.time+.26;if(!e.impactFxAt||this.time>=e.impactFxAt){this.effects.push({kind:'impact',impact:options.impact,lane:e.lane,x:e.x,ttl:.3,total:.3});e.impactFxAt=this.time+.08;}}
      if(e.hp>0&&ENEMIES[e.kind].boss&&!(this.specialistCounters&&e.mirrorsUntil>this.time)&&(ENEMIES[e.kind].weakness||[]).some(r=>combos.includes(r))&&this.time>=e.breakReady){e.breakMeter+=Math.max(0,before-e.hp)*(options.reaction?1.25:.65);if(e.breakMeter>=Math.max(240,Math.min(450,e.maxHp*.003)))this.breakBoss(e);}
      if(e.taxed&&e.recovery>0){this.money+=e.taxed;this.earned+=e.taxed;this.feedback('追回方斯 +'+e.taxed,e.lane,e.x,'#936b2d');e.taxed=0;}
    }
    breakBoss(e){
      e.breakMeter=0;e.breakReady=this.time+BOSS_CADENCE.staggerResistance;e.stunUntil=this.time+1.8;e.normalCast=null;e.recovery=Math.max(e.recovery,3);this.weakBreaks++;
      if(e.diveTarget){e.diveReturnFrom={x:e.x,lane:e.travelLane??e.lane};e.diveReturning=e.diveReturnTotal=1.1;}
      if(e.birdSwoop){e.birdSwoop.returnFrom={x:e.x,lane:e.travelLane??e.lane};e.birdSwoop.returning=.9;}
      if(e.kind==='whale'&&e.windup>0&&e.skillName==='海啸'){e.windup+=3;e.windupTotal+=3;for(const w of this.floodWarnings.filter(w=>w.bossId===e.id)){w.at+=5.2;w.until+=5.2;}}
      else{e.windup=0;e.telegraph=null;e.shot=Math.max(0,e.shot)+3.5;this.floodWarnings=this.floodWarnings.filter(w=>w.bossId!==e.id);}
      if(['rider','bird','musicKing'].includes(e.kind))this.hazards=this.hazards.filter(h=>h.bossId!==e.id);
      if(e.kind==='bird')e.featherGuardUntil=0;
      if(e.kind==='debtCollector')this.clearDebt(e,'硬直 · 追债解除');
      if(e.kind==='butterfly'&&e.mirrorsUntil>this.time)this.revealButterfly(e);
      if(e.kind==='serenetti')for(const u of this.units)u.confusedUntil=0;
      this.emit('weakBreak',{kind:e.kind,extended:e.kind==='whale'});this.feedback('弱势命中 · 硬直',e.lane,7.5,'#417d77');
    }
    kill(e,swallowed=false){
      if(e.dead)return;
      if(ENEMIES[e.kind].illusion){e.hp=0;e.dead=true;const owner=this.enemies.find(v=>v.id===e.illusionOwner&&v.hp>0);this.effects.push({kind:'defeat',enemy:e.kind,lane:e.lane,x:e.x,ttl:.45,total:.45});if(owner&&!this.enemies.some(v=>v.hp>0&&v.illusionOwner===owner.id))this.revealButterfly(owner);return;}
      super.kill(e,swallowed);
      for(const owner of this.enemies)if(owner.debtMark?.slipId===e.id)this.clearDebt(owner,'契纸击破 · 追债解除');
      if(e.kind==='whale')this.drainWater();if(e.taxed){this.money+=e.taxed;this.earned+=e.taxed;e.taxed=0;}
      if(ENEMIES[e.kind].boss){this.hazards=this.hazards.filter(h=>h.bossId!==e.id);this.clearDebt(e);this.clearButterflyEchoes(e);}
    }
    clearDebt(e,message){
      const mark=e.debtMark;if(!mark)return;e.debtMark=null;
      const slip=this.enemies.find(v=>v.id===mark.slipId);if(slip)slip.debtTokenOwner=null;
      if(message)this.feedback(message,mark.lane,mark.x,'#ba8ed0');
    }
    startDebt(e){
      this.clearDebt(e);const target=this.units.find(u=>u.id===e.debtTargetId&&u.hp>0);if(!target)return;
      let slip=this.enemies.find(v=>v.hp>0&&!v.controlCat&&v.kind==='debtSlip'&&v.summonerId===e.id);
      if(!slip&&this.enemies.filter(v=>v.hp>0&&!ENEMIES[v.kind].boss).length<BOSS_CADENCE.minionLimit){slip=this.spawn('debtSlip',target.lane);if(slip){slip.x=BOARD_COLS-.2;slip.summonerId=e.id;}}
      if(slip)slip.debtTokenOwner=e.id;
      e.debtMark={targetId:target.id,slipId:slip?.id??null,lane:target.lane,x:target.x,remaining:4};
      this.feedback('追债锁定 · 撤回或击破契纸',target.lane,target.x,'#c078b1');
    }
    updateDebt(e,dt){
      const mark=e.debtMark;if(!mark)return;
      const target=this.units.find(u=>u.id===mark.targetId&&u.hp>0),slip=this.enemies.find(v=>v.id===mark.slipId);
      if(!target){this.clearDebt(e,'目标撤离 · 追债解除');return;}
      if(mark.slipId&&(!slip||slip.hp<=0||slip.controlCat)){this.clearDebt(e,'契纸失效 · 追债解除');return;}
      for(const v of this.enemies)if(v.hp>0&&!v.controlCat&&!ENEMIES[v.kind].boss&&!ENEMIES[v.kind].air&&v.summonerId===e.id&&v.x>target.x+.7&&v.lane!==target.lane){
        if(v.troopShift&&this.time<v.troopShift.started+v.troopShift.duration)continue;
        v.troopShift={from:v.lane,to:target.lane,started:this.time,duration:.65};v.lane=target.lane;
      }
      mark.remaining=Math.max(0,mark.remaining-dt);
      if(!mark.remaining){this.damageBossSkill(target,123*(e.enraged?1.2:1));this.effects.push({kind:'bossPulse',boss:e.kind,lane:e.lane,x:e.x,areas:[{laneMin:target.lane,laneMax:target.lane,x1:target.col,x2:target.col+1}],ttl:.7,total:.7});this.clearDebt(e,'催缴结算');}
    }
    clearButterflyEchoes(e){for(const v of this.enemies)if(v.illusionOwner===e.id){v.hp=0;v.dead=true;}e.mirrorsUntil=0;}
    revealButterfly(e){
      if(e.hp<=0||!(e.mirrorsUntil>this.time))return;
      this.clearButterflyEchoes(e);e.exposedUntil=this.time+4;
      this.feedback('蝶影识破 · 易伤 4s',e.lane,e.x,'#70baca');this.emit('mirrorReveal',{bossId:e.id});
    }
    startButterflyEchoes(e){
      this.clearButterflyEchoes(e);e.mirrorsUntil=this.time+6;e.exposedUntil=0;
      for(const lane of [(e.lane+1)%BOARD_ROWS,(e.lane+BOARD_ROWS-1)%BOARD_ROWS]){const v=this.spawn('butterflyEcho',lane);if(v){v.illusionOwner=e.id;v.x=BOARD_COLS-.5;v.entryUntil=0;v.hp=v.maxHp=85;v.enter=0;}}
      this.feedback('蝶影分身 · 真身有影',e.lane,e.x,'#8bb9ce');
    }
    damagePlatform(p,amount){
      if(!p||p.hp<=0)return;p.hp-=amount;p.hurt=.25;
      if(p.hp<=0){this.platformLosses++;for(const u of this.platformOccupants(p.lane,p.col)){u.hp=0;this.emit('unitLost',{kind:u.kind,reason:'platform'});}this.emit('platformLost',{lane:p.lane,col:p.col});this.feedback('水母破坏 · 退场',p.lane,p.x,'#497895');}
    }
    damageUnit(u,amount,options={}){
      if(!u||u.hp<=0||amount<=0)return;
      if(this.resolvingBossSkill)amount=this.bossSkillHitAmount(u,amount*1.12);
      const bosses=this.enemies.filter(e=>ENEMIES[e.kind].boss).map(e=>[e,e.x]);
      const protector=this.units.find(p=>p.kind==='adler'&&p.hp>0&&p.lane===u.lane&&p.col===u.col+1&&p.shield>0);
      const shieldBefore=protector?.shield||u.shield||0,panicBefore=u.enraged;
      super.damageUnit(u,amount,options);
      for(const [e,x] of bosses)e.x=x;
      if(shieldBefore>0&&(protector||u.shield<shieldBefore)){
        const owner=protector||u;owner.shieldFlash=.28;
        if(!owner.shieldFxAt||this.time>=owner.shieldFxAt){this.effects.push({kind:'shieldImpact',lane:u.lane,x:u.x,fromX:owner.x,ttl:.38,total:.38});owner.shieldFxAt=this.time+.2;}
      }
      if(u.kind==='requiem'&&!panicBefore&&u.enraged)this.effects.push({kind:'panicWave',lane:u.lane,x:u.x,ttl:.65,total:.65});
      if(u.hp<=0)this.refreshCombos();
    }
    selectBossTarget(e,makeAreas,economy=false){
      const targets=this.units.filter(u=>u.hp>0&&!u.oneShot);let best=null,bestScore=-Infinity;
      for(let lane=0;lane<BOARD_ROWS;lane++)for(let col=0;col<BOARD_COLS;col++){
        const candidate={lane,col,x:col+.5},areas=makeAreas(candidate),hits=targets.filter(u=>areas.some(a=>u.lane>=a.laneMin&&u.lane<=a.laneMax&&u.x>=a.x1&&u.x<=a.x2));
        const score=hits.length*10+hits.reduce((sum,u)=>sum+(1-u.hp/u.maxHp)*.2+(economy&&u.kind==='chiz'?.15:0),0)-Math.abs(lane-(e.travelLane??e.lane))*.01-Math.abs(candidate.x-5.5)*.0001;
        if(score>bestScore){best=candidate;bestScore=score;}
      }
      return best||{lane:e.lane,col:4,x:4.5};
    }
    moveBoss(e,dt){
      e.travelLane??=e.lane;e.travelTarget??=e.lane;e.moving=false;
      // Presentation follows distance travelled, so pause/slow/freeze preserve the gait.
      const blend=1-Math.exp(-dt*9);e.travelBlend=(e.travelBlend||0)*(1-blend);e.travelLean=(e.travelLean||0)*(1-blend);
      if(e.windup>0||e.normalCast||e.recovery>0||e.motionUntil>this.time)return;
      e.travelClock=(e.travelClock??0)-dt;
      if(e.travelClock<=0){
        if(this.units.some(u=>u.hp>0&&!u.oneShot)){const target=this.selectBossTarget(e,a=>[{laneMin:Math.max(0,a.lane-1),laneMax:Math.min(4,a.lane+1),x1:Math.max(0,a.x-1.3),x2:Math.min(BOARD_COLS,a.x+1.3)}]);e.strafeDirection=-(e.strafeDirection||1);e.travelTarget=Math.max(.2,Math.min(3.8,target.lane+e.strafeDirection*.35));}
        else{e.patrolDirection=e.travelLane>3.5?-1:e.travelLane<.5?1:(e.patrolDirection||1);e.travelTarget=e.patrolDirection>0?3.8:.2;}
        // Keep two bosses on distinct parts of the outside corridor when their targets coincide.
        const other=this.enemies.find(v=>v!==e&&v.hp>0&&ENEMIES[v.kind].boss&&Math.abs((v.travelTarget??v.lane)-e.travelTarget)<.75);
        if(other)e.travelTarget=Math.max(.2,Math.min(3.8,e.travelTarget+(e.id>other.id?1:-1)));
        e.travelClock=2.4;
      }
      const distance=e.travelTarget-e.travelLane,step=Math.sign(distance)*Math.min(Math.abs(distance),dt*(e.kind==='rider'?.65:.42)*(e.status.slow>this.time?.7:1));
      e.travelLane+=step;e.lane=Math.max(0,Math.min(4,Math.round(e.travelLane)));e.moving=Math.abs(step)>.0001;
      if(e.moving){e.travelBlend+=blend;e.travelLean+=Math.sign(step)*blend;e.travelPhase=(e.travelPhase||0)+Math.abs(step)*Math.PI*5;}
      e.x=BOSS_X+(e.moving?Math.sin(this.time*.9+e.id)*.12:0);
    }
    updateBirdSwoop(e,dt){
      const flight=e.birdSwoop;if(!flight)return false;e.moving=false;
      let from=flight.origin,to=flight.target,t;
      if(flight.returning>0){flight.returning=Math.max(0,flight.returning-dt);from=flight.returnFrom;to=flight.origin;t=1-flight.returning/.9;}
      else if(e.windup>0)t=Math.max(0,1-e.windup/.8);
      else{flight.returnFrom={x:e.x,lane:e.travelLane??e.lane};flight.returning=.9;return true;}
      const eased=t*t*(3-2*t);e.x=from.x+(to.x-from.x)*eased;e.travelLane=from.lane+(to.lane-from.lane)*eased;e.lane=Math.max(0,Math.min(4,Math.round(e.travelLane)));e.swoopLift=Math.sin(t*Math.PI)*.65;
      if(t>=1&&flight.returning===0){e.x=flight.origin.x;e.travelLane=flight.origin.lane;e.lane=Math.round(e.travelLane);e.birdSwoop=null;e.swoopLift=0;}
      return true;
    }
    updateWhaleDive(e,dt){
      if(!e.diveTarget)return false;e.moving=false;
      let from=e.diveOrigin,to=e.diveTarget,t;
      if(e.diveReturning>0){e.diveReturning=Math.max(0,e.diveReturning-dt);from=e.diveReturnFrom||e.diveTarget;to=e.diveOrigin;t=1-e.diveReturning/e.diveReturnTotal;}
      else if(e.windup>0)t=Math.max(0,1-e.windup/.95);
      else{e.diveReturning=e.diveReturnTotal=1.1;e.diveReturnFrom={x:e.x,lane:e.travelLane??e.lane};return true;}
      e.x=from.x+(to.x-from.x)*t;e.travelLane=from.lane+(to.lane-from.lane)*t;e.lane=Math.max(0,Math.min(4,Math.round(e.travelLane)));e.diveLift=Math.sin(t*Math.PI)*1.45;
      if(t>=1&&e.diveReturning===0){e.x=e.diveOrigin.x;e.travelLane=e.diveOrigin.lane;e.lane=Math.round(e.travelLane);e.diveTarget=null;e.diveLift=0;}
      return true;
    }
    warnFlood(e){
      const upper=this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane<2).length,lower=this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane>2).length;
      const startLane=e.floodSide===undefined?(lower>upper?3:0):(e.floodSide===0?3:0);e.floodSide=startLane;
      const cells=[];for(let lane=startLane;lane<startLane+2;lane++)for(let col=0;col<BOARD_COLS;col++)cells.push({lane,col});
      const warning={id:this.nextId++,bossId:e.id,region:startLane===0?'上方海域':'下方海域',laneMin:startLane,laneMax:startLane+1,cells,at:this.time+4.5,until:this.time+4.5+api.WHALE_WATER_SECONDS};this.floodWarnings.push(warning);
      e.windup=e.windupTotal=4.5;e.telegraph=[{laneMin:startLane,laneMax:startLane+1,x1:0,x2:BOARD_COLS,power:0}];e.skillName='海啸';e.submerged=true;
      this.emit('floodWarning',{cells,region:warning.region,seconds:4.5});this.emit('warning');
    }
    applyFlood(warning){
      for(const {lane,col} of warning.cells){
        const tile=this.terrain[lane][col];
        if(tile.waterUntil<=this.time){tile.waterStarted=this.time;tile.waterZone=warning.id;tile.waterRegion=warning.region;tile.waterUntil=Math.min(warning.until,this.time+api.WHALE_WATER_SECONDS);}
        else tile.waterUntil=Math.min(tile.waterUntil,(tile.waterStarted??this.time)+api.WHALE_WATER_SECONDS);
        for(const u of this.platformOccupants(lane,col))if(!this.platformAt(lane,col)){u.hp=0;this.drowned++;this.emit('unitLost',{kind:u.kind,reason:'flood'});this.feedback('被海啸卷走',lane,u.x,'#477b9a');}
      }
      for(const h of this.hazards)if(h.kind==='fire')h.cells=h.cells.filter(c=>!warning.cells.some(w=>sameCell(w,c.lane,c.col)));
      this.hazards=this.hazards.filter(h=>h.cells.length);
      this.emit('flood',{cells:warning.cells});this.refreshCombos();
    }
    drainWater(force=true){
      for(let lane=0;lane<BOARD_ROWS;lane++)for(let col=0;col<BOARD_COLS;col++){
        const tile=this.terrain[lane][col];if(!tile.waterUntil||(!force&&tile.waterUntil>this.time))continue;
        tile.waterUntil=0;const p=this.platformAt(lane,col),occupants=this.platformOccupants(lane,col);
        if(p&&occupants.length&&!occupants.some(u=>u.kind==='haiyue')){p.hp=0;occupants.forEach(u=>u.platformId=null);}
        this.emit('waterReceded',{lane,col});
      }
      if(force){this.floodWarnings=[];for(const e of this.enemies)if(e.kind==='whale'){e.telegraph=null;e.windup=0;}}
    }
    bossSkillPlan(e,i,anchor){
      const mechanic=ENEMIES[e.kind].mechanic;let name,areas;
      if(mechanic==='whale'){
        name=i%3===1?'拍浪':'潜伏跃击';
        areas=i%3===1?[{laneMin:Math.max(0,anchor.lane-1),laneMax:Math.min(4,anchor.lane+1),x1:0,x2:BOARD_COLS,power:1}]:[{laneMin:Math.max(0,anchor.lane-1),laneMax:Math.min(4,anchor.lane+1),x1:Math.max(0,anchor.x-1.3),x2:Math.min(BOARD_COLS,anchor.x+1.3),power:1.4}];
      }else if(mechanic==='fire'){
        name=i%2?'鬼火冲袭':'烈焰街道';areas=[{laneMin:anchor.lane,laneMax:anchor.lane,x1:Math.max(0,anchor.x-2),x2:Math.min(BOARD_COLS,anchor.x+2),power:1},...[anchor.lane-1,anchor.lane+1].filter(l=>l>=0&&l<5).map(l=>({laneMin:l,laneMax:l,x1:Math.max(0,anchor.x-1),x2:Math.min(BOARD_COLS,anchor.x+1),power:.75}))];
      }else if(mechanic==='song'){
        name=i%2?'荆棘舞台':'前排惑音';areas=[{laneMin:Math.max(0,anchor.lane-1),laneMax:Math.min(4,anchor.lane+1),x1:Math.max(0,anchor.x-1.3),x2:Math.min(BOARD_COLS,anchor.x+1.3),power:i%2?.85:.5}];
      }else if(mechanic==='laser'){
        name=i%2?'锁链囚笼':'锁链光束';areas=i%2?[{laneMin:Math.max(0,anchor.lane-1),laneMax:anchor.lane,x1:Math.max(0,anchor.x-1),x2:Math.min(BOARD_COLS,anchor.x+1),power:1}]:[{laneMin:anchor.lane,laneMax:anchor.lane,x1:0,x2:BOARD_COLS,power:1.5}];
      }else if(mechanic==='rhythm'){
        name=i%2?'重低音落点':'节拍震荡';areas=i%2?[{laneMin:Math.max(0,anchor.lane-1),laneMax:Math.min(4,anchor.lane+1),x1:Math.max(0,anchor.x-1),x2:Math.min(BOARD_COLS,anchor.x+1),power:1.2}]:[0,1,2,3,4].filter(l=>l%2===anchor.lane%2).map(l=>({laneMin:l,laneMax:l,x1:0,x2:BOARD_COLS,power:1}));
      }else if(mechanic==='tax'||mechanic==='debt'){
        name=mechanic==='tax'?(i%2?'黄金爪刃':'贪婪抽取'):(i%2?'契纸横扫':'追债突袭');areas=[{laneMin:Math.max(0,anchor.lane-(i%2)),laneMax:Math.min(4,anchor.lane+(i%2)),x1:Math.max(0,anchor.x-1),x2:Math.min(BOARD_COLS,anchor.x+1),power:i%2?1:1.3}];
      }else{
        const width=i%2?1:1.3;name={dream:e.enraged&&i%2?'梦境侵蚀':'尾扫',dive:i%2?'羽刃环舞':'俯冲',dust:i%2?'蝶粉':'棱光扇击',garden:'荆棘花园',web:i%2?'赤幕丝网':'赤幕圆舞'}[mechanic];
        areas=[{laneMin:Math.max(0,anchor.lane-1),laneMax:Math.min(4,anchor.lane+1),x1:Math.max(0,anchor.x-width),x2:Math.min(BOARD_COLS,anchor.x+width),power:1}];
      }
      return {name,areas};
    }
    bossComboStep(e,index=e.skillIndex){
      const chain=BOSS_SKILL_CHAINS[e.kind]||[['minor',0],['major',1]],position=index%chain.length;
      const [tier,variant]=chain[position],last=position===chain.length-1;
      return {tier,variant,position,total:chain.length,last,
        windup:tier==='minor'?1.35:2.5,
        recovery:last?BOSS_CADENCE.recovery:tier==='minor'?.35:.6,
        gap:last?(e.kind==='whale'?(e.enraged?BOSS_CADENCE.enragedWhaleSkill:BOSS_CADENCE.whaleSkill):(e.enraged?BOSS_CADENCE.enragedSkill:BOSS_CADENCE.skill)):(tier==='minor'?.55:.45)};
    }
    bossComboPlan(e,step,anchor){
      const plan=this.bossSkillPlan(e,step.variant,anchor);
      if(e.kind==='debtCollector'&&step.tier==='minor')return {name:'追债标记',areas:[{laneMin:anchor.lane,laneMax:anchor.lane,x1:Math.max(0,anchor.x-.45),x2:Math.min(BOARD_COLS,anchor.x+.45),power:0}]};
      if(e.kind==='butterfly'&&step.tier==='major'&&step.variant===0)plan.name='蝶影分身';
      if(e.kind==='bird'){
        if(step.tier==='minor')return {name:'追猎羽刃',areas:[{laneMin:anchor.lane,laneMax:anchor.lane,x1:Math.max(0,anchor.x-1),x2:Math.min(BOARD_COLS,anchor.x+1),power:.45}]};
        if(step.variant===1)return {name:'掠地俯冲',areas:[{laneMin:anchor.lane,laneMax:anchor.lane,x1:Math.max(0,anchor.x-1.9),x2:Math.min(BOARD_COLS,anchor.x+1.9),power:1.15}]};
        return {name:'逆风羽阵',areas:[{laneMin:Math.max(0,anchor.lane-1),laneMax:Math.min(4,anchor.lane+1),x1:Math.max(0,anchor.x-2),x2:Math.min(BOARD_COLS,anchor.x+2),power:.65}]};
      }
      if(e.kind==='serenetti'&&(step.variant===2||step.variant===0)){
        const front=this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground);
        plan.name=step.variant===2?'前排催眠曲':'前排惑音';plan.areas=[];
        for(let lane=0;lane<BOARD_ROWS;lane++){
          const crew=front.filter(u=>u.lane===lane).sort((a,b)=>b.x-a.x).slice(0,2);
          for(const u of crew)plan.areas.push({laneMin:lane,laneMax:lane,x1:Math.max(0,u.x-.45),x2:Math.min(BOARD_COLS,u.x+.45),power:.18});
        }
        if(!plan.areas.length)plan.areas=[{laneMin:anchor.lane,laneMax:anchor.lane,x1:8,x2:BOARD_COLS,power:.18}];
        return plan;
      }
      if(e.kind==='serenetti'&&step.variant===3)plan.name='终幕安眠曲';
      plan.areas=plan.areas.map(a=>step.tier==='minor'?{
        ...a,laneMin:anchor.lane,laneMax:anchor.lane,x1:Math.max(a.x1,anchor.x-1.1),x2:Math.min(a.x2,anchor.x+1.1),power:a.power*.45
      }:{...a,x1:Math.max(0,a.x1-.65),x2:Math.min(BOARD_COLS,a.x2+.65)}).filter(a=>a.x2>a.x1);
      // Alternating-lane signatures may collapse onto the same row in a minor cast.
      plan.areas=plan.areas.filter((a,i,all)=>all.findIndex(b=>b.laneMin===a.laneMin&&b.laneMax===a.laneMax&&b.x1===a.x1&&b.x2===a.x2)===i);
      return plan;
    }
    chargeBoss(e){
      const mechanic=ENEMIES[e.kind].mechanic;
      if(!mechanic){super.chargeBoss(e);e.moving=false;return;}
      const step=this.bossComboStep(e);e.skillIndex++;e.comboStep=step;e.skillFamily=step.tier;e.motionUntil=0;e.moving=false;
      if(mechanic==='whale'&&step.tier==='major'&&step.variant===0){this.warnFlood(e);return;}
      if(mechanic==='whale'&&step.variant===2){
        const wet=[];for(let lane=0;lane<BOARD_ROWS;lane++)for(let col=0;col<BOARD_COLS;col++)if(this.isWater(lane,col)){const hits=this.units.filter(u=>u.hp>0&&!u.oneShot&&Math.abs(u.lane-lane)<=1&&Math.abs(u.x-col-.5)<=1.95).length;wet.push({lane,col,x:col+.5,score:hits*100-Math.abs(col-6)-Math.abs(lane-(e.travelLane??e.lane))*.1});}
        wet.sort((a,b)=>b.score-a.score);
        const anchor=this.selectWhaleLanding?.(e)||wet[0];
        if(anchor){const plan=this.bossComboPlan(e,step,anchor);e.diveOrigin={x:e.x,lane:e.travelLane??e.lane};e.diveTarget={x:anchor.x,lane:anchor.lane};e.skillAnchor={...anchor};e.diveDryLanding=!this.isWater(anchor.lane,anchor.col);e.diveReturning=0;e.diveLift=0;e.skillName=plan.name;e.telegraph=plan.areas;e.windup=e.windupTotal=step.windup;e.submerged=false;this.emit('warning');return;}
      }
      let anchor=this.selectBossTarget(e,a=>this.bossComboPlan(e,step,a).areas,['tax','debt'].includes(mechanic));
      if(e.kind==='debtCollector'&&step.tier==='minor'){
        const target=this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground).sort((a,b)=>(b.kind==='chiz')-(a.kind==='chiz')||Math.abs(a.lane-e.lane)-Math.abs(b.lane-e.lane)||a.id-b.id)[0];
        e.debtTargetId=target?.id??null;if(target)anchor={lane:target.lane,col:target.col,x:target.x};
      }
      const plan=this.bossComboPlan(e,step,anchor);
      if(mechanic==='whale'&&step.variant===2){const fallback=this.bossComboPlan(e,{...step,variant:1},anchor);plan.name=fallback.name;plan.areas=fallback.areas;}
      if(mechanic==='whale')e.submerged=step.variant===2;
      if(e.kind==='bird'&&step.tier==='major'){
        e.featherGuardUntil=this.time+step.windup+1;
        if(step.variant===1)e.birdSwoop={origin:{x:e.x,lane:e.travelLane??e.lane},target:{x:anchor.x,lane:anchor.lane},returning:0};
      }
      if(e.kind==='butterfly'&&step.tier==='major'&&step.variant===0)this.startButterflyEchoes(e);
      e.skillName=plan.name;e.telegraph=plan.areas;e.windup=e.windupTotal=step.windup;e.skillAnchor={...anchor};this.emit('warning');
    }
    bossSkillDamage(e,area){
      if(e.kind==='whale'&&e.skillName==='海啸')return 0;
      const profile=BOSS_THREAT[e.kind];
      const base=e.kind==='whale'&&e.skillName==='潜伏跃击'?269:profile?.burst||168;
      return Math.round(base*(area.power??1)*(e.enraged?1.2:1)*(e.status.weakUntil>this.time?.8:1));
    }
    bossSkillHitAmount(u,amount){
      // Clamp before applying damage so shields, counters and unitLost events stay truthful.
      const floor=u.kind==='chiz'?0:Math.max(1,Math.ceil(u.maxHp*BOSS_SKILL_HP_FLOOR));
      const hpBudget=Math.max(0,u.hp-floor);
      const protector=u.kind!=='adler'&&this.units.find(v=>v.kind==='adler'&&v.hp>0&&v.lane===u.lane&&v.col===u.col+1&&v.shield>0);
      const budget=hpBudget+(u.shield||0),shield=protector?.shield||0;
      return Math.min(amount,budget+shield,budget/.3);
    }
    damageBossSkill(u,amount){this.damageUnit(u,this.bossSkillHitAmount(u,amount));}
    releaseBoss(e){
      const d=ENEMIES[e.kind],mechanic=d.mechanic;if(!mechanic){this.resolvingBossSkill=true;try{super.releaseBoss(e);}finally{this.resolvingBossSkill=false;}e.commandAt=this.time+BOSS_CADENCE.commandDelay;e.shot=e.enraged?BOSS_CADENCE.enragedSkill:BOSS_CADENCE.skill;return;}
      if(mechanic==='whale'&&e.skillName==='海啸'){
        const areas=this.bossAreas(e).map(a=>({...a}));this.effects.push({kind:'bossPulse',boss:e.kind,lane:e.lane,x:e.x,areas,ttl:1.35,total:1.35,heavy:true,flood:true});
        for(const w of this.floodWarnings.filter(w=>w.bossId===e.id))this.applyFlood(w);this.floodWarnings=this.floodWarnings.filter(w=>w.bossId!==e.id);
      }else{
        const areas=this.bossAreas(e),mult=e.enraged?1.18:1;
        for(const u of this.units){const area=areas.find(a=>u.lane>=a.laneMin&&u.lane<=a.laneMax&&u.x>=a.x1&&u.x<=a.x2);if(area){this.damageBossSkill(u,this.bossSkillDamage(e,area));if(mechanic==='dust'||mechanic==='dream'&&e.enraged&&e.skillName==='梦境侵蚀')u.dotUntil=this.time+5;
          if(mechanic==='song'&&e.skillName==='前排惑音'&&!['chiz','iroi','adler'].includes(u.kind)&&this.random()<(e.status.weakUntil>this.time?.12:.45)){u.confusedUntil=this.time+4.5;this.feedback('惑音 · 反攻',u.lane,u.x,'#a777b5');this.emit('confused',{kind:u.kind});}
          if(mechanic==='song'&&['前排催眠曲','终幕安眠曲'].includes(e.skillName)&&u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground){
            const duration=(e.skillName==='前排催眠曲'?2.8:1.8)*(e.status.weakUntil>this.time?.5:1);
            u.sleepUntil=Math.max(u.sleepUntil||0,this.time+duration);this.feedback('沉睡',u.lane,u.x,'#8d7cc1');this.emit('sleep',{kind:u.kind,seconds:duration});
          }
        }}
        if(mechanic==='whale'){e.submerged=false;e.breachUntil=this.time+3;if(e.diveTarget){e.x=e.diveTarget.x;e.travelLane=e.diveTarget.lane;e.lane=e.diveTarget.lane;e.diveLift=0;e.diveReturnFrom={...e.diveTarget};e.diveReturning=e.diveReturnTotal=1.1;}for(const p of this.platforms)if(areas.some(a=>p.lane>=a.laneMin&&p.lane<=a.laneMax&&p.x>=a.x1&&p.x<=a.x2))this.damagePlatform(p,35*mult);}
        if(e.kind==='bird'&&e.birdSwoop){const f=e.birdSwoop;e.x=f.target.x;e.travelLane=f.target.lane;e.lane=f.target.lane;e.swoopLift=0;f.returnFrom={...f.target};f.returning=.9;}
        if(e.kind==='bird'&&e.skillName==='逆风羽阵'){
          const cells=[];for(const a of areas)for(let lane=a.laneMin;lane<=a.laneMax;lane++)for(let col=Math.max(0,Math.floor(a.x1));col<Math.min(BOARD_COLS,Math.ceil(a.x2));col++)cells.push({lane,col});
          this.hazards=this.hazards.filter(h=>h.bossId!==e.id||h.kind!=='headwind');
          this.hazards.push({id:this.nextId++,bossId:e.id,kind:'headwind',cells,until:this.time+(e.status.weakUntil>this.time?5:8)});this.feedback('逆风羽阵 · 攻击减速',e.skillAnchor.lane,e.skillAnchor.x,'#96669f');
        }
        if(['garden','dive'].includes(mechanic))for(let n=0;n<2;n++){const child=this.spawn(mechanic==='dive'?'flyer':'petalThrall',(e.lane+n*2)%5);if(child){child.x=BOARD_COLS-.2;child.summonerId=e.id;}}
        if(['fire','web','dust','laser','rhythm'].includes(mechanic)||mechanic==='dream'&&e.enraged&&e.skillName==='梦境侵蚀'||mechanic==='song'&&e.skillName==='荆棘舞台'){
          const cells=[];for(const a of areas)for(let lane=a.laneMin;lane<=a.laneMax;lane++)for(let col=Math.floor(a.x1);col<Math.ceil(a.x2);col++)if(col>=0&&col<BOARD_COLS)cells.push({lane,col});
          const kind=mechanic==='song'?'thorns':mechanic==='fire'?'fire':mechanic==='web'?'web':mechanic==='laser'?'chains':mechanic==='rhythm'?'beat':mechanic==='dream'?'dream':'dust';
          const affected=kind==='fire'?cells.filter(c=>!this.isWater(c.lane,c.col)):cells;
          if(affected.length){
            // Recasting refreshes a tile; one boss must not multiply its burn by overlapping casts.
            for(const h of this.hazards)if(h.bossId===e.id&&h.kind===kind)h.cells=h.cells.filter(c=>!affected.some(a=>sameCell(a,c.lane,c.col)));
            this.hazards=this.hazards.filter(h=>h.cells.length);
            this.hazards.push({id:this.nextId++,bossId:e.id,kind,cells:affected,until:this.time+(e.comboStep?.tier==='minor'?4:e.status.weakUntil>this.time?6:10),...(kind==='beat'?{beatIn:2,beatPeriod:2,beatDamage:18,beatFlash:0}: {})});
          }
        }
        if(mechanic==='tax'&&e.skillName==='贪婪抽取'){const amount=Math.min(70,Math.floor(this.money*.16));this.money-=amount;e.taxed+=amount;this.emit('tax',{amount});}
        if(e.kind==='debtCollector'&&e.skillName==='追债标记')this.startDebt(e);
        this.effects.push({kind:'bossPulse',boss:e.kind,skillName:e.skillName,tier:e.comboStep?.tier,lane:e.lane,x:e.x,areas:areas.map(a=>({...a})),ttl:1.2,total:1.2,heavy:e.comboStep?.tier!=='minor'});
      }
      const step=e.comboStep||{last:true,recovery:BOSS_CADENCE.recovery,gap:BOSS_CADENCE.skill};
      e.windup=0;e.telegraph=null;e.recovery=Math.max(step.recovery,e.birdSwoop?.9:0);e.anim=1;e.motion='skill';e.motionUntil=this.time+Math.min(1.05,e.recovery);e.commandAt=step.last?this.time+BOSS_CADENCE.commandDelay:0;e.shot=step.gap;this.emit('bossSkill',{kind:e.kind,tier:step.tier,chainEnd:step.last});
    }
    summonBossTroops(e,command=false){
      const minions=this.enemies.filter(v=>!ENEMIES[v.kind].boss&&v.hp>0).length;
      const count=Math.min(command?BOSS_CADENCE.commandSize:BOSS_CADENCE.reinforcementSize,Math.max(0,BOSS_CADENCE.minionLimit-minions));
      const troops=ENEMIES[e.kind].troops,startLane=Math.floor(this.random()*BOARD_ROWS);
      for(let i=0;i<count;i++){const child=this.spawn(troops[(e.skillIndex+i)%troops.length],(startLane+i*2)%BOARD_ROWS);if(child){child.x=BOARD_COLS+.25+Math.floor(i/BOARD_ROWS)*.6;child.summonerId=e.id;}}
      e.minionClock=this.endless?Math.max(8,BOSS_CADENCE.reinforcementInterval-this.wave*.1):BOSS_CADENCE.reinforcementInterval;
      if(command)this.commandBossTroops(e);
      if(!count)return;
      e.summonUntil=this.time+(command?1.3:.8);e.shot=Math.max(e.shot,.9);
      this.effects.push({kind:'summonRing',lane:e.lane,x:e.x,color:ENEMIES[e.kind].mechanic==='fire'?'#42b5dc':'#b589b6',ttl:1,total:1});
      if(command)this.feedback('号令进攻 · '+count+' 只增援',e.lane,e.x-1.4,'#9b4e74');
      this.emit('reinforcements',{kind:e.kind,count,command});
    }
    commandBossTroops(e){
      const order=BOSS_TROOP_ORDERS[e.kind];if(!order)return;
      const troops=this.enemies.filter(v=>v.hp>0&&!ENEMIES[v.kind].boss&&!v.controlCat&&(v.summonerId===e.id||!v.summonerId&&ENEMIES[e.kind].troops.includes(v.kind)));
      const shift=(v,lane)=>{if(v.lane!==lane){v.troopShift={from:v.lane,to:lane,started:this.time,duration:.65};v.lane=lane;}};
      if(order.swap){const sorted=[...troops].sort((a,b)=>a.lane-b.lane||a.x-b.x);for(let i=0;i<Math.floor(sorted.length/2);i++){const a=sorted[i],b=sorted[sorted.length-1-i],lane=a.lane;shift(a,b.lane);shift(b,lane);}}
      if(order.focus){const lanes=Array.from({length:BOARD_ROWS},(_,lane)=>({lane,hp:this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane===lane).reduce((s,u)=>s+u.hp,0)})).sort((a,b)=>a.hp-b.hp||a.lane-b.lane);for(const v of troops)if(v.x>=BOARD_COLS-.5)shift(v,lanes[0].lane);}
      for(const v of troops){
        v.summonerId=e.id;v.orderKind=e.kind;v.orderUntil=this.time+order.duration;
        if(order.shield)v.orderShield=order.shield;
        if(order.armor)v.orderArmor=order.armor;
        if(order.heal)v.hp=Math.min(v.maxHp,v.hp+v.maxHp*order.heal);
        if(order.rescue&&v.hp<v.maxHp*.6){v.x=Math.min(BOARD_COLS+.8,v.x+1);v.hp=Math.min(v.maxHp,v.hp+v.maxHp*.15);this.effects.push({kind:'silkRescue',lane:v.lane,x:v.x,ttl:.7,total:.7});}
      }
      e.lastOrder=order.name;e.orderUntil=this.time+order.duration;
      this.feedback(order.name,e.lane,e.x-1.5,'#a373b5');this.emit('troopOrder',{boss:e.kind,bossId:e.id,name:order.name,count:troops.length});
    }
    updateBossNormal(e,dt){
      if(!ENEMIES[e.kind].boss||!this.isBossControlProtected?.(e)&&(e.stunUntil>this.time||this.isLaneFrozen(e.travelLane??e.lane)))return;
      if(e.normalCast){
        e.normalCast.left-=dt*(e.status.slow>this.time?.85:1);
        if(e.normalCast.left<=0){
          const a=e.normalCast.area;for(const u of this.units)if(u.hp>0&&!u.oneShot&&u.lane===a.laneMin&&u.x>=a.x1&&u.x<=a.x2)this.damageUnit(u,(BOSS_THREAT[e.kind]?.normal||79)*(e.enraged?1.2:1));
          this.effects.push({kind:'bossPulse',boss:e.kind,lane:e.lane,x:e.x,areas:[a],ttl:.55,total:.55,normal:true});
          e.normalCast=null;e.motion='normal';e.motionUntil=this.time+.22;e.normalTimer=Math.max(0,(e.enraged?BOSS_CADENCE.enragedNormal:BOSS_CADENCE.normal)-BOSS_CADENCE.normalWindup);
        }return;
      }
      e.normalTimer=(e.normalTimer??BOSS_CADENCE.firstNormal)-dt;
      if(e.normalTimer>0||e.windup>0||e.recovery>0||e.motionUntil>this.time)return;
      if(e.comboStep&&!e.comboStep.last&&e.shot<1)return;
      const distance=u=>Math.hypot(e.x-u.x,(e.travelLane??e.lane)-u.lane);
      const target=this.units.filter(u=>u.hp>0&&!u.oneShot&&distance(u)<=BOSS_CADENCE.normalRange).sort((a,b)=>b.hp-a.hp||distance(a)-distance(b)||a.id-b.id)[0];if(!target){e.normalTimer=.4;return;}
      e.normalCast={left:BOSS_CADENCE.normalWindup,total:BOSS_CADENCE.normalWindup,targetId:target.id,area:{laneMin:target.lane,laneMax:target.lane,x1:Math.max(0,target.x-BOSS_CADENCE.normalHalfWidth),x2:Math.min(BOARD_COLS,target.x+BOSS_CADENCE.normalHalfWidth),power:1}};
    }
    resolveCrewCast(u){
      const cast=u.pendingCast;u.pendingCast=null;if(!cast||u.hp<=0)return;
      const d=UNITS[u.kind],opts={attribute:d.attribute,sourceLane:u.lane};
      if(cast.kind==='wind'){
        this.projectiles.push({kind:'wind',lane:u.lane,sourceLane:u.lane,x:u.x+.3,speed:3.6,damage:32,ttl:4,hitIds:[],attribute:d.attribute});u.anim=.58;this.emit('attack',{kind:u.kind});
      }else if(cast.kind==='bite'){
        const target=this.enemies.find(e=>e.id===cast.targetId&&e.hp>0);
        if(!target||!this.targetable(target,u)||!this.inLane(target,u.lane)||target.x<u.x-.35||target.x-u.x>d.range){u.anim=0;u.timer=.35;return;}
        const swallowed=!!ENEMIES[target.kind].swallowable;
        if(swallowed){this.effects.push({kind:'gulp',enemy:target.kind,lane:target.lane,sourceLane:u.lane,x:target.x,mouthX:u.x+.64,ttl:.48,total:.48});this.kill(target,true);u.digest=12;}
        else{this.damageEnemy(target,200,{...opts,bypass:true,impact:'bite'});u.digest=6;this.feedback('重咬 · 无法整吞',u.lane,u.x,'#967250');}
        u.anim=.95;this.emit('attack',{kind:u.kind});
      }
    }
    attackUnits(dt){
      for(const u of this.units){
        if(u.hp<=0)continue;const d=UNITS[u.kind];
        if(u.kind==='daffodil'&&this.time-(u.duelLastHit??-Infinity)>d.comboTimeout){u.duelStacks=0;u.duelTarget=null;}
        u.anim=Math.max(0,u.anim-dt);u.hurt=Math.max(0,u.hurt-dt);u.digest=Math.max(0,u.digest-dt);u.born=Math.max(0,(u.born||0)-dt);
        u.shieldFlash=Math.max(0,(u.shieldFlash||0)-dt);
        if(u.sleepUntil>this.time){u.anim=0;continue;}
        if(u.pendingCast){u.pendingCast.left-=dt;if(u.pendingCast.left<=0)this.resolveCrewCast(u);continue;}
        if(u.kind==='mintCat'){
          if(u.catState==='waiting'){
            const target=this.enemies.filter(e=>e.hp>0&&!ENEMIES[e.kind].boss&&!ENEMIES[e.kind].air&&!e.controlCat&&e.lane===u.lane&&Math.abs(e.x-u.x)<.7).sort((a,b)=>Math.abs(a.x-u.x)-Math.abs(b.x-u.x))[0];
            if(target){u.catState='hissing';u.catTarget=target.id;u.catTimer=.35;u.anim=1;this.emit('catHiss');}
          }else{
            u.catTimer-=dt;const target=this.enemies.find(e=>e.id===u.catTarget&&e.hp>0);
            if(!target||target.controlCat){u.catState='waiting';u.catTarget=null;u.anim=0;continue;}
            if(u.catState==='hissing'&&u.catTimer<=0){u.catState='leaping';u.catTimer=.42;u.catStartX=u.x;this.emit('catLeap');}
            else if(u.catState==='leaping'&&u.catTimer<=0){
              if(Math.abs(target.x-u.x)>.95){u.catState='waiting';u.catTarget=null;u.anim=0;continue;}
              target.controlCat={kind:'mintCat',id:u.id};target.reverseUntil=this.time+CAT_CONTROL_SECONDS;target.attack=.35;u.hp=0;
              this.feedback('命中 · 反攻 8s',target.lane,target.x,'#408f87');this.emit('catControl',{enemy:target.kind});
            }
          }
          continue;
        }
        if(u.oneShot){u.lifetime-=dt;u.castAt-=dt;if(!u.cast&&u.castAt<=0)this.castOneShot(u);if(u.lifetime<=0)u.hp=0;continue;}
        if(u.expiresAt&&u.expiresAt<=this.time){u.hp=0;this.emit('trapExpired',{kind:u.kind});continue;}
        if(u.dotUntil>this.time)this.damageUnit(u,7*dt);
        const hex=this.hazards.some(h=>['web','chains'].includes(h.kind)&&h.cells.some(c=>sameCell(u,c.lane,c.col)));
        const headwind=!['chiz','adler'].includes(u.kind)&&!d.ground&&this.birdWindAt(u.lane,u.col);
        u.timer-=dt*(this.time<this.supportUntil?1.55:1)*(hex||headwind?.65:1);if(u.timer>0)continue;
        if(u.confusedUntil>this.time){
          const friend=this.units.filter(v=>v.hp>0&&v!==u&&!v.oneShot&&v.lane===u.lane&&v.x<u.x).sort((a,b)=>b.x-a.x)[0];
          if(friend)this.projectiles.push({kind:'betrayal',lane:u.lane,x:u.x-.25,speed:-4.2,damage:20,targetId:friend.id,ttl:3});u.anim=.7;u.timer=Math.max(1.4,d.interval);continue;
        }
        if(u.kind==='chiz'){this.dropCoin(u.lane,u.x+.12,d.production);u.timer=d.interval;u.anim=.7;this.effects.push({kind:'stamp',lane:u.lane,x:u.x,value:d.production,ttl:.65,total:.65});this.emit('produce');continue;}
        if(u.kind==='adler'){u.shield=180;u.timer=d.interval;u.anim=.7;this.effects.push({kind:'shieldRaise',lane:u.lane,x:u.x,ttl:.7,total:.7});this.emit('shield');continue;}
        if(u.kind==='iroi'){
          const target=this.enemies.filter(e=>e.hp>0&&!e.controlCat&&!(e.entryUntil>this.time)&&this.inLane(e,u.lane)&&e.x>=u.x-.35).sort((a,b)=>a.x-b.x)[0];
          if(!target)continue;
          this.projectiles.push({kind:'sheep',lane:u.lane,sourceLane:u.lane,x:u.x+.15,startX:u.x,startLane:u.lane,sourceId:u.id,targetId:target.id,age:0,duration:Math.max(.4,Math.min(1.4,Math.abs(target.x-u.x)/4.5)),damage:16,ttl:2,attribute:d.attribute});
          u.anim=.7;u.timer=d.interval;this.emit('attack',{kind:u.kind});continue;
        }
        const targets=this.enemies.filter(e=>this.targetable(e,u)&&!e.controlCat&&this.inLane(e,u.lane)&&(u.kind==='skia'?Math.abs(e.x-u.x)<.5:e.x>=u.x-.35)).sort((a,b)=>a.x-b.x);
        if(!targets.length||u.digest>0)continue;const target=u.kind==='daffodil'?(targets.find(e=>ENEMIES[e.kind].boss&&this.attackDistance(e,u)<=d.range)||targets[0]):targets[0],dist=target.x-u.x,opts={attribute:d.attribute,sourceLane:u.lane};
        if(u.kind==='skia'){
          const stepped=targets.filter(e=>e.lane===u.lane&&Math.floor(e.x)===u.col&&!ENEMIES[e.kind].air);if(!stepped.length)continue;
          stepped.forEach(e=>this.damageEnemy(e,24,{...opts,bypass:true,impact:'shadow'}));this.effects.push({kind:'shadowSpike',lane:u.lane,x:u.x,ttl:.4,total:.4});
        }else if(u.kind==='mint'){u.pendingCast={kind:'wind',left:.2,total:.2};u.anim=.8;u.timer=d.interval;continue;}
        else if(u.kind==='sakiri'){
          if(dist>d.range||ENEMIES[target.kind].air)continue;u.pendingCast={kind:'bite',left:.24,total:.24,targetId:target.id};u.anim=1.2;u.timer=d.interval;continue;
        }else if(u.kind==='daffodil'){
          if(this.attackDistance(target,u)>d.range)continue;
          u.duelStacks=u.duelTarget===target.id?Math.min(d.comboMax,(u.duelStacks||0)+1):1;u.duelTarget=target.id;u.duelLastHit=this.time;
          this.damageEnemy(target,ENEMIES[target.kind].boss?d.bossDamage:d.damage,{...opts,shred:30,impact:'slash'});this.effects.push({kind:'slash',lane:u.lane,x:u.x+.6,combo:u.duelStacks,ttl:.3,total:.3});
        }else if(u.kind==='nanally'){
          if(u.target===target.id)u.streak++;else{u.target=target.id;u.streak=1;}for(let i=0;i<(u.streak>=3?2:1);i++)this.projectiles.push({kind:'paw',lane:u.lane,sourceLane:u.lane,x:u.x+.2-i*.22,speed:6.2,damage:28,ttl:4,attribute:d.attribute});
        }else if(u.kind==='requiem'){
          const destination=targets.find(e=>e.x>target.x+.6)||target;this.projectiles.push({kind:'tomato',lane:u.lane,sourceLane:u.lane,x:u.x,startX:u.x,endX:destination.x,age:0,duration:.82,ttl:1.5,damage:34,attribute:d.attribute});
        }else if(u.kind==='haiyue'){
          const caught=targets.filter(e=>this.attackDistance(e,u)<=d.range);if(!caught.length)continue;
          for(const e of caught)this.damageEnemy(e,d.damage,{...opts,underwater:true,impact:'jellySpray'});
          this.effects.push({kind:'jellySpray',lane:u.lane,x:u.x,endX:u.x+d.range,ttl:.55,total:.55});
        }
        u.anim=u.kind==='sakiri'?1:.7;u.timer=d.interval/(u.kind==='daffodil'?1+(u.duelStacks||0)*d.comboStep:1);this.emit('attack',{kind:u.kind});
      }
    }
    updateProjectiles(dt){
      for(const p of this.projectiles){
        if(p.ttl<=0||['can','betrayal'].includes(p.kind)&&this.isLaneFrozen(p.lane))continue;const travelDt=Math.min(dt,p.ttl);p.ttl-=dt;
        if(p.kind==='betrayal'){
          const old=p.x;p.x+=p.speed*dt;const hit=this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane===p.lane&&u.x<old+.2&&u.x>=p.x-.3).sort((a,b)=>b.x-a.x)[0];if(hit){this.damageUnit(hit,p.damage);p.ttl=0;}
        }else if(p.kind==='tomato'){
          p.age+=dt;p.x=p.startX+(p.endX-p.startX)*Math.min(1,p.age/p.duration);
          if(p.age>=p.duration&&!p.hit){p.hit=true;p.ttl=0;this.emit('splat');this.effects.push({kind:'impact',impact:'tomato',lane:p.lane,x:p.endX,ttl:.4,total:.4});this.pools.push({lane:p.lane,sourceLane:p.sourceLane,sourceKind:p.sourceKind,sourceId:p.sourceId,x:p.endX,ttl:4,tick:0,attribute:p.attribute,radius:p.rank>1?1.3:.95,damageScale:p.damageScale??(p.rank===3?2.6:p.rank===2?1.65:1)});for(const e of this.enemies)if(e.hp>0&&!e.controlCat&&this.inLane(e,p.lane)&&Math.abs(e.x-p.endX)<.9)this.damageEnemy(e,p.damage,{attribute:p.attribute,sourceLane:p.sourceLane,sourceKind:p.sourceKind,sourceId:p.sourceId,bypass:true,impact:'tomato'});}
        }else if(p.kind==='homing'){
          let target=this.enemies.find(e=>e.id===p.targetId&&e.hp>0&&!e.controlCat);if(!target){target=this.enemies.filter(e=>e.hp>0&&!e.controlCat).sort((a,b)=>a.x-b.x)[0];if(!target){p.ttl=0;continue;}p.targetId=target.id;}
          p.targetLane=target.lane;p.lane+=(target.lane-p.lane)*Math.min(1,dt*5);p.x+=Math.sign(target.x-p.x)*p.speed*dt;
          if(Math.abs(p.x-target.x)<.4&&Math.abs(p.lane-target.lane)<.3){this.damageEnemy(target,p.damage,{attribute:p.attribute,sourceLane:p.sourceLane,sourceKind:p.sourceKind,sourceId:p.sourceId});p.ttl=0;}
        }else if(p.kind==='sheep'||p.kind==='flower'){
          const target=this.enemies.find(e=>e.id===p.targetId&&e.hp>0&&!e.controlCat&&!(e.entryUntil>this.time));
          if(!target){p.ttl=0;continue;}
          p.age+=dt;const progress=Math.min(1,p.age/p.duration);p.x=p.startX+(target.x-p.startX)*progress;p.lane=p.startLane+(target.lane-p.startLane)*progress;
          if(progress>=1){
            p.ttl=0;this.damageEnemy(target,p.damage,{attribute:p.attribute,sourceLane:p.sourceLane,sourceKind:p.sourceKind,sourceId:p.sourceId,reaction:p.kind==='flower',bypass:p.kind==='flower',impact:p.kind});
            if(p.kind==='sheep'){
              const owner=this.units.find(u=>u.id===p.sourceId&&u.hp>0);
              if(owner){
                owner.healRangeUntil=this.time+.8;
                for(const v of this.units)if(v.hp>0&&!v.oneShot&&!UNITS[v.kind].ground&&Math.abs(v.lane-owner.lane)<=1&&Math.abs(v.x-owner.x)<=2.05){
                  const heal=Math.min(Math.max(0,v.maxHp-v.hp),28);v.hp+=heal;this.healing+=heal;
                  if(heal){this.effects.push({kind:'sheepHeal',lane:v.lane,x:v.x,fromX:target.x,fromLane:target.lane,ttl:.65,total:.65});this.effects.push({kind:'heal',lane:v.lane,x:v.x,text:'+'+Math.round(heal),color:'#4f9a81',ttl:.8,total:.8});}
                  if(v.confusedUntil>this.time)v.confusedUntil=Math.max(this.time,v.confusedUntil-1.2);
                  if(v.sleepUntil>this.time)v.sleepUntil=Math.max(this.time,v.sleepUntil-1.2);
                }
                this.emit('heal');
              }
            }else{
              this.effects.push({kind:'flowerImpact',lane:target.lane,x:target.x,ttl:.45,total:.45});
              if(p.surplus&&target.status.slow>this.time)for(const u of this.units.filter(u=>u.hp>0&&!u.oneShot&&u.lane===p.sourceLane)){const heal=Math.min(4,u.maxHp-u.hp);u.hp+=heal;this.healing+=heal;}
            }
          }
        }else if(p.kind==='wind'||p.kind==='dragonflame'){
          const old=p.x,next=p.x+p.speed*travelDt,receiver=p.kind==='wind'?this.mintWindReceiver?.(p,old,next):null;
          p.x=receiver?Math.max(old,receiver.x-.25-(p.radius||.4)):Math.min(next,p.endX??Infinity);
          const limit=receiver?p.x:p.kind==='dragonflame'?Math.min(p.x+(p.radius||.4),p.endX):p.x+(p.radius||.4);
          for(const e of this.enemies.filter(e=>e.hp>0&&!e.controlCat&&this.inLane(e,p.lane)&&e.x>=old-(p.radius||.4)&&e.x<=limit&&!p.hitIds.includes(e.id)).sort((a,b)=>a.x-b.x)){const scale=Math.max(p.minimumScale??1,1-(p.falloff||0)*p.hitIds.length);p.hitIds.push(e.id);this.damageEnemy(e,p.damage*scale,{attribute:p.attribute,sourceLane:p.sourceLane,sourceKind:p.sourceKind,sourceId:p.sourceId,impact:p.kind});if(p.slowSeconds)e.status.slow=this.time+p.slowSeconds;if(p.burnSeconds)e.status.burn=this.time+p.burnSeconds;}
          if(receiver)this.convertMintWind(p,receiver);else if(p.endX!==undefined&&next>=p.endX)p.ttl=0;
        }else if(p.kind==='can'){
          p.x-=3.3*dt;const hit=this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane===p.lane&&Math.abs(u.x-p.x)<.45).sort((a,b)=>b.x-a.x)[0];if(hit){this.damageBossSkill(hit,p.damage||28);p.ttl=0;}
        }else{
          const old=p.x;p.x+=p.speed*dt;const locked=p.kind==='paw'&&p.targetId&&this.enemies.some(t=>t.id===p.targetId&&t.hp>0&&!t.controlCat)?p.targetId:null;const hit=this.enemies.filter(e=>e.hp>0&&!e.controlCat&&this.inLane(e,p.lane)&&(!locked||e.id===locked)&&e.x>=old-.4&&e.x<=p.x+.4).sort((a,b)=>a.x-b.x)[0];if(hit){this.damageEnemy(hit,p.damage,{attribute:p.attribute,sourceLane:p.sourceLane,sourceKind:p.sourceKind,sourceId:p.sourceId,impact:p.kind});p.ttl=0;}
        }
      }
      for(const p of this.pools){p.ttl-=dt;p.tick-=dt;if(p.tick<=0){p.tick=.5;for(const e of this.enemies)if(e.hp>0&&!e.controlCat&&this.inLane(e,p.lane)&&Math.abs(e.x-p.x)<(p.radius||.95))this.damageEnemy(e,10*(p.damageScale||1),{attribute:p.attribute,sourceLane:p.sourceLane,sourceKind:p.sourceKind,sourceId:p.sourceId,bypass:true,show:false});}}
    }
    updateReactions(dt){
      this.refreshCombos();this.reactionClock-=dt;
      if(this.reactionClock<=0){this.reactionClock=1;
        for(const e of this.enemies){if(e.hp<=0||e.controlCat)continue;const combos=this.activeReactions(e),sourceFor=id=>e.reactionLanes[id]??e.lane;
          if(combos.includes('burn'))this.damageEnemy(e,12,{bypass:true,show:false,reaction:true,sourceLane:sourceFor('burn')});
          if(combos.includes('star')){if(this.time>=e.starAt){this.damageEnemy(e,72,{bypass:true,reaction:true,sourceLane:sourceFor('star')});e.starAt=this.time+5;this.effects.push({kind:'starBurst',lane:e.lane,x:e.x,ttl:.7,total:.7});}}
          else e.starAt=0;
        }
      }
      this.flowers=this.flowers.filter(f=>f.until>this.time);
      for(const f of this.flowers){
        f.timer-=dt;
        if(f.timer<=0){
          const target=this.enemies.filter(e=>e.hp>0&&!e.controlCat&&!(e.entryUntil>this.time)&&this.inLane(e,f.lane)&&e.x>=f.x-.3).sort((a,b)=>a.x-b.x)[0];
          if(target){const surplus=target.status.surplus>this.time;this.projectiles.push({kind:'flower',lane:f.lane,startLane:f.lane,sourceLane:f.lane,x:f.x,startX:f.x,targetId:target.id,age:0,duration:Math.max(.35,Math.min(1.1,Math.abs(target.x-f.x)/6)),damage:surplus?32:20,ttl:1.5,surplus});}
          f.timer=2;
        }
      }
    }
    updateEnemies(dt){
      for(const e of this.enemies){
        if(e.hp<=0)continue;const d=ENEMIES[e.kind];e.hurt=Math.max(0,e.hurt-dt);e.attack-=dt;e.anim=Math.max(0,e.anim-dt);e.enter=Math.max(0,e.enter-dt);
        if(d.illusion){const owner=this.enemies.find(v=>v.id===e.illusionOwner&&v.hp>0);if(!owner||owner.mirrorsUntil<=this.time){e.hp=0;e.dead=true;}continue;}
        if(e.controlCat&&e.reverseUntil<=this.time){e.controlCat=null;e.reverseUntil=0;e.attack=.4;this.feedback('反攻结束',e.lane,e.x,'#6e7974');}
        if(e.entryUntil>this.time){e.attack+=dt;continue;}
        const protectedCast=this.isBossControlProtected?.(e);
        if(!protectedCast&&this.isLaneFrozen(e.travelLane??e.lane)){e.attack+=dt;if(e.mirrorsUntil>this.time-dt)e.mirrorsUntil+=dt;if(e.exposedUntil>this.time-dt)e.exposedUntil+=dt;continue;}
        if(!protectedCast&&this.time<e.stunUntil){e.attack+=dt;continue;}
        if(e.kind==='debtCollector')this.updateDebt(e,dt);
        if(e.kind==='butterfly'&&e.mirrorsUntil&&e.mirrorsUntil<=this.time)this.clearButterflyEchoes(e);
        if(d.boss&&!this.updateWhaleDive(e,dt)&&!this.updateBirdSwoop(e,dt))this.moveBoss(e,dt);
        if(e.controlCat){
          const target=this.enemies.filter(v=>v!==e&&v.hp>0&&!v.controlCat&&this.inLane(v,e.lane)&&v.x>=e.x-.12).sort((a,b)=>a.x-b.x)[0];
          if(target&&target.x-e.x<.75){
            if(e.attack<=0){this.damageEnemy(target,e.damage,{sourceLane:e.lane,impact:'counterattack'});e.attack=1;e.anim=.4;this.effects.push({kind:'counterattack',lane:e.lane,x:e.x,targetX:target.x,ttl:.35,total:.35});}
          }else e.x=Math.min(BOARD_COLS+.8,e.x+Math.max(.16,e.speed)*1.3*dt);
          continue;
        }
        e.recovery=Math.max(0,e.recovery-dt);
        if(d.boss&&!e.enraged&&e.hp<=e.maxHp*.5){e.enraged=true;e.phaseUntil=this.time+1.2;this.effects.push({kind:'bossBuff',lane:e.lane,x:e.x,color:'#b64960',ttl:1.2,total:1.2});this.feedback('半血狂暴 · 攻击加强',e.lane,e.x,'#b64960');this.emit('warning');}
        if(e.kind==='whale')e.submerged=!e.diveTarget&&(!e.breachUntil||this.time>e.breachUntil);
        else if(d.variant==='diver')e.submerged=this.isSubmerged(e);
        const blocker=this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane===e.lane&&e.x-u.x>=-.12&&e.x-u.x<.7).sort((a,b)=>b.x-a.x)[0];
        const slow=e.status.slow>this.time?(d.boss?.85:.65):1;
        const order=this.troopOrder(e),shifting=e.troopShift&&this.time<e.troopShift.started+e.troopShift.duration;
        if(blocker&&!d.boss&&!d.air&&!shifting){if(e.attack<=0&&!e.windup&&!e.recovery){const damage=e.damage*(order?.attack||1)*(order?.woundedAttack&&blocker.hp<blocker.maxHp*.5?order.woundedAttack:1);if(d.variant==='diver'&&this.platformAt(blocker.lane,blocker.col))this.damagePlatform(this.platformAt(blocker.lane,blocker.col),damage);else this.damageUnit(blocker,damage);e.attack=order?.attackInterval||d.attackInterval||1;e.anim=.4;}}
        else if(!d.boss&&!e.windup&&!e.recovery&&!shifting)e.x-=e.speed*slow*dt*(order?(d.air&&order.airSpeed||this.isWater(e.lane,Math.floor(e.x))&&order.waterSpeed||order.speed||1):1)*(d.air&&e.summonerId&&this.birdWindAt(e.lane,Math.floor(e.x),e.summonerId)?1.35:1);
        if(d.boss){e.minionClock-=dt;if(e.commandAt&&this.time>=e.commandAt&&!e.windup&&!e.normalCast){e.commandAt=0;this.summonBossTroops(e,true);}else if(e.minionClock<=0&&!e.windup&&!e.normalCast&&!e.commandAt)this.summonBossTroops(e);}
        if(d.variant==='healer'){e.healClock-=dt;if(e.healClock<=0){for(const target of this.enemies)if(target.hp>0&&Math.abs(target.lane-e.lane)<=1&&Math.abs(target.x-e.x)<1.7&&target.hp<target.maxHp){const heal=Math.min(target.maxHp-target.hp,target.status.burn>this.time?5:28);target.hp+=heal;target.healedUntil=this.time+.5;this.effects.push({kind:'heal',lane:target.lane,x:target.x,text:'+'+Math.round(heal),color:'#77a78f',ttl:.6,total:.6});}e.healClock=4;e.anim=.7;}}
        if(d.variant==='binder'&&blocker){e.healClock-=dt;if(e.healClock<=0){this.hazards.push({id:this.nextId++,bossId:null,kind:e.kind==='veilDoll'?'web':'chains',cells:[{lane:blocker.lane,col:blocker.col}],until:this.time+3});e.healClock=7;}}
        if(d.boss)this.updateBossNormal(e,dt);
        if(e.kind==='boss'){e.shot-=dt;if(e.shot<=0&&!e.normalCast&&!e.recovery){e.shot=e.enraged?BOSS_CADENCE.enragedSkill:BOSS_CADENCE.skill;e.anim=.7;e.commandAt=this.time+BOSS_CADENCE.commandDelay;for(const lane of [e.lane-1,e.lane,e.lane+1].filter(l=>l>=0&&l<5))this.projectiles.push({kind:'can',lane,x:e.x-.3,ttl:5,damage:e.enraged?47:34});this.emit('can');this.emit('bossSkill',{kind:e.kind});}}
        else if(e.kind==='parcelKing'){e.shot-=dt;if(e.shot<=0&&!e.normalCast&&!e.recovery){e.shot=BOSS_CADENCE.skill;e.anim=1;e.commandAt=this.time+BOSS_CADENCE.commandDelay;for(const lane of [e.lane,(e.lane+1)%5,(e.lane+4)%5,(e.lane+2)%5])if(this.enemies.filter(v=>v.hp>0&&!ENEMIES[v.kind].boss).length<BOSS_CADENCE.minionLimit){const child=this.spawn('box',lane);child.x=Math.max(1.1,e.x-.25);}this.emit('bossSkill',{kind:e.kind});}}
        else if(d.boss){if(e.windup>0){const castDt=dt*slow;e.windup=Math.max(0,e.windup-castDt);e.anim=.7;for(const w of this.floodWarnings.filter(w=>w.bossId===e.id)){w.at=this.time+e.windup;w.until=w.at+api.WHALE_WATER_SECONDS;}if(!e.windup)this.releaseBoss(e);}else if(!e.recovery&&!e.normalCast){e.shot-=dt*slow;if(e.shot<=0)this.chargeBoss(e);}}
        const guard=this.guards[e.lane];if(e.x<.05&&guard.state==='ready'){guard.state='running';guard.x=-.5;this.emit('guard',{lane:e.lane});}
        if(!d.boss&&e.x<-.75){e.hp=0;e.escaped=true;this.hearts=Math.max(0,this.hearts-1);this.emit('breach');if(this.hearts<=0&&this.phase==='running'){this.phase='lost';this.emit('end',{won:false});}}
      }
    }
    tick(dt){
      if(this.phase!=='running')return;dt=Math.min(Math.max(dt,0),.1);this.time+=dt;
      for(const k of [...ORDER,'jelly'])this.cooldowns[k]=Math.max(0,(this.cooldowns[k]||0)-dt);
      this.skyTimer-=dt;if(this.skyTimer<=0){this.dropCoin(Math.floor(this.random()*5),1+this.random()*(BOARD_COLS-3),25);this.skyTimer=8;}
      if(this.spawns.length){this.spawnTimer-=dt;if(this.spawnTimer<=0){const s=this.spawns.shift();this.spawn(s.kind,s.lane,s);this.spawnTimer=this.arrivalInterval();}}
      for(const h of this.hazards)if(h.kind==='beat'&&h.beatIn!==undefined){
        if(h.cells.every(cell=>this.isLaneFrozen(cell.lane))){h.until+=dt;continue;}
        h.beatFlash=Math.max(0,h.beatFlash-dt);h.beatIn-=dt;
        if(h.beatIn<=1e-8&&h.until>this.time){
          h.beatIn+=h.beatPeriod;h.beatFlash=.22;
          for(const u of this.units)if(u.hp>0&&!this.isLaneFrozen(u.lane)&&h.cells.some(c=>sameCell(u,c.lane,c.col)))this.damageBossSkill(u,h.beatDamage);
          this.emit('rhythmBeat',{bossId:h.bossId});
        }
      }
      this.hazards=this.hazards.filter(h=>h.until>this.time);
      for(const h of this.hazards)for(const c of h.cells){
        if(h.kind==='fire'&&this.isWater(c.lane,c.col))continue;
        const rate=h.kind==='beat'&&h.beatIn!==undefined?0:HAZARD_DAMAGE[h.kind]||0;
        for(const u of this.unitsAt(c.lane,c.col))this.damageUnit(u,rate*dt);
        if(h.kind==='fire')this.damagePlatform(this.platformAt(c.lane,c.col),3*dt);
      }
      this.drainWater(false);for(const p of this.platforms){p.born=Math.max(0,p.born-dt);p.hurt=Math.max(0,p.hurt-dt);}
      this.updateReactions(dt);this.attackUnits(dt);this.updateProjectiles(dt);this.updateEnemies(dt);
      for(const g of this.guards){g.swimming=this.isWater(g.lane,Math.max(0,Math.min(BOARD_COLS-1,Math.floor(g.x))));if(g.state==='running'){g.x+=6.8*dt;for(const e of this.enemies)if(e.hp>0&&!e.controlCat&&e.lane===g.lane&&Math.abs(e.x-g.x)<.7){if(ENEMIES[e.kind].boss){if(e.lastGuard!==g){e.lastGuard=g;this.damageEnemy(e,2400,{bypass:true});}}else this.kill(e);}if(g.x>BOARD_COLS+1)g.state='spent';}}
      for(const c of this.coins){c.ttl-=dt;if(c.ttl<=0&&!c.collected)this.collect(c.id);}
      for(const f of this.effects)f.ttl-=dt;
      this.units=this.units.filter(u=>u.hp>0);this.platforms=this.platforms.filter(p=>p.hp>0);this.enemies=this.enemies.filter(e=>e.hp>0);this.projectiles=this.projectiles.filter(p=>p.ttl>0&&p.x<BOARD_COLS+1&&p.x>-1);this.pools=this.pools.filter(p=>p.ttl>0);this.coins=this.coins.filter(c=>!c.collected);this.effects=this.effects.filter(f=>f.ttl>0);
      if(this.phase==='running'&&!this.spawns.length&&!this.enemies.length){this.waveWait+=dt;if(this.labBoss&&this.wave>=1){this.phase='won';this.emit('end',{won:true});}else if(this.wave>=this.maxWaves&&!this.sandbox){this.phase='won';this.emit('end',{won:true});}else if(this.waveWait>8){if(this.sandbox&&this.wave>=this.maxWaves)this.maxWaves++;this.beginWave();}}
    }
  }
  Object.assign(api,{Game,ATTRIBUTES,REACTIONS,REACTION_SECONDS,CAT_CONTROL_SECONDS,TRAP_SECONDS,BOSS_ENTRY_SECONDS,BOSS_X,BOSS_HEALTH,ENDLESS_BOSS_HEALTH,BOSS_THREAT,BOSS_CADENCE,BOSS_SKILL_CHAINS,BOSS_TROOP_ORDERS,BOSS_SKILL_HP_FLOOR,WHALE_WATER_SECONDS,SUBMERGED_DAMAGE_MULTIPLIER,ENEMY_RANKS,HAZARD_DAMAGE,BOSS_ORDER,ENDLESS_CYCLE_WAVES,ENDLESS_DUO_ENCOUNTERS,DEFAULT_DECK,BOSS_MOTION,bossData,ENDLESS_THEMES,rewardsFor,normalizeProgress,migrateProgress,unlockedRoster,completeCampaign});root.EibonTD=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
