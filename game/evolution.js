/* Version 3: formation upgrades, boss environments and persistent shop. */
(function(root){
  'use strict';
  const api=root.EibonTD||(typeof require==='function'?require('./expansion.js'):null);
  const {Game:PreviousGame,UNITS,ORDER,ENEMIES,CAMPAIGN,BOARD_ROWS:R,BOARD_COLS:C}=api;
  const RANK_DAMAGE=[0,1,1.5,2.15],RANGED_DAMAGE=[0,1,1.35,1.8],RANK_HEALTH=[0,1,1.35,1.7];
  const NEW_UNITS={
    blackFeather:{name:'黑羽',role:'远程 · 优先清除幻象',cost:200,hp:250,cooldown:8,interval:1.8,damage:48,attribute:'soul',color:'#8184be',description:'可以攻击普通敌人和飞行敌人，优先打蝶影等幻象。一叠只攻击本路；二叠还能攻击上下相邻路，并给命中的敌人留下5秒标记。三叠时，敌人在标记消失前被击败，会伤害其附近三路、一格内的其他敌人。'},
    lingko:{name:'灵可',role:'连携 · 分身追击',cost:175,hp:270,cooldown:8,interval:2.1,damage:24,attribute:'spirit',color:'#c294a7',description:'选择同路前方两格内最近的一名攻击队友。该队友每攻击3次，灵可召唤一个分身，追加攻击一次。二叠还能选择上下相邻路同列或前方两格内的队友，分身一次削甲75点；三叠削甲110点，并再命中一个敌人。分身擅长协助前排破甲。'},
    hania:{name:'哈尼娅',role:'充能 · 构造与换位提速',cost:150,hp:260,cooldown:9,interval:6,attribute:'soul',color:'#d7bb67',description:'每6秒为附近队友缩短技能等待时间，目前能加速安魂曲三叠的构造物和哈索尔的换位。一叠作用于本路前后两格，每次缩短1.2秒；二叠扩至上下相邻路，每次缩短2.4秒；三叠每次缩短3.6秒。普通攻击，以及按攻击次数触发的连携、连斩，都不会加快。'},
    edgar:{name:'埃德嘉',role:'净化 · 异常免疫',cost:150,hp:290,cooldown:9,interval:5,attribute:'light',color:'#87b2a0',description:'清除邻近队友沉睡、惑音、封技与禁疗，一叠净化一人并免疫3秒；二叠同时净化三人并免疫4秒；三叠净化六人并免疫6秒。治疗和护盾无法解除这些异常。'},
    jiuyuan:{name:'九原',role:'侦测 · 蝶影识破',cost:175,hp:250,cooldown:8,interval:2.4,damage:32,attribute:'spirit',color:'#9874bb',description:'识破本路蝶影与遮蔽，使队友可以命中真身。二叠侦测相邻路，三叠识破后暴露弱点六秒。'},
    baicang:{name:'白藏',role:'打断 · 精英制止',cost:200,hp:380,cooldown:9,interval:2.4,range:2,damage:60,attribute:'curse',color:'#c5bca6',description:'近处斩击直接取消敌人正在准备的技能、连斩和回血，并延后8秒再使用。时停和普通眩晕只暂停施法，结束后会继续。二叠可积蓄首领破绽，三叠每四次斩击延后首领技能一次。'},
    hathor:{name:'哈索尔',role:'换位 · 战场搬运',cost:150,hp:410,cooldown:8,interval:2.2,range:1.7,damage:48,attribute:'phase',color:'#b1a69b',description:'队友被危险格或追债锁定时，自动搬到后方一至两格的空位，解除追债。开场即可搬运，冷却7/6/4秒。二叠覆盖相邻路，三叠搬运附加护盾。后方须留空位。'},
    fadeya:{name:'法帝娅',role:'锚定 · 侵蚀减免',cost:175,hp:420,cooldown:10,interval:5,attribute:'soul',color:'#9772ac',description:'锚定本路前后两格，减少80%的侵蚀、灼地和持续灼烧伤害。这些环境伤害有75%会穿过普通护盾。二叠扩大范围，三叠锚定区阻止禁疗再次附着。'},
    chaos:{name:'卡厄斯',role:'破盾 · 能量消解',cost:200,hp:340,cooldown:8,interval:2.2,damage:38,attribute:'phase',color:'#897ec3',description:'优先攻击有能量盾的敌人，一次清空能量盾并追加90点重击。其他攻击只对能量盾造成25%的伤害。二叠可消除部属护符，三叠破盾波及相邻目标。'},
    zero:{name:'零',role:'群攻 · 四连斩',cost:225,hp:600,cooldown:10,interval:3.4,range:3,damage:38,attribute:'light',color:'#bca2cd',description:'每轮四次挥斩，每次最多命中四名敌人。受到普通伤害减少20%，首领普攻和技能伤害减少35%；施加的异常持续时间减半。二叠扩至相邻路，三叠末斩追加冲击；商店永久招募。'}
  };
  for(const [kind,d] of Object.entries(NEW_UNITS)){UNITS[kind]={...d,sheet:'heroes-b',row:0};ORDER.push(kind);}
  ORDER.splice(0,ORDER.length,...ORDER.filter(k=>k!=='mintCat'&&k!=='jelly'));
  Object.assign(UNITS.xun,{oneShot:false,hp:240,cooldown:10,interval:2.2,damage:12,range:1.15,role:'近战 · 上场时停',description:'上场立即暂停本路2秒，每2.2秒近战造成12点基础伤害。同格可升至三叠，时停延至3/5秒。同路多位浔共享24秒技能间隔，由就绪的最高叠数浔施放；升级、叠放和撤回重放不会重置间隔或累加控制。'});
  Object.assign(UNITS.crimson,{oneShot:false,hp:570,cooldown:9,interval:1.6,damage:62,range:1.5,role:'增幅 · 旋风转焰',description:'放在薄荷前方，接住本路旋风：旋风消失，转为向前喷出的三格穿透火焰。一叠增幅火焰伤害，二叠进一步加强；前两叠不近战、不积蓄红温。三叠解锁白发龙爪近战与受击红温，红温强化火焰；环境伤害不积蓄怒气。'});
  Object.assign(UNITS.haiyue,{role:'范围 · 水底增伤'});
  UNITS.nanally.description='优先瞄准本路飞行敌人，对空造成2倍伤害；其他能对空的角色只造成55%伤害。持续攻击同一目标会形成连射，二叠更快双发，三叠三发。';
  UNITS.skia.description='部署暗刺陷阱，攻击脚边经过的敌人。对从后方进入的背袭梦猎造成4倍伤害，并绊住1.1秒；其他角色对背袭敌人只造成65%伤害。二叠附加减速，三叠减速更久。';
  UNITS.sakiri.description='近身吞掉普通敌人，消化12/9/7秒。精英需要先打到40%血量以下；敌人有能量盾或护符时不能吞。三叠可吞掉已破甲的重壳。其他情况改为咬击。';
  Object.assign(UNITS.iroi,{role:'治疗 · 羊群续航',description:'定时治疗周围三路前后两格内的受伤队友；周围满血时保持待机。二叠治疗量增加，三叠持续回复重伤队友；禁疗期间无法治疗。'});
  Object.assign(UNITS.chiz,{rank3HealthBonus:.5,description:'盖章产出方斯。二叠每次产出35方斯，三叠产出45方斯并加快盖章，最大生命在普通三叠基础上额外增加50%。'});
  UNITS.daffodil.description='优先攻击近处有护甲的敌人，每刀削甲60/90/120点。重甲未破时，其他角色伤害降至40%，削甲速度也更慢；达芙蒂尔可以快速拆甲。三叠每攻击三次追加残虹连携斩。';
  UNITS.requiem.description='抛射与地面持续伤害。二叠果冻范围扩大，三叠切换紫色哥特形态，并周期生成独立地面构造物。';
  // Remote damage grows more slowly than close combat; counters keep their roles.
  const RANGED_BALANCE={
    mint:{damage:22,interval:2.7,range:8.4},nanally:{damage:20,interval:1.85,range:9},
    requiem:{damage:24,interval:3,range:8.4},haiyue:{damage:30,interval:2.1,range:4},
    blackFeather:{damage:34,interval:2.2,range:7.5},jiuyuan:{damage:24,interval:2.8,range:7.5},
    lingko:{damage:20,interval:2.4,range:5},chaos:{damage:28,interval:2.4,range:6}
  };
  for(const [kind,balance]of Object.entries(RANGED_BALANCE))Object.assign(UNITS[kind],balance,{damageClass:'ranged'});
  const DEFENSE_BALANCE={
    sakiri:{hp:300,bossDamageTaken:.78},daffodil:{hp:360,bossDamageTaken:.78},
    crimson:{hp:540,bossDamageTaken:.82},adler:{hp:430,bossDamageTaken:1},
    xun:{hp:270,bossDamageTaken:.82},baicang:{bossDamageTaken:.8},
    hathor:{hp:380,bossDamageTaken:.8},zero:{bossDamageTaken:.65,statusDurationMultiplier:.5},
    requiem:{hp:220,bossDamageTaken:.92},nanally:{hp:240,bossDamageTaken:.92},
    haiyue:{hp:260,bossDamageTaken:.9},iroi:{hp:270,bossDamageTaken:.9}
  };
  for(const [kind,balance]of Object.entries(DEFENSE_BALANCE))Object.assign(UNITS[kind],balance);
  for(const kind of ORDER)UNITS[kind].cooldown=Math.min(UNITS[kind].cooldown,2);
  UNITS.haiyue.companion='jelly';
  UNITS.iroi.interval=3.2;UNITS.adler.interval=10;UNITS.adler.description='不主动攻击。撑起140/200/260点护盾，盾破后等待10秒恢复，一至三叠分别保护同路身后1/2/3格队友。队友受到的普通伤害最多由护盾分担70%；环境伤害大部分穿盾，不会定时刷满未破的护盾；持续围攻会打穿护盾。';
  UNITS.haiyue.description='乘坐水母出战，任意街道格可直接部署。一叠就有本路穿透与落点范围伤害，可波及相邻路；对正在潜水的敌人造成3倍伤害且无潜水减伤。二叠扩大落点范围，三叠进一步扩大并使水底目标减速。';
  UNITS.mint.description='低伤穿透旋风，射程8.4格，穿过更多敌人后伤害递减。旋风碰到前方真红后消失，转为增幅火焰；三叠旋风附带减速。与光属性同路形成创生，精英需要近战破甲、吞噬或持续伤害配合。';
  const UPGRADE_RULES={chiz:['盖章产钱','每次产出35方斯','产出45方斯 · 更快盖章 · 额外生命+50%'],mint:['同路旋风 · 碰到真红转为火焰','旋风范围扩大','旋风降低敌人移速'],requiem:['抛射果冻','扩大落点持续区域','哥特形态与地面构造物'],sakiri:['吞噬普通敌人 · 精英低于40%血量可吞','消化缩至9秒','消化缩至7秒并可吞破甲重壳'],daffodil:['每刀削甲60','每刀削甲90','每三次攻击残虹连携'],nanally:['优先对空 · 空中2倍伤害','更快形成双发','对空三发连射'],adler:['140护盾 · 保护身后一格','200护盾 · 保护身后两格','260护盾 · 保护身后三格'],xun:['上场立即本路时停2秒 · 低伤近战','本路时停3秒 · 同路共享技能','本路时停5秒 · 同路共享技能'],crimson:['薄荷旋风消失并转为增幅火焰','加强转化火焰','解锁受击红温与龙爪近战'],skia:['暗刺伤害 · 对背袭敌人4倍并绊住','双向绊住经过敌人','后方来敌优先并延缓突袭'],haiyue:['本路穿透与落点范围 · 潜水3倍','扩大落点范围','更大范围 · 水底目标减速'],iroi:['定时治疗','加强羊群治疗','治疗后回复重伤队友']};
  for(const [k,d] of Object.entries(NEW_UNITS))UPGRADE_RULES[k]=d.description.split('。').filter(Boolean).slice(0,3);
  UPGRADE_RULES.blackFeather=['优先攻击幻象 · 可对空 · 本路攻击','还能攻击相邻路 · 标记目标5秒','标记目标被击败时，伤害附近敌人'];
  UPGRADE_RULES.lingko=['最近一名队友每攻击3次，召唤分身追击','还能选择相邻路队友 · 分身削甲75','分身削甲110 · 可再命中一个敌人'];
  UPGRADE_RULES.hania=['构造物与换位等待缩短1.2秒','覆盖相邻路 · 每次缩短2.4秒','每次缩短3.6秒'];
  UNITS.fadeya.description='保护型角色，不主动攻击。一叠锚定本路前后各两格（含自身，共5格），环境伤害减少80%；二叠扩至上下相邻路，共15格，边缘格会缩小。三叠范围不变，并阻止保护范围内队友被施加禁疗。普通攻击和首领直接技能不在环境减伤范围内。部署时预览范围，点击场上法帝娅可突出显示。';
  UPGRADE_RULES.fadeya=['不攻击 · 本路5格 · 环境减伤80%','覆盖相邻两路 · 最多15格','范围不变 · 额外阻止禁疗'];
  UPGRADE_RULES.edgar=['本路净化1人 · 异常免疫3秒','邻路净化3人 · 免疫4秒','净化6人 · 免疫6秒'];
  UPGRADE_RULES.baicang=['取消施法与连斩 · 延后8秒再用','命中首领积蓄破绽','每四次斩击再延后首领技能'];
  UPGRADE_RULES.hathor=['开场可换位 · 冷却7秒','覆盖相邻路 · 冷却6秒','换位附盾 · 冷却4秒'];
  UPGRADE_RULES.chaos=['清除能量盾 · 追加重击','还能清除部属护符','破盾波及两个邻近目标'];
  for(const k of ORDER){UNITS[k].upgrades=UPGRADE_RULES[k]||['基础出勤','强化能力','解锁专属联动'];UNITS[k].maxRank=3;}
  const ENVIRONMENTS={
    rider:{name:'余烬街道',color:'#e7784f',rule:'薄火持续灼地；技能命中叠灼烧，最多三层',counter:['iroi','fadeya','edgar']},
    whale:{name:'潮汐入侵',color:'#59b9d4',rule:'海水持续10秒；撤回避开落点，退水后再布置。海月擅长攻击水底',counter:['haiyue','iroi']},
    morpheus:{name:'异象侵蚀',color:'#9984d4',rule:'持续侵蚀角色生命，梦猎从后方突袭',counter:['fadeya','iroi','skia']},
    blackBook:{name:'锁页封印',color:'#a678cb',rule:'锁链格封禁特殊技能，普通攻击仍然继续',counter:['edgar','baicang']},
    bird:{name:'逆风回廊',color:'#9b729c',rule:'局部逆风减慢射击，飞兵沿风区加速',counter:['mint','nanally']},
    butterfly:{name:'镜粉幻街',color:'#8eb9d5',rule:'蝶粉隐藏真身，镜影分散火力',counter:['jiuyuan','blackFeather']},
    serenetti:{name:'眠歌舞台',color:'#c577a3',rule:'催眠与惑音交替，部分地块造成禁疗',counter:['edgar','adler']},
    musicKing:{name:'重拍霓虹',color:'#c193dd',rule:'危险格逐拍倒计时，拍间可安全布阵',counter:['xun','hathor']},
    arachne:{name:'赤幕蛛网',color:'#cf8b9d',rule:'蛛网限制叠卡，烧毁蛛网可以继续升级',counter:['crimson','sakiri']},
    mammon:{name:'金债集市',color:'#cfb566',rule:'抽走局内方斯，击破钱袋或打出破绽返还；卡厄斯破盾，达芙蒂尔或二叠灵可削甲',counter:['chiz','chaos','daffodil','lingko']},
    debtCollector:{name:'追债契域',color:'#a682c5',rule:'契纸标记倒计时，可撤回、换位或击破解除',counter:['hathor','sakiri']},
    boss:{name:'罐头散落',color:'#a4a58b',rule:'齐射后碎罐减慢经过敌人，仍可攻击',counter:['mint','adler']},
    parcelKing:{name:'加急传送带',color:'#bb9c81',rule:'配送带加速部属，阻停打断运输',counter:['skia','xun']},
    foreman:{name:'震裂铺面',color:'#a3a29e',rule:'震裂格短暂禁疗，重甲精英前压',counter:['daffodil','edgar']}
  };
  const BOSS_COUNTER_GUIDANCE={
    rider:[{label:'灼地续航',choices:[['iroi'],['fadeya']]},{label:'灼烧净化',choices:[['edgar']]}],
    whale:[{label:'水底输出',choices:[['haiyue']]},{label:'推浪续航',choices:[['iroi']]}],
    morpheus:[{label:'侵蚀续航',choices:[['fadeya'],['iroi']]},{label:'后门防线',choices:[['skia']]}],
    blackBook:[{label:'封技净化',choices:[['edgar']]},{label:'精英打断',choices:[['baicang']]}],
    bird:[{label:'空中火力',choices:[['nanally']]}],
    butterfly:[{label:'蝶影识破',choices:[['jiuyuan'],['blackFeather']]}],
    serenetti:[{label:'异常净化',choices:[['edgar']]},{label:'护盾承伤',choices:[['adler']]}],
    musicKing:[{label:'节拍避险',choices:[['xun'],['hathor']]}],
    arachne:[{label:'旋风烧网',choices:[['mint','crimson']],note:'真红放在薄荷前方接旋风。'},{label:'精英重咬',choices:[['sakiri']]}],
    mammon:[{label:'能量破盾',choices:[['chaos']]},{label:'重甲削除',choices:[['daffodil'],['lingko']],note:'灵可需要升至二叠，由连携分身削甲。'},{label:'税收周转',choices:[['chiz']]}],
    debtCollector:[{label:'契约换位',choices:[['hathor']]},{label:'高速部属',choices:[['sakiri'],['xun']]}],
    boss:[{label:'部属群攻',choices:[['mint'],['requiem']]},{label:'齐射护盾',choices:[['adler']]}],
    parcelKing:[{label:'配送阻停',choices:[['skia'],['xun']]}],
    foreman:[{label:'重甲破甲',choices:[['daffodil'],['lingko']],note:'灵可需要升至二叠，由连携分身削甲。'},{label:'禁疗净化',choices:[['edgar']]}]
  };
  function bossCounterReadiness(kind,selected=[],available=ORDER){
    const unlocked=new Set(available),chosen=ORDER.filter(k=>unlocked.has(k)&&selected.includes(k));
    const groups=(BOSS_COUNTER_GUIDANCE[kind]||[]).map(rule=>{
      const choices=rule.attributes?[rule.attributes.map(attribute=>chosen.find(k=>UNITS[k].attribute===attribute)||rule.recommend.find(k=>UNITS[k].attribute===attribute))]:rule.choices;
      const ready=rule.attributes?rule.attributes.every(attribute=>chosen.some(k=>UNITS[k].attribute===attribute)):choices.some(choice=>choice.every(k=>chosen.includes(k)));
      return {label:rule.label,note:rule.note||'',ready,choices:choices.map(choice=>choice.map(k=>({kind:k,selected:chosen.includes(k),unlocked:unlocked.has(k)})))};
    });
    return {boss:kind,groups,ready:groups.filter(g=>g.ready).length,total:groups.length};
  }
  api.WHALE_WATER_SECONDS=10;
  Object.assign(api.BOSS_CADENCE,{firstSkill:4.5,firstWhaleSkill:6,firstNormal:2.5,normal:1.8,enragedNormal:1.4,normalWindup:.65,skill:8,enragedSkill:6,whaleSkill:9,enragedWhaleSkill:7,recovery:3,reinforcementSize:3,reinforcementInterval:18,commandSize:2,minionLimit:12});
  Object.assign(api.HAZARD_DAMAGE,{fire:2,thorns:4,dream:3,dust:0,beat:0});
  for(const [kind,d] of Object.entries(ENEMIES))if(d.boss){api.BOSS_HEALTH[kind]=d.hp=Math.round(d.hp*.7);api.ENDLESS_BOSS_HEALTH[kind]=Math.round((api.ENDLESS_BOSS_HEALTH[kind]||d.hp*2)*.75);if(api.BOSS_THREAT[kind]){api.BOSS_THREAT[kind].normal=Math.round(api.BOSS_THREAT[kind].normal);api.BOSS_THREAT[kind].burst=Math.round(api.BOSS_THREAT[kind].burst*1);}d.environment=kind;d.advice=ENVIRONMENTS[kind]?.rule||d.advice;}
  Object.assign(api.BOSS_THREAT.bird,{normal:110,burst:300});Object.assign(api.BOSS_THREAT.serenetti,{normal:90,burst:245});
  ENEMIES.whale.skill='海啸开场 → 潜伏跃击 · 深海蓄势保底两次';ENEMIES.whale.advice='开场先海啸再跃击；两次完成前不会被时停或硬直打断，生命至少保留12%。完成后可被打断，但硬直结束后有8秒抗压制窗口。主要跃向现有海域，偶尔袭击陆地；每第三次跃击一定选择陆地（若仍有干地），海啸扫过时直接造成冲击伤害，积水格额外增伤35%；海啸与落点海水均持续10秒。海月擅长攻击水底；没有海月也可在跃出水面时集火，按预警撤回或换位避开跃击。';
  api.BOSS_HEALTH.bird=ENEMIES.bird.hp=62000;api.ENDLESS_BOSS_HEALTH.bird=110000;api.ENDLESS_BOSS_HEALTH.serenetti=100000;
  for(const d of Object.values(ENEMIES))if(!d.boss&&!d.illusion&&d.rank!=='normal'){d.hp=Math.round(d.hp*(d.rank==='elite'?2.25:2));d.damage=Math.round(d.damage*1.2);d.elite=true;}
  Object.assign(ENEMIES.diver,{aquatic:true,swallowable:false});
  ENEMIES.dreamHound.swallowable=true;
  ENEMIES.rearHound={...ENEMIES.dreamHound,name:'背袭梦猎',rear:true,swallowable:true,rank:'elite'};
  ENEMIES.moneyBag={name:'追回钱袋',hp:150,armor:0,speed:0,damage:0,reward:0,sheet:'boss-minions-b',row:0,variant:'moneyBag',rank:'normal',weakness:[],swallowable:true,loot:true};
  for(const enemy of Object.values(ENEMIES)){
    if(enemy.boss||enemy.loot||enemy.illusion)continue;
    const elite=['elite','armored'].includes(enemy.rank);
    enemy.hp=Math.round(enemy.hp*(elite?1.3:1.2));
    enemy.damage=Math.round(enemy.damage*(elite?1.2:1.15));
    if(elite){enemy.speed*=1.08;enemy.attackInterval=.9;}
  }
  // Final encounter stats: these are introduced after the legacy stat scaling.
  const NEW_ENCOUNTERS={
    rainman:{name:'雨人',hp:380,armor:0,speed:.22,damage:23,reward:35,rank:'normal',swallowable:true,weakness:[],variant:'rainman',sheet:'v2/enemy-rainman-v01',row:0,renderHeight:95,skill:'首次接敌 · 撑伞瞬移',advice:'首次碰到常驻角色时预告0.6秒，越到该角色后方；每只只瞬移一次。保留第二道防线，或用吞噬、时停处理。'},
    auraGloves:{name:'欧拉拳套',hp:520,armor:15,speed:.18,damage:30,reward:45,rank:'normal',swallowable:true,weakness:[],variant:'auraGloves',sheet:'v2/enemy-aura-gloves-v01',row:0,renderHeight:76,attackInterval:2.2,skill:'蓄力重拳 · 邻近范围',advice:'接敌后蓄力0.7秒，攻击落点附近三路同列的角色，每2.2秒一拳。分散布阵，用时停或吞噬阻止蓄力。'},
    bopp:{name:'波普',hp:1350,armor:20,speed:.18,damage:33,reward:90,rank:'elite',elite:true,swallowable:true,weakness:['genesis'],variant:'bopp',sheet:'v2/enemy-bopp-v01',row:0,renderHeight:94,attackInterval:1.3,skill:'涂鸦投掷 · 部署干扰',advice:'每8秒预告一次涂鸦，覆盖同路三格，3.5秒内不能部署或升级；场上角色仍可攻击。等颜料消退，或用真红转化火焰清除。'},
    bandage:{name:'绷带怪',hp:1450,armor:35,speed:.2,damage:35,reward:90,rank:'elite',elite:true,swallowable:true,weakness:['burn'],variant:'bandage',sheet:'v2/enemy-bandage-v01',row:0,renderHeight:92,attackInterval:1.35,skill:'半血松绑 · 短时追击',advice:'半血后预告0.8秒，随后加速追击2.5秒，间隔10秒。集中输出，时停、减速或早雾吞噬可压制追击。'},
    paperSquadron:{name:'纸翼战队',hp:260,armor:0,speed:.3,damage:16,reward:30,rank:'normal',air:true,swallowable:false,weakness:['delay'],variant:'paperSquadron',sheet:'v2/enemy-paperSquadron-v01',row:0,renderHeight:64,skill:'编队俯冲 · 飞行突进',advice:'飞越地面角色，每6秒预告0.7秒，然后以1.7倍速度俯冲2秒。用薄荷、娜娜莉、海月等能对空的角色，或用本路时停。'},
    everlight:{name:'长明灯',hp:460,armor:10,speed:.15,damage:21,reward:40,rank:'normal',swallowable:true,weakness:['discord'],variant:'everlight',sheet:'v2/enemy-everlight-v01',row:0,renderHeight:94,skill:'灯火护持 · 邻近护盾',advice:'每9秒预告1秒，为附近三路两格内的普通、精英敌人补至80点能量盾。护盾不叠加；优先击破长明灯，或用卡厄斯消盾。'},
    cursedBlade:{name:'妖刀',hp:1480,armor:25,speed:.19,damage:48,reward:95,rank:'elite',elite:true,swallowable:true,weakness:['discord'],variant:'cursedBlade',sheet:'v2/enemy-cursedBlade-v01',row:0,renderHeight:76,attackInterval:3,skill:'隔格斩击 · 前方两格',advice:'可隔一格斩击本路前方最近角色，预告0.8秒，每3秒最多一次。预警锁定落点；撤回或换位能躲开，白藏可以打断。'},
    recordSpirit:{name:'唱片电灵',hp:410,armor:5,speed:.17,damage:19,reward:40,rank:'normal',swallowable:true,weakness:['burn'],variant:'recordSpirit',sheet:'v2/enemy-recordSpirit-v01',row:0,renderHeight:76,skill:'杂音封技 · 特殊技能干扰',advice:'每9秒向本路三格内角色发出1秒预警；落点附近角色被封技2秒，普通攻击继续。分散布阵，或用埃德嘉、消解装置净化。'},
    heroBear:{name:'忧郁英雄熊',hp:1750,armor:65,speed:.13,damage:32,reward:100,rank:'elite',elite:true,swallowable:true,weakness:['discord'],variant:'heroBear',sheet:'v2/enemy-heroBear-v01',row:0,renderHeight:91,attackInterval:1.6,skill:'半血破甲 · 愤怒重掌',advice:'半血时预告0.9秒，仅一次：护甲降至0，攻击增至原来的1.35倍。此后接敌蓄力0.7秒拍击附近三路。先破甲，暴怒后用时停或吞噬处理。'},
    weatherGirl:{name:'晴天娃娃',hp:340,armor:0,speed:.2,damage:18,reward:35,rank:'normal',swallowable:true,weakness:['burn'],variant:'weatherGirl',sheet:'v2/enemy-weatherGirl-v01',row:0,renderHeight:72,skill:'雪团催眠 · 短暂沉睡',advice:'每8秒向本路两格半内最近角色投雪团，预告0.9秒；命中造成12点伤害并沉睡1.5秒。埃德嘉与消解装置可净化，抗性可阻止再次沉睡。'},
    cardboardCastle:{name:'纸板城堡',hp:650,armor:35,speed:.13,damage:24,reward:45,rank:'normal',swallowable:true,weakness:['discord'],variant:'cardboardCastle',sheet:'v2/enemy-cardboardCastle-v01',row:0,renderHeight:84,skill:'合拢城门 · 自身护盾',advice:'每12秒预告1秒，补至180点自身能量盾，护盾不会叠加。用卡厄斯消盾、达芙蒂尔削甲，或在关门前吞噬。'},
    trailerOctopus:{name:'章鱼拖车',hp:1680,armor:40,speed:.15,damage:32,reward:100,rank:'elite',elite:true,swallowable:true,weakness:['delay'],variant:'trailerOctopus',sheet:'v2/enemy-trailerOctopus-v01',row:0,renderHeight:90,attackInterval:1.7,skill:'触腕牵引 · 拉近前排',advice:'每10秒锁定本路两格半内最近角色，预告1.2秒；把角色向右拉一格并造成18点伤害。目标格有角色时只伤害、不挤位；撤回、时停与白藏打断可应对。'},
    decomposer:{name:'分解者',hp:590,armor:20,speed:.18,damage:23,reward:45,rank:'normal',swallowable:true,weakness:['burn'],variant:'decomposer',sheet:'v2/enemy-decomposer-v01',row:0,renderHeight:80,skill:'受击攒能 · 碎屑反击',advice:'累计实际损失120点生命后，若本路两格内有角色，预告0.8秒并向锁定落点迸射碎屑，造成24点范围伤害。远程击破，或在预警时撤回、换位与打断。'},
    cascadeKoi:{name:'瀑鲤',hp:450,armor:0,speed:.24,damage:21,reward:40,rank:'normal',aquatic:true,swallowable:true,weakness:['delay'],variant:'cascadeKoi',sheet:'v2/enemy-cascadeKoi-v01',row:0,renderHeight:68,skill:'潮圈涌动 · 临时水面',advice:'每10秒预告1秒，把本路前方两格变成4秒水面；瀑鲤在水面中循环潜泳。海月一叠就能范围攻击，水底伤害更高；水面消退后恢复陆地。'}
  };
  Object.assign(ENEMIES,NEW_ENCOUNTERS);
  const ELITE_MECHANICS={
    bopp:{skill:'涂鸦封格 · 沾色回盾',advice:'预告0.9秒后涂鸦覆盖同路三格，3.5秒不能部署或升级。波普站在自己留下的颜料上时每秒回复40点能量盾，上限120；真红转化火焰可清除颜料，卡厄斯可消盾。'},
    bandage:{skill:'松绑追击 · 缠回回血',advice:'半血后预告0.8秒并加速追击。生命低于65%时，还会预告1.1秒后停步缠回，2.4秒共回复96生命，间隔14秒。浊燃阻止回血，白藏可打断缠回，时停会暂停整段动作。'},
    cursedBlade:{skill:'隔格斩击 · 第三轮回刃',advice:'前方两格内每3秒预告一次48伤斩击；每第三轮追加34伤回刃，第二刀另有0.7秒预警，两刀锁定原落点。撤回或换位可躲开；白藏打断后会同时取消后续回刃。'},
    heroBear:{skill:'半血破甲 · 蓄力震退',advice:'半血暴怒后护甲降至0、重掌变为范围攻击。每12秒还会预告1.2秒震退前方三路两格半内角色：造成26伤害，向左推一格，后格有人时不挤位。给前排留退路，或用白藏、时停和吞噬处理。'},
    trailerOctopus:{skill:'触腕牵引 · 缠绕封技',advice:'每10秒向本路两格半内目标预告1.2秒，将其向右拉一格并造成18伤害，随后封技2.5秒；普通攻击仍可继续。目标格有人时只伤害与封技。撤回可躲，白藏可打断，埃德嘉或消解装置可净化。'},
    dreamHound:{skill:'梦痕扑咬 · 追击伤员',advice:'每11秒寻找本路两格半内生命不足70%的角色，预告1秒后扑向锁定落点，造成46伤害并禁疗2秒。先治疗伤员、撤回或换位可避开；白藏能打断，埃德嘉可净化禁疗。'},
    chainAcolyte:{variant:'eliteBinder',skill:'锁页封印 · 双格拘束',advice:'每10秒向本路两格半内目标预告1.1秒，锁住目标格与其后一格4秒，格内特殊技能被封禁，普通攻击继续。移开危险格，或让埃德嘉、消解装置提供抗性；白藏可打断预警。'},
    veilDoll:{variant:'eliteBinder',skill:'赤幕织网 · 双格结界',advice:'每11秒向本路两格半内目标预告1秒，织网覆盖目标格与其前一格5秒；已部署角色继续攻击，但这些格不能叠卡升级。预警时换位，或用真红转化火焰烧网，白藏可打断。'}
  };
  for(const [kind,d] of Object.entries(ENEMIES)){
    if(d.air&&!d.illusion)d.advice=(d.advice||'')+' 娜娜莉对空2倍伤害，其他对空角色只有55%。';
    if(d.aquatic)d.advice=(d.advice||'')+' 潜水时普通伤害只有20%，海月可造成3倍伤害。';
    if(d.rank==='armored'||!d.boss&&d.armor>=60||['foreman','mammon'].includes(kind))d.advice=(d.advice||'')+' 重甲未破时通用攻击只有40%伤害，达芙蒂尔或二叠灵可分身可以快速削甲。';
    if(d.illusion||['butterfly','prismMoth'].includes(kind))d.advice=(d.advice||'')+' 幻象只承受通用攻击20%的伤害，分身存在时真身减伤75%；黑羽清幻象，九原直接识破。';
    if(d.rear)d.advice=(d.advice||'')+' 翳暗刺伤害4倍并绊住，其他攻击只有65%伤害。';
    if(['everlight','cardboardCastle','shield','coinImp','bopp'].includes(kind))d.advice=(d.advice||'')+' 能量盾只承受通用伤害25%，卡厄斯一次清盾。';
  }
  const ELITE_COUNTERS={bopp:['mint','crimson','chaos','xun','sakiri'],bandage:['mint','crimson','baicang','xun','sakiri'],cursedBlade:['baicang','xun','adler','iroi'],heroBear:['baicang','xun','sakiri','adler','iroi'],trailerOctopus:['baicang','edgar','xun','adler','iroi'],dreamHound:['iroi','edgar','sakiri','xun','adler'],chainAcolyte:['edgar','baicang','xun','sakiri'],veilDoll:['mint','crimson','baicang','xun','sakiri']};
  for(const [kind,counters]of Object.entries(ELITE_COUNTERS))ELITE_MECHANICS[kind].counters=counters;
  for(const [kind,rules]of Object.entries(ELITE_MECHANICS))Object.assign(ENEMIES[kind],rules);
  CAMPAIGN[8].rewards=['skia'];CAMPAIGN[8].intro='翳的地刺可与角色共格。猫猫改为商店限量道具，每局最多使用两次。';
  CAMPAIGN[9].intro='海月直接攻击潜水异象；伊洛伊定时治疗，不需要水母工具。';
  CAMPAIGN[10].intro='海囚带来海面。潜水异象会下潜，陆地敌人保持地面移动；海啸命中角色会造成冲击伤害，已淹没街道上的角色会受到额外推浪伤害。';
  const stageAdd=[
    ['逆风的投递','bird',['blackFeather','lingko']],['棱镜里的真身','butterfly',['jiuyuan','edgar']],['重拍之间','musicKing',['hania','hathor']],['灰烬守夜','rider',['fadeya']],['金库不打烊','mammon',['chaos']],['裂地总管','foreman',['baicang']],['梦猎的回程','morpheus',[]]
  ];
  for(const [name,boss,rewards] of stageAdd)CAMPAIGN.push({name,boss,rewards,reward:rewards[0]||null,money:650,hp:1.08,count:4,waves:4,pool:ENEMIES[boss].troops,intro:ENVIRONMENTS[boss].rule});
  const oldRewards=api.rewardsFor,oldNormalize=api.normalizeProgress,oldMigrate=api.migrateProgress;
  const legacyRecruitment=CAMPAIGN.map(stage=>[...oldRewards(stage)]);
  const RECRUITMENT_SEQUENCE=ORDER.filter(kind=>!['chiz','mint','zero'].includes(kind));
  // The roster and chapter rewards share one order. Existing saves retain every
  // previously earned colleague through the explicit recruited list below.
  const practiceIntros=[
    '先安排小吱与薄荷，守住两路。通关后招募安魂曲，学习抛射与地面持续伤害。',
    '安排安魂曲处理成群快递。通关后招募早雾，学习吞噬与消化间隔。',
    '让早雾吞噬普通异象，消化期间保护前排。通关后招募阿德勒。',
    '把阿德勒放在输出前方，练习盾护后排；本关没有首领。通关招募娜娜莉。',
    '娜娜莉远程清理快递，留钱应对铁桶。通关后招募达芙蒂尔，学习连续破甲。',
    '处理鬼火信使，练习及时撤回受伤前排；本关没有首领。通关后招募浔。',
    '浔上场立即暂停本路，同路共享一个时停技能。通关后招募真红，把薄荷的旋风转为增幅火焰。',
    '把真红安排在薄荷前方，练习旋风转焰；三叠真红解锁红温与近战，本关没有首领。',
    '通关后招募翳。地刺可以与普通角色共格，猫猫支援可从商店获得。',
    '通关后招募海月与伊洛伊，准备水底输出与定时治疗。',
    '海月处理潜水异象，伊洛伊支援邻近队友。先练习水底目标，海囚在后段登场。',
    '先处理锁页使徒与重甲精英。净化和打断同事将在后续招募，黑之书在后段登场。',
    '分散前排，用伊洛伊恢复梦行猎犬造成的伤害；墨菲克斯在后段登场。',
    '处理修补异象与荆棘花仆，练习集中输出和队伍续航；塞润尼缇在后段登场。',
    '浔暂停高速催缴单，早雾保护经济队员。先熟悉部属，讨债人在后段登场。',
    '薄荷与娜娜莉处理飞行异象。通关招募黑羽、灵可，练习追击与协击。',
    '处理棱光蝶卫，练习净化与侦测。通关招募九原、埃德嘉，准备识破幻象和解除异常。',
    '练习精英迎击与后排保护。通关招募哈尼娅、哈索尔，准备技能充能与危险格换位。',
    '清理鬼火部属，练习前排治疗。通关后招募法帝娅，准备降低持续地形伤害。',
    '处理拾金小兽与护盾使徒。通关后招募卡厄斯，准备消解护盾。',
    '达芙蒂尔处理重甲，埃德嘉净化队伍。通关后招募白藏，准备打断精英与首领。',
    '全队战前演练：按下一战调整编队，保留补给方斯。下一关开始正式首领挑战。'
  ];
  CAMPAIGN.forEach((stage,i)=>{
    delete stage.boss;
    const recruit=RECRUITMENT_SEQUENCE[i];
    stage.reward=recruit||null;
    stage.rewards=recruit?[recruit]:[];
    stage.intro=recruit?(i===0?'先安排小吱与薄荷，第一波只走两路。':`运用已招募同事守住五路，${i<3?'及时补充经济与输出。':'留钱应对后段成群异象。'}`)+`通关后招募${UNITS[recruit].name}。`:(i===21?practiceIntros[21]:'全队战前演练：灵活叠卡、补充前排与补给，迎接后段的大量异象。');
    stage.waves=i<2?5:i<8?6:i<15?7:8;
    stage.count=i<2?2:i<5?3:4;
    stage.money=i<2?300:i<10?400:600;
    stage.hp=i<2?.68:i<10?.8+i*.02:1.04;
    if(i>=8)stage.pool=[...new Set(['box','bill',...(stage.pool||[]).map(kind=>kind==='coinImp'&&i<19?'shield':kind)])];
    stage.phase='practice';
  });
  const campaignBosses=['boss','parcelKing','foreman','bird','butterfly','blackBook','serenetti','musicKing','rider','arachne','whale','mammon','debtCollector','morpheus'];
  for(const [i,boss] of campaignBosses.entries()){
    const environment=ENVIRONMENTS[boss],requires=environment.counter.slice();
    CAMPAIGN.push({name:ENEMIES[boss].name,phase:'boss',boss,requires,reward:null,rewards:[],waves:5,money:700+i*25,hp:1.08+i*.015,count:4,pool:[...new Set(['box','bill',...ENEMIES[boss].troops])],intro:environment.rule+'。建议携带：'+requires.map(k=>UNITS[k].name).join('、')+'；相关同事已可通过前段主线招募。'});
  }
  const MIDDLE_ENCOUNTERS={
    5:['rainman','paperSquadron'],6:['rainman','recordSpirit'],7:['rainman','auraGloves','paperSquadron'],
    8:['auraGloves','dreamHound','cardboardCastle'],9:['rainman','auraGloves','dreamHound','everlight'],
    10:['bandage','weatherGirl'],11:['bandage','chainAcolyte','cursedBlade'],12:['rainman','bandage','chainAcolyte','weatherGirl','everlight'],
    13:['bopp','auraGloves','decomposer'],14:['bopp','bandage','chainAcolyte','heroBear'],
    15:['rainman','auraGloves','dreamHound','paperSquadron','recordSpirit'],16:['bopp','veilDoll','cascadeKoi'],
    17:['auraGloves','bandage','dreamHound','trailerOctopus'],18:['bopp','auraGloves','chainAcolyte','cursedBlade','cardboardCastle'],
    19:['rainman','bopp','bandage','heroBear','weatherGirl'],20:['auraGloves','bandage','veilDoll','everlight','recordSpirit','decomposer'],
    21:[...Object.keys(NEW_ENCOUNTERS),'dreamHound','chainAcolyte']
  };
  const ELITE_LESSONS={8:'dreamHound',9:'dreamHound',10:'bandage',11:'cursedBlade',12:'chainAcolyte',13:'bopp',14:'heroBear',15:'dreamHound',16:'veilDoll',17:'trailerOctopus',18:'cursedBlade',19:'heroBear',20:'veilDoll'};
  for(const [index,kinds] of Object.entries(MIDDLE_ENCOUNTERS)){
    const stage=CAMPAIGN[index];stage.encounters=kinds.slice();
    stage.pool=[...new Set([...stage.pool,...kinds])];
    stage.eliteFocus=ELITE_LESSONS[index]||null;stage.eliteBudget=Number(index)<15?2:3;
    stage.intro+=' '+(kinds.some(k=>ENEMIES[k].rank==='normal')?'第二波起加入特性小怪；':'')+(kinds.some(k=>ENEMIES[k].rank==='elite')?'第三波起少量精英登场。':'')+'本关特性：'+kinds.map(k=>ENEMIES[k].name).join('、')+'。';
    if(stage.eliteFocus)stage.intro+=' 第三、四波先应对'+ENEMIES[stage.eliteFocus].name+'，后段再混合精英；保留净化、打断或撤回的余地。';
  }
  const RECRUIT_LESSONS={
    requiem:{title:'果冻清群',enemies:['box'],tip:'把安魂曲放在后排，用抛射果冻与地面持续伤害清理同路快递。'},
    sakiri:{title:'吞噬铁桶',enemies:['bin'],tip:'第二波起少量铁桶登场。把早雾放到敌人前方两格内，吞噬后用队友保护她度过消化时间。'},
    daffodil:{title:'重甲破除',enemies:['bin'],tip:'第二波起少量铁桶登场。让达芙蒂尔在前排削甲，后排输出接着击破。'},
    nanally:{title:'纸翼对空',enemies:['paperSquadron'],tip:'第二波先出现一只纸翼战队。地面近战无法拦住飞兵，用娜娜莉从后排对空射击。'},
    adler:{title:'护盾承伤',enemies:['auraGloves'],tip:'第二波起欧拉拳套登场。把阿德勒放在输出前一格，观察护盾如何分担后排受到的范围重拳。'},
    xun:{title:'瞬移阻停',enemies:['rainman'],tip:'第二波起雨人登场。在撑伞瞬移预警时让浔上场暂停本路，为击破雨人留出时间；同路时停共享24秒间隔。'},
    crimson:{title:'转焰烧涂鸦',enemies:['bopp'],focus:'bopp',partners:['mint'],tip:'第三波先出现一只波普。真红放在薄荷前方接住旋风，转化火焰可以烧掉禁止部署的涂鸦。'},
    skia:{title:'后门地刺',enemies:['rearHound'],tip:'第三波先出现一只后门猎犬，从左侧反向突入。把翳的地刺放在后排来敌必经的格子，二叠还会绊住敌人。'},
    haiyue:{title:'潜泳增伤',enemies:['cascadeKoi'],tip:'第二波起瀑鲤登场，它会制造短暂水面并潜泳。海月坐在水母上直接部署，对正在潜泳的目标造成3倍伤害。'},
    iroi:{title:'前排续航',enemies:['auraGloves','dreamHound'],focus:'dreamHound',tip:'第二波先用欧拉拳套练习治疗；第三波加入一只梦行猎犬。伊洛伊放在前排附近，定时治疗周围队友，禁疗时暂时无法恢复。'},
    blackFeather:{title:'蝶影优先',enemies:['prismMoth'],mirrors:true,tip:'第二波起棱光蝶卫登场，并带来一道蝶影。黑羽优先清除幻象，也能伤害普通敌人；二叠标记、三叠引爆。'},
    lingko:{title:'分身破甲',enemies:['bin'],partners:['nanally'],tip:'第二波起少量铁桶登场。灵可放在娜娜莉后方两格内，观察队友每攻击3次召唤一次分身；灵可二叠的分身还能削甲。'},
    hania:{title:'构造物充能',enemies:['bin'],partners:['requiem'],tip:'第二波起少量铁桶登场。把安魂曲升到三叠，哈尼娅放在同路两格内，观察构造物等待时间缩短。哈尼娅不会加快普通攻击。'},
    edgar:{title:'封技与催眠',enemies:['recordSpirit','weatherGirl'],tip:'第二波先出现唱片电灵，后续加入晴天娃娃。把埃德嘉放在受影响队友附近，清除封技、沉睡并提供短暂抗性。'},
    jiuyuan:{title:'蝶影识破',enemies:['prismMoth'],mirrors:true,tip:'第二波起棱光蝶卫登场，并带来一道蝶影。用九原识破蝶影，让真身短暂易伤，再由其他输出集中攻击。'},
    baicang:{title:'精英施法打断',enemies:['cursedBlade','decomposer'],focus:'cursedBlade',tip:'第二波出现分解者，第三波出现妖刀。白藏攻击前方两格内的敌人，直接取消蓄力技能；妖刀的后续回刃也会被一并取消。'},
    hathor:{title:'危险格换位',enemies:['veilDoll'],focus:'veilDoll',tip:'第三波先出现一只赤幕线偶。哈索尔放在队友旁边，后方留出空格，让他把蛛网危险格中的队友搬走。'},
    fadeya:{title:'灼地减伤',enemies:['fireRunner'],fire:true,tip:'第二波起鬼火信使带来短暂灼地，先预警2秒再生效。把法帝娅放在受影响队友附近，观察灼地伤害降低，也可以撤回避开。'},
    chaos:{title:'能量盾消解',enemies:['cardboardCastle','everlight','shield'],tip:'第二波先出现纸板城堡，后续加入长明灯与护盾使徒。卡厄斯可以清除能量盾；能量盾与护甲不同，破盾后仍需削甲输出。'}
  };
  for(const [index,kind]of RECRUITMENT_SEQUENCE.entries()){
    const stage=CAMPAIGN[index],lesson=RECRUIT_LESSONS[kind];
    stage.trial=[kind];stage.lesson=lesson;stage.name=UNITS[kind].name+' · '+lesson.title;
    stage.encounters=lesson.enemies.slice();stage.pool=[...new Set(['box','bill',...lesson.enemies])];
    stage.eliteFocus=lesson.focus||null;stage.eliteBudget=2;
    if(lesson.focus)ELITE_LESSONS[index]=lesson.focus;else delete ELITE_LESSONS[index];
    stage.intro='本关可试用'+UNITS[kind].name+'，通关后正式招募。'+lesson.tip+' 第一波先建立经济与防线，后段再增加同类敌人。';
    stage.waves=index<4?4:index<10?5:6;
    stage.hp=index<2?.68:Math.min(1.5,.8+index*.04);
    stage.challengeKind=index>=4?(lesson.focus||lesson.enemies[0]):null;
    stage.extraElite=index===18?'heroBear':index===17?'trailerOctopus':index===16||index===14?'veilDoll':index===15?'cursedBlade':index===13?'chainAcolyte':index>=9?'dreamHound':index>=8?'bandage':null;
    if(stage.extraElite){stage.encounters.push(stage.extraElite);stage.pool.push(stage.extraElite);stage.intro+=' 后两波会混入少量'+ENEMIES[stage.extraElite].name+'。';}
    if(stage.challengeKind)stage.intro+=' 最后一波出现一名强化领队，检验本关的克制用法。';
  }
  // Three old rehearsal chapters repeated the recruitment lessons without rewards.
  CAMPAIGN.splice(RECRUITMENT_SEQUENCE.length,3);
  for(const index of Object.keys(MIDDLE_ENCOUNTERS))if(Number(index)>=RECRUITMENT_SEQUENCE.length){delete MIDDLE_ENCOUNTERS[index];delete ELITE_LESSONS[index];}
  function normalizeProgress(value){
    const rawCleared=Math.max(0,Math.floor(Number(value?.cleared)||0));
    const mapped=[2,3].includes(value?.version)?rawCleared<=19?rawCleared:rawCleared<=22?19:rawCleared-3:rawCleared;
    const {cleared}=oldNormalize({...value,cleared:mapped});
    const earned=new Set([
      ...(Array.isArray(value?.recruited)?value.recruited:[]),
      ...(value?.version===2?legacyRecruitment.slice(0,rawCleared).flat():[]),
      ...CAMPAIGN.slice(0,cleared).flatMap(oldRewards)
    ]);
    return {version:4,cleared,recruited:ORDER.filter(kind=>earned.has(kind)&&!['chiz','mint','zero'].includes(kind))};
  }
  const migrateProgress=value=>normalizeProgress(value?.version>=2?value:oldMigrate(value));
  function completeCampaign(progress,game){
    const next=normalizeProgress(progress);
    if(game.mode==='campaign'&&game.phase==='won'&&game.stageIndex===next.cleared&&next.cleared<CAMPAIGN.length)next.cleared++;
    return normalizeProgress(next);
  }
  const STORE={
    cat:{name:'猫猫支援',price:22000,type:'item',cap:2,description:'使普通或精英敌人反攻8秒；全局限用两次'},
    medkit:{name:'应急医疗',price:30000,type:'item',cap:3,description:'全队回复35%生命；无法穿过禁疗'},
    cleanse:{name:'消解装置',price:26000,type:'item',cap:3,description:'解除全场负面状态并获得4秒抗性'},
    lamp:{name:'照明装置',price:20000,type:'item',cap:2,description:'识破幻象并驱散遮蔽10秒'},
    reserve:{name:'周转资金',price:42000,type:'perk',cap:3,description:'每级开局增加50局内方斯'},
    durability:{name:'制服加固',price:50000,type:'perk',cap:3,description:'每级角色生命增加5%'},
    zero:{name:'零',price:120000,type:'roster',cap:1,description:'永久招募四目标、四挥斩群攻助手'}
  };
  for(const product of Object.values(STORE))product.price*=3;
  function normalizeMeta(value){const m={version:1,bank:Math.max(0,Math.floor(Number(value?.bank)||0)),items:{},perks:{},owned:[],settled:[]};for(const [id,s] of Object.entries(STORE)){if(s.type==='item')m.items[id]=Math.min(s.cap,Math.max(0,Math.floor(Number(value?.items?.[id])||0)));if(s.type==='perk')m.perks[id]=Math.min(s.cap,Math.max(0,Math.floor(Number(value?.perks?.[id])||0)));}m.owned=value?.owned?.includes('zero')?['zero']:[];m.settled=Array.isArray(value?.settled)?value.settled.filter(x=>typeof x==='string').slice(-80):[];return m;}
  function unitHealth(kind,rank=1,meta={}){const d=UNITS[kind];return d.hp*RANK_HEALTH[rank]*(rank===3?1+(d.rank3HealthBonus||0):1)*(1+(meta.perks?.durability||0)*.05);}
  function buy(meta,id){const m=normalizeMeta(meta),s=STORE[id];if(!s)return {ok:false,error:'商品不存在',meta:m};const owned=s.type==='item'?m.items[id]:s.type==='perk'?m.perks[id]:m.owned.includes(id)?1:0;if(owned>=s.cap)return {ok:false,error:'已达到持有上限',meta:m};const price=s.price*(s.type==='perk'?owned+1:1);if(m.bank<price)return {ok:false,error:'存款方斯不足',meta:m};m.bank-=price;if(s.type==='item')m.items[id]++;else if(s.type==='perk')m.perks[id]++;else m.owned.push(id);return {ok:true,meta:m,price};}
  function settle(meta,game){const m=normalizeMeta(meta);if(game.sandbox||!['won','lost','cashed'].includes(game.phase)||m.settled.includes(game.runId))return {meta:m,deposit:0};const eligible=Math.min(Math.max(0,game.money),Math.max(0,game.earned));const deposit=Math.floor(eligible*20);m.bank+=deposit;m.settled.push(game.runId);m.settled=m.settled.slice(-80);return {meta:m,deposit,eligible};}
  function unlockedRoster(progress,meta={}){const normalized=normalizeProgress(progress),earned=new Set(['chiz','mint',...normalized.recruited,...normalizeMeta(meta).owned]);return ORDER.filter(kind=>earned.has(kind));}
  function eliteRecommendedDeck(stageIndex,available){
    const stage=CAMPAIGN[stageIndex],kinds=(stage?.encounters||[]).filter(k=>ELITE_MECHANICS[k]),focus=stage?.eliteFocus;
    if(focus)kinds.sort((a,b)=>Number(b===focus)-Number(a===focus));
    const priority=['chiz','mint',...(stage?.trial||[]),...(stage?.lesson?.partners||[]),...kinds.flatMap(k=>ELITE_COUNTERS[k]||[]),...api.DEFAULT_DECK,'xun','crimson'];
    return [...new Set(priority.filter(k=>available.includes(k)))].slice(0,10);
  }
  const cell=(u,c)=>u.lane===c.lane&&u.col===c.col;
  const ENDLESS_DUO_PLANS=[{bosses:['rider','blackBook'],name:'余烬与锁页',tip:'法帝娅降低灼地伤害，埃德嘉及时清除封技。'},{bosses:['bird','musicKing'],name:'逆风与重拍',tip:'娜娜莉优先对空，危险节拍格需要撤回或换位。'},{bosses:['butterfly','arachne'],name:'镜影与赤幕',tip:'黑羽或九原识破蝶影，薄荷与真红组合烧毁蛛网。'},{bosses:['serenetti','debtCollector'],name:'眠歌与催缴',tip:'埃德嘉净化异常，哈索尔换位解除追债；后方留出空格。'},{bosses:['whale','morpheus'],name:'海潮与梦猎',tip:'海月攻击水底目标，法帝娅减轻侵蚀，翳拦住后门梦猎。'}];
  class Game extends PreviousGame{
    constructor(options={}){
      super({...options,cleared:options.demo?CAMPAIGN.length:options.cleared,mode:options.mode==='random'?'endless':options.mode});
      this.mode=options.mode||this.mode;this.endless=['endless','random'].includes(this.mode);this.meta=normalizeMeta(options.meta);this.runId=options.runId||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
      this.specialistCounters=true;this.reinforcementReadyAt=0;this.bossSkillReadyAt=0;const duoRandom=api.makeRng(((options.seed||617)^0x6d2b79f5)>>>0);this.duoPlans=ENDLESS_DUO_PLANS.slice();for(let i=this.duoPlans.length-1;i>0;i--){const j=Math.floor(duoRandom()*(i+1));[this.duoPlans[i],this.duoPlans[j]]=[this.duoPlans[j],this.duoPlans[i]];}this.demo=!!options.demo;this.trial=this.chapter?.trial||[];
      this.available=this.sandbox||this.demo?ORDER.slice():[...new Set([...unlockedRoster({version:4,cleared:options.cleared,recruited:options.recruited},this.meta),...this.trial])];
      if(this.mode==='day')this.maxWaves=8;
      const desired=options.deck||api.DEFAULT_DECK;this.deck=[...new Set(desired)].filter(k=>this.available.includes(k)).slice(0,10);if(!this.deck.length)this.deck=this.available.slice(0,10);
      this.money+=this.sandbox?0:(this.meta.perks.reserve||0)*50;this.inventory={...this.meta.items};this.itemsUsed={};this.laneFreezeUntil=Array(R).fill(0);this.laneStopReady=Array(R).fill(0);this.environment=null;this.environmentStarted=0;this.environmentFade=0;this.bossWave=false;this.formationSwaps=0;this.changedSlots=[];this.queue=[];this.queueTimer=0;this.queueSerial=1;this.queueSelected=null;this.randomHistory=[];this.structures=[];this.assists=[];this.raidWarnings=[];this.runsBossCleared=0;this.stepDt=0;
    }
    canPlace(kind,lane,col){
      const d=UNITS[kind];if(!d||!ORDER.includes(kind))return '请选择常驻角色';if(!['running','preparing'].includes(this.phase))return '当前不能布阵';
      if(!Number.isInteger(lane)||!Number.isInteger(col)||lane<0||lane>=R||col<0||col>=C)return '请选择街道格子';
      if(this.hazards.some(h=>h.kind==='paint'&&(h.at||0)<=this.time&&h.until>this.time&&h.cells.some(c=>c.lane===lane&&c.col===col)))return '涂鸦暂时遮住部署格，请换格或等待颜料消退';
      if(!this.available.includes(kind))return '这位同事尚未招募';
      const queued=this.mode==='random'&&this.queue.find(q=>q.id===this.queueSelected&&q.kind===kind&&q.type==='unit');
      if(this.mode==='random'&&!queued)return '请从传送带选择角色';if(this.mode!=='random'&&!this.deck.includes(kind))return '这位同事不在本局编队中';
      const present=this.unitsAt(lane,col).find(u=>!!UNITS[u.kind].ground===!!d.ground);
      if(present&&present.kind!==kind)return '换一格，或先撤回已有角色';if(present&&(present.rank||1)>=3)return '已经达到三叠';
      if(present&&this.hazards.some(h=>h.kind==='web'&&h.until>this.time&&h.cells.some(c=>cell(present,c))))return '蛛网封住升级格；真红可烧毁蛛网';
      if(!queued&&this.money<d.cost)return '方斯不足';if(!queued&&(this.cooldowns[kind]||0)>0)return '角色还在准备中';return null;
    }
    place(kind,lane,col){
      const error=this.canPlace(kind,lane,col);if(error)return {ok:false,error};const d=UNITS[kind],free=this.mode==='random',cost=free?0:d.cost;
      const existing=this.unitsAt(lane,col).find(u=>u.kind===kind&&!!UNITS[u.kind].ground===!!d.ground);
      if(existing){this.money-=cost;this.spent+=cost;existing.invested=(existing.invested||0)+cost;const ratio=existing.hp/existing.maxHp;existing.rank=(existing.rank||1)+1;existing.maxHp=unitHealth(kind,existing.rank,this.meta);existing.hp=existing.maxHp*ratio;existing.upgradeUntil=this.time+1.2;this.cooldowns[kind]=free?0:d.cooldown;this.effects.push({kind:'rankUp',lane,x:existing.x,rank:existing.rank,ttl:1.2,total:1.2});this.emit('upgrade',{kind,rank:existing.rank});if(free)this.consumeQueue();return {ok:true,unit:existing,upgraded:true};}
      // PreviousGame.place dispatches to this.canPlace; temporarily supply the cost for a free conveyor card.
      const savedMoney=this.money;if(free)this.money=Math.max(this.money,d.cost);const result=super.place(kind,lane,col);if(free){this.money=savedMoney;this.spent-=d.cost;this.cooldowns[kind]=0;}
      if(result.ok){const u=result.unit;u.rank=1;u.invested=cost;u.attackCount=0;u.skillTimer=kind==='xun'?0:kind==='hathor'?0:kind==='requiem'?10:kind==='lingko'?0:5;u.maxHp=unitHealth(kind,1,this.meta);u.hp=u.maxHp;if(kind==='adler'){u.shield=140;u.shieldReadyAt=0;}u.platformId=null;u.oneShot=false;u.statuses={};if(kind==='xun'&&this.phase==='running')this.castLaneStop(u);if(free)this.consumeQueue();}return result;
    }
    consumeQueue(){this.queue=this.queue.filter(q=>q.id!==this.queueSelected);this.queueSelected=null;this.emit('queue');}
    remove(lane,col){if(!['running','preparing'].includes(this.phase))return false;const u=this.unitsAt(lane,col).find(v=>!UNITS[v.kind].ground)||this.unitsAt(lane,col)[0];if(!u)return false;const refund=this.mode==='random'?0:Math.floor((u.invested??UNITS[u.kind].cost)*.5);this.money+=refund;this.cooldowns[u.kind]=Math.min(this.cooldowns[u.kind]||0,.5);this.units=this.units.filter(v=>v!==u);this.feedback('撤回'+(refund?' +'+refund:''),lane,u.x);this.emit('remove',{kind:u.kind,lane,col});this.refreshCombos();return true;}
    beginWave(){
      super.beginWave();
      this.bossWave=this.spawns.some(s=>ENEMIES[s.kind].boss);
      this.regularWave=!this.bossWave&&!this.chapter?.boss&&!this.endless&&!this.sandbox;
      this.wavePacketSize=1;
      if(this.regularWave){
        const progress=(this.wave-1)/Math.max(1,this.maxWaves-1),early=this.chapter&&this.stageIndex<2;
        const base=!this.chapter?8:early?6:this.stageIndex<8?9:this.stageIndex<15?12:14;
        const growth=early?24:this.chapter&&this.stageIndex<8?37:this.chapter&&this.stageIndex<15?48:58;
        const count=Math.max(this.spawns.length,Math.round(base+growth*Math.pow(progress,1.7)));
        const planned=this.spawns.slice();
        this.wavePacketSize=this.wave===this.maxWaves?5:progress>=.65?3:1;
        this.spawns=Array.from({length:count},(_,i)=>({...planned[i%planned.length],packetIndex:i%this.wavePacketSize}));
        if(progress>=.65)this.waveHint=(this.wave===this.maxWaves?'最后一波 · 大量异象正在接近。':'异象群正在接近，准备迎接连续敌潮。')+' '+this.waveHint;
      }else if(this.endless)this.spawns=this.endlessWavePlan(this.wave);else this.spawns=this.spawns.slice(0,this.bossWave?8:this.chapter?.boss?16:35);
      this.planEncounterSpawns();
      this.planBossApproach();
      this.formationSwaps=0;this.changedSlots=[];
    }
    planBossApproach(){
      if(!this.chapter?.boss||this.bossWave||this.wave<2)return;
      const pool=ENEMIES[this.chapter.boss].troops.filter(k=>['elite','armored'].includes(ENEMIES[k].rank));
      if(!pool.length)pool.push('bandage');
      for(let i=0;i<(this.wave>=3?2:1);i++){
        const s=this.spawns[Math.floor((i+1)*this.spawns.length/3)];if(!s)continue;
        s.kind=pool[(this.wave+i)%pool.length];s.lane=(this.wave+i*2)%R;s.encounterElite=true;
        if(this.wave===this.maxWaves-1&&i===0)s.miniboss=true;
      }
      this.waveHint+=' 本波加入精英'+(this.wave===this.maxWaves-1?'与强化领队':'')+'，为首领机制做准备。';
    }
    endlessEncounter(block){if(block>=api.BOSS_ORDER.length&&block<api.BOSS_ORDER.length+api.ENDLESS_DUO_ENCOUNTERS)return this.duoPlans[block-api.BOSS_ORDER.length].bosses.slice();return super.endlessEncounter(block);}
    stageBosses(){if(this.endless){let block=Math.floor(Math.max(0,this.wave-1)/api.ENDLESS_CYCLE_WAVES);if(this.wave>0&&this.wave%api.ENDLESS_CYCLE_WAVES===0&&!this.bossWave&&!this.enemies.some(e=>e.hp>0&&ENEMIES[e.kind].boss))block++;return this.endlessEncounter(block);}return this.labBoss?[this.labBoss]:this.chapter?.boss?[this.chapter.boss]:[];}
    endlessBalance(block,size=1){if(size===1)return {health:.72+Math.min(block,10)*.028,damage:.82+Math.min(block,10)*.018};if(size===2)return {health:.78+Math.min(Math.max(0,block-11),4)*.025,damage:.88};return {health:.66+Math.min(Math.max(0,block-16),10)*.025,damage:.8};}
    endlessWavePlan(wave){
      const block=Math.floor((wave-1)/api.ENDLESS_CYCLE_WAVES),position=(wave-1)%api.ENDLESS_CYCLE_WAVES;
      const bosses=this.endlessEncounter(block),bossWave=position===api.ENDLESS_CYCLE_WAVES-1;
      const troops=[...new Set(bosses.flatMap(k=>ENEMIES[k].troops))];
      const additions=wave<4?[]:wave<7?['rainman','auraGloves']:Object.keys(NEW_ENCOUNTERS).filter(k=>k!=='rearHound');
      const traits=wave<7?additions:Array.from({length:3},(_,i)=>additions[(block*3+i)%additions.length]);
      const pool=wave===1?['box']:['box','bill',...traits,...troops];
      const count=bossWave?6:Math.min(18,8+position*3+Math.floor(block/2)),plan=[];
      if(bossWave){const lanes=bosses.length===3?[0,2,4]:bosses.length===2?[1,3]:[2];bosses.forEach((kind,i)=>plan.push({kind,lane:lanes[i]}));}
      let elites=0;
      for(let i=0;i<count;i++){
        let kind=(bossWave?troops:pool)[(block+position+i)%(bossWave?troops:pool).length];
        if(['elite','armored'].includes(ENEMIES[kind].rank)){if(elites>=2)kind=i%2?'bill':'box';else elites++;}
        plan.push({kind,lane:(block+i)%R});
      }
      return plan;
    }
    endlessForecast(count=3,startWave=this.wave+1){
      return Array.from({length:count},(_,i)=>{
        const wave=startWave+i,plan=this.endlessWavePlan(wave);
        return {wave,bosses:plan.filter(s=>ENEMIES[s.kind].boss).map(s=>s.kind),enemies:[...new Set(plan.filter(s=>!ENEMIES[s.kind].boss).map(s=>s.kind))],count:plan.length};
      });
    }
    summonBossTroops(e,command=false){
      const wait=Math.max(0,(this.reinforcementReadyAt||0)-this.time);
      if(e.recovery>0||wait>0){e.minionClock=Math.max(.5,wait);if(command)e.commandAt=this.time+Math.max(.5,wait);return;}
      const count=this.enemies.length;super.summonBossTroops(e,command);
      if(this.enemies.length>count)this.reinforcementReadyAt=this.time+8;
      e.minionClock=18;
    }
    planEncounterSpawns(){
      if(this.endless||this.bossWave||this.labBoss||this.chapter?.boss||!this.spawns.length)return;
      if(this.chapter?.lesson){this.planRecruitLesson();return;}
      const kinds=this.chapter?.encounters||(!this.chapter&&this.wave>=3?this.wave<5?['rainman','auraGloves','paperSquadron','recordSpirit']:this.wave<7?['rainman','auraGloves','paperSquadron','recordSpirit','everlight','weatherGirl','cardboardCastle','bandage','cursedBlade']:Object.keys(NEW_ENCOUNTERS):[]);
      if(!kinds.length)return;
      // Strip random picks first, then insert a bounded, spread-out teaching set.
      for(const spawn of this.spawns){delete spawn.encounterElite;if(kinds.includes(spawn.kind))spawn.kind='box';}
      const ordinary=kinds.filter(k=>ENEMIES[k].rank==='normal'),elite=kinds.filter(k=>ENEMIES[k].rank==='elite');
      const planned=[];
      const teaching=!!this.chapter?.eliteFocus&&this.wave>=3&&this.wave<=4;
      const ordinaryPool=teaching?ordinary.filter(k=>!['everlight','recordSpirit','weatherGirl'].includes(k)):ordinary;
      if(this.wave>=2&&ordinaryPool.length)for(let n=0;n<Math.min(6,1+Math.floor(this.wave*.75));n++)planned.push(ordinaryPool[(n+this.wave-2)%ordinaryPool.length]);
      if(this.wave>=3&&elite.length){
        const count=Math.min(this.chapter?.eliteBudget||4,1+Math.floor((this.wave-3)/2));
        for(let n=0;n<count;n++)planned.push(teaching?this.chapter.eliteFocus:elite[(n+this.wave-3)%elite.length]);
      }
      const count=Math.min(planned.length,this.spawns.length),gap=this.spawns.length/(count+1);
      let eliteLane=0;
      for(let n=0;n<count;n++){const spawn=this.spawns[Math.floor((n+1)*gap)],kind=planned[n];spawn.kind=kind;if(ENEMIES[kind].rank==='elite'){spawn.encounterElite=true;spawn.packetIndex=0;spawn.lane=(this.stageIndex+this.wave+eliteLane*2)%R;eliteLane++;}}
      if(count)this.waveHint+=' 本波特性：'+[...new Set(planned)].map(k=>ENEMIES[k].name).join('、')+'。';
    }
    planRecruitLesson(){
      const {enemies,focus}=this.chapter.lesson;
      for(const spawn of this.spawns)if(this.chapter.encounters.includes(spawn.kind)){spawn.kind='box';delete spawn.encounterElite;}
      if(this.wave<2)return;
      const ordinary=enemies.filter(k=>ENEMIES[k].rank!=='elite'),elite=enemies.filter(k=>ENEMIES[k].rank==='elite'),planned=[];
      const teaching=!!focus&&this.wave<=4;
      if(ordinary.length)for(let n=0;n<(this.wave<=4?1:Math.min(3,this.wave-3));n++)planned.push(ordinary[(this.wave<=3?0:this.wave-3+n)%ordinary.length]);
      if(this.wave>=3&&elite.length)for(let n=0;n<(this.wave<=4?1:Math.min(2,1+Math.floor((this.wave-3)/2)));n++)planned.push(teaching?focus:elite[n%elite.length]);
      const extra=this.chapter.extraElite;
      if(extra&&this.wave>=Math.max(5,this.maxWaves-1)){const eliteIndexes=planned.map((k,i)=>ENEMIES[k].rank==='elite'?i:-1).filter(i=>i>=0);if(eliteIndexes.length>=2)planned[eliteIndexes.at(-1)]=extra;else planned.push(extra);}
      const challenge=this.wave===this.maxWaves?this.chapter.challengeKind:null;
      if(challenge&&!planned.includes(challenge))planned.unshift(challenge);
      const gap=this.spawns.length/(planned.length+1);
      let eliteLane=0;
      let marked=false;
      planned.forEach((kind,n)=>{const spawn=this.spawns[Math.floor((n+1)*gap)];spawn.kind=kind;if(challenge===kind&&!marked){spawn.miniboss=true;spawn.packetIndex=0;marked=true;}if(ENEMIES[kind].rank==='elite'){spawn.encounterElite=true;spawn.packetIndex=0;spawn.lane=(this.stageIndex+this.wave+eliteLane*2)%R;eliteLane++;}});
      if(planned.length)this.waveHint+=' 本波练习：'+[...new Set(planned)].map(k=>ENEMIES[k].name).join('、')+'。';
    }
    arrivalInterval(){
      if(this.bossWave)return this.spawns[0]&&ENEMIES[this.spawns[0].kind].boss?3:4.8;
      if(this.regularWave){
        if(this.spawns[0]?.miniboss)return 4;
        if(this.spawns[0]?.encounterElite||this.lastEliteArrivalAt===this.time)return 3.2;
        if(this.spawns[0]?.packetIndex>0)return this.wavePacketSize===5?.2:.3;
        return this.wave===1?5:this.wave===2?3.6:Math.max(1.8,3-this.wave*.15);
      }
      return Math.max(1.2,super.arrivalInterval());
    }
    spawn(kind,lane,spawnOptions={}){if(!ENEMIES[kind].boss&&this.enemies.some(v=>v.hp>0&&ENEMIES[v.kind].boss)&&this.enemies.filter(v=>v.hp>0&&!ENEMIES[v.kind].boss).length>=api.BOSS_CADENCE.minionLimit)return null;const e=super.spawn(kind,lane);if(!e)return e;if(spawnOptions.miniboss){e.miniboss=true;e.maxHp*=2.1;e.hp=e.maxHp;e.damage*=1.2;e.speed*=.8;this.feedback('强化领队 · '+ENEMIES[kind].name,lane,e.x,'#a47439');this.emit('miniboss',{kind});}e.skillSealUntil=0;if(NEW_ENCOUNTERS[kind]||ELITE_MECHANICS[kind]){e.mobClock=({bopp:6,paperSquadron:2.5,everlight:5,recordSpirit:4,weatherGirl:3,cardboardCastle:4,trailerOctopus:5,cascadeKoi:4,dreamHound:7,chainAcolyte:6,veilDoll:6.5})[kind]||0;e.eliteClock=['bandage','heroBear'].includes(kind)?12:0;e.mobSlashCount=0;e.mobChannel=null;e.mobFollowUp=null;e.blinkUsed=false;e.mobRushRemaining=0;e.mobCharge=0;e.bearEnraged=false;}if(ENEMIES[kind].rank==='elite')this.lastEliteArrivalAt=this.time;if(kind==='rearHound'){e.x=.55;e.direction=1;e.entryUntil=this.time+1;}if(['shield','coinImp'].includes(kind))e.energyShield=kind==='coinImp'?160:120;
      if(kind==='whale'){e.openingSkillReleases=0;e.controlGuardUntil=0;}if(ENEMIES[kind].boss){const partners=this.enemies.filter(v=>v!==e&&v.hp>0&&ENEMIES[v.kind].boss).length;if(this.endless){const block=Math.floor(Math.max(0,this.wave-1)/api.ENDLESS_CYCLE_WAVES),balance=this.endlessBalance(block,this.endlessEncounter(block).length);e.hp=e.maxHp=Math.round(e.maxHp*balance.health);e.damageScale=balance.damage;}e.shot+=partners*4;e.minionClock=18;this.bossWave=true;if(!this.environment){this.environment=kind;this.environmentStarted=this.time;this.environmentFade=0;this.emit('environment',{kind});if(kind==='whale'){const warning={id:this.nextId++,bossId:e.id,cells:[],until:this.time+api.WHALE_WATER_SECONDS,region:'潮汐海面'};for(let l=0;l<R;l++)for(let c=5;c<C;c++)warning.cells.push({lane:l,col:c});this.applyFlood(warning);}}
        if(kind==='morpheus')this.raidClock=12;if(kind==='rider'&&this.environment==='rider'){const cells=[];for(let l=0;l<R;l++)for(let c=7;c<C;c++)cells.push({lane:l,col:c});this.hazards.push({id:this.nextId++,bossId:e.id,kind:'fire',cells,at:e.entryUntil+.5,until:Infinity,ambient:true});}if(['boss','parcelKing'].includes(kind))e.environmentClock=6;}
      return e;}
    recoverTax(e,amount=e.taxed||0){if(!amount)return;e.taxed=Math.max(0,(e.taxed||0)-amount);this.money+=amount;for(const bag of this.enemies)if(bag.bagOwner===e.id){bag.bagValue=0;bag.hp=0;}this.feedback('追回方斯 +'+amount,e.lane,e.x,'#b08e4a');}
    kill(e,swallowed=false){if(e.dead)return;if(e.kind==='whale'&&(e.openingSkillReleases||0)<2){e.hp=e.maxHp*.12;return;}const boss=ENEMIES[e.kind]?.boss,tax=e.taxed||0;e.taxed=0;const bagValue=e.bagValue||0;super.kill(e,swallowed);if(tax)this.recoverTax(e,tax);if(bagValue){const owner=this.enemies.find(v=>v.id===e.bagOwner);const recovered=Math.min(bagValue,owner?.taxed||0);if(owner)owner.taxed-=recovered;this.money+=recovered;e.bagValue=0;if(recovered)this.feedback('钱袋追回 +'+recovered,e.lane,e.x,'#b08e4a');}if(boss&&this.environment===e.kind){this.environmentLeaving={kind:e.kind,until:this.time+1.5};const other=this.enemies.find(v=>v!==e&&v.hp>0&&ENEMIES[v.kind].boss);this.environment=other?.kind||null;this.environmentStarted=this.time;this.environmentFade=this.time+1.5;}if(e.soulExplosive&&e.soulMarkUntil>this.time){this.effects.push({kind:'soulBurst',lane:e.lane,x:e.x,ttl:.65,total:.65});for(const v of this.enemies)if(v!==e&&v.hp>0&&Math.abs(v.x-e.x)<1&&Math.abs(v.lane-e.lane)<=1)this.damageEnemy(v,90,{bypass:true,reaction:true,attribute:'soul',sourceLane:e.lane,sourceKind:'blackFeather'});}}
    areaCells(areas){const cells=[];for(const a of areas)for(let lane=a.laneMin;lane<=a.laneMax;lane++)for(let col=Math.max(0,Math.floor(a.x1));col<Math.min(C,Math.ceil(a.x2));col++)if(!cells.some(v=>v.lane===lane&&v.col===col))cells.push({lane,col});return cells;}
    addGround(e,kind,cells,duration,warning=0){this.hazards.push({id:this.nextId++,bossId:e.id,kind,cells,at:this.time+warning,until:this.time+duration+warning});}
    updateBossNormal(e,dt){const cast=e.normalCast;this.inBossNormalDamage=true;this.activeBossDamageScale=e.damageScale||1;try{super.updateBossNormal(e,dt);}finally{this.inBossNormalDamage=false;this.activeBossDamageScale=1;}if(cast&&!e.normalCast&&e.kind==='boss'){this.addGround(e,'crumbs',this.areaCells([cast.area]),8);this.feedback('碎罐 · 敌人减速',cast.area.laneMin,cast.area.x1,'#8b917c');}}
    isSubmerged(e){if(e.kind==='whale')return super.isSubmerged(e);return !!ENEMIES[e.kind]?.aquatic&&this.isWater(e.lane,Math.max(0,Math.min(C-1,Math.floor(e.x))))&&((this.time+(e.id%3))%9)<6;}
    applyFlood(warning){
      const id=warning.id??this.nextId++,until=Math.min(warning.until??this.time+api.WHALE_WATER_SECONDS,this.time+api.WHALE_WATER_SECONDS),surge=Number.isFinite(warning.at)&&this.enemies.find(e=>e.id===warning.bossId&&e.kind==='whale');
      for(const c of warning.cells){
        const tile=this.terrain[c.lane][c.col],water=this.isWater(c.lane,c.col);
        if(!water){tile.waterStarted=this.time;tile.waterUntil=until;tile.waterZone=id;tile.waterRegion=warning.region||'潮汐海面';}
        else{tile.waterStarted??=this.time;tile.waterUntil=Math.min(Math.max(tile.waterUntil,until),tile.waterStarted+api.WHALE_WATER_SECONDS);tile.waterZone??=id;tile.waterRegion??=warning.region||'潮汐海面';}
        if(!warning.skipRefreshDamage&&(surge||water))for(const u of this.unitsAt(c.lane,c.col)){const before=u.hp,amount=surge?(90+u.maxHp*.12)*(water?1.35:1)*(surge.enraged?1.2:1)*(surge.status.weakUntil>this.time?.8:1)*(surge.damageScale||1):u.maxHp*.12;this.damageBossSkill(u,amount);if(surge&&before>u.hp)this.feedback('浪击 -'+Math.ceil(before-u.hp),u.lane,u.x,'#b05d73');}
      }
      for(const h of this.hazards)if(h.kind==='fire')h.cells=h.cells.filter(c=>!warning.cells.some(w=>w.lane===c.lane&&w.col===c.col));
      this.hazards=this.hazards.filter(h=>h.cells.length);this.waterRevision=(this.waterRevision||0)+1;this.emit('flood',{cells:warning.cells});
    }
    selectWhaleLanding(e){
      const wet=[],dry=[];
      for(let lane=0;lane<R;lane++)for(let col=0;col<C;col++){
        const hits=this.units.filter(u=>u.hp>0&&!u.oneShot&&Math.abs(u.lane-lane)<=1&&Math.abs(u.col-col)<=1).length;
        const target={lane,col,x:col+.5,score:hits*100-Math.abs(col-6)-Math.abs(lane-(e.travelLane??e.lane))*.1};
        (this.isWater(lane,col)?wet:dry).push(target);
      }
      e.whaleLeapCount=(e.whaleLeapCount||0)+1;
      const land=dry.length&&(!wet.length||e.whaleLeapCount%3===0||this.random()<.25),pool=land?dry:wet;
      pool.sort((a,b)=>b.score-a.score);return pool[0]||dry[0];
    }
    waterSurfaceAreas(){
      const areas=[],previous=new Map();
      for(let lane=0;lane<R;lane++)for(let col=0;col<C;){
        const tile=this.terrain[lane][col];if(!(tile.waterUntil>this.time)){col++;continue;}
        const first=col,zone=tile.waterZone??'temporary',until=tile.waterUntil;
        while(++col<C){const next=this.terrain[lane][col];if(next.waterUntil!==until||(next.waterZone??'temporary')!==zone)break;}
        const key=zone+':'+first+':'+col+':'+until,last=previous.get(key);
        if(last?.row2===lane){last.row2=lane+1;continue;}
        const area={zone,row1:lane,row2:lane+1,col1:first,col2:col,started:tile.waterStarted??this.time-1.6,until,name:tile.waterRegion||'临时水面'};
        areas.push(area);previous.set(key,area);
      }
      return areas;
    }
    targetable(e,u){if(!e||e.hp<=0||e.controlCat||e.entryUntil>this.time)return false;const d=ENEMIES[e.kind];if(d.air&&!['mint','nanally','haiyue','requiem','blackFeather','jiuyuan','zero'].includes(u.kind)&&!(d.boss&&u.kind==='daffodil'))return false;if(d.illusion)return ['jiuyuan','blackFeather','mint','requiem'].includes(u.kind);return true;}
    bossComboStep(e,index=e.skillIndex){const opening=e.kind==='whale'&&(e.openingSkillReleases||0)<2,step=super.bossComboStep(e,opening?((e.openingSkillReleases||0)===0?2:3):index);return {...step,windup:step.tier==='minor'?2:3,recovery:step.last?3:.65,gap:step.last?(e.enraged?6:8):1.3};}
    bossSkillDamage(e,a){return Math.round(super.bossSkillDamage(e,a)*.9*(e.damageScale||1));}
    isBossControlProtected(e){return e.kind==='whale'&&((e.openingSkillReleases||0)<2||this.time>=(e.controlGuardStartsAt||0)&&this.time<(e.controlGuardUntil||0));}
    breakBoss(e){if(this.isBossControlProtected(e)){e.breakMeter=0;e.breakReady=this.time+4;e.status.vulnerable=Math.max(e.status.vulnerable||0,this.time+4);this.feedback('深海蓄势 · 弱势转为易伤',e.lane,e.x,'#65a8b9');return;}super.breakBoss(e);if(e.kind==='whale'){e.controlGuardStartsAt=this.time+1.8;e.controlGuardUntil=this.time+9.8;}}
    chargeBoss(e){if(this.enemies.some(v=>v!==e&&v.hp>0&&ENEMIES[v.kind].boss)&&(this.time<this.bossSkillReadyAt||this.enemies.some(v=>v!==e&&v.hp>0&&ENEMIES[v.kind].boss&&v.windup>0))){e.shot=1;return;}super.chargeBoss(e);if(e.windup>0&&e.kind!=='whale')e.windup=e.windupTotal=Math.max(e.windup,2);}
    releaseBoss(e){const landing=e.kind==='whale'&&e.diveTarget?{...e.diveTarget}:null,areas=this.bossAreas(e).map(a=>({...a})),oldTax=e.taxed||0,zeroStatuses=this.units.filter(u=>u.kind==='zero').map(u=>[u,Object.fromEntries(['sleepUntil','confusedUntil','sealedUntil','antihealUntil','burnUntil'].map(k=>[k,u[k]||0]))]);super.releaseBoss(e);if(landing){const lane=Math.round(landing.lane),col=Math.max(0,Math.min(C-1,Math.floor(landing.x))),cells=[];for(let l=Math.max(0,lane-1);l<=Math.min(R-1,lane+1);l++)for(let c=Math.max(0,col-1);c<=Math.min(C-1,col+1);c++)cells.push({lane:l,col:c});this.applyFlood({id:this.nextId++,bossId:e.id,cells,until:this.time+api.WHALE_WATER_SECONDS,region:'跃击带海',skipRefreshDamage:true});}if(e.kind==='whale'){e.openingSkillReleases=(e.openingSkillReleases||0)+1;e.controlGuardStartsAt=this.time;e.controlGuardUntil=this.time+5;e.stunUntil=0;}this.bossSkillReadyAt=this.time+2.2;for(const [u,before]of zeroStatuses)for(const key of Object.keys(before))if(u[key]>Math.max(this.time,before[key]))u[key]=this.time+(u[key]-this.time)*.5;for(const u of this.units){if(u.hp<=0||!areas.some(a=>u.lane>=a.laneMin&&u.lane<=a.laneMax&&u.x>=a.x1&&u.x<=a.x2))continue;if(e.kind==='rider')this.applyStatus(u,'burn',6);if(e.kind==='blackBook')this.applyStatus(u,'seal',6);if(e.kind==='serenetti'&&e.comboStep?.tier==='major')this.applyStatus(u,'antiheal',6);if(e.kind==='foreman')this.applyStatus(u,'antiheal',4);}
      if(e.kind==='foreman')this.addGround(e,'cracked',this.areaCells(areas),4);if(e.kind==='serenetti'&&e.comboStep?.tier==='major')this.addGround(e,'silence',this.areaCells(areas),6);
      const stolen=(e.taxed||0)-oldTax;if(e.kind==='mammon'&&stolen>0){const bag=this.spawn('moneyBag',e.skillAnchor?.lane??e.lane);if(!bag){this.recoverTax(e,stolen);return;}bag.x=Math.min(C-1,Math.max(6,e.skillAnchor?.x||8));bag.bagOwner=e.id;bag.bagValue=stolen;bag.energyShield=80;bag.entryUntil=0;this.feedback('钱袋 · 击破返还',bag.lane,bag.x,'#b08e4a');}
      for(const h of this.hazards.filter(h=>h.bossId===e.id&&h.kind==='beat')){h.beatPeriod=3;h.beatIn=3;h.beatDamage=28;}
      e.shot=Math.max(e.shot,4);}
    applyStatus(u,id,seconds){if(u.resistUntil>this.time||id==='antiheal'&&this.protectedEnvironment(u,3))return false;seconds*=UNITS[u.kind].statusDurationMultiplier||1;if(id==='burn'){u.burnStacks=Math.min(3,(u.burnStacks||0)+1);u.burnUntil=this.time+seconds;}else u[id==='antiheal'?'antihealUntil':id==='seal'?'sealedUntil':id==='sleep'?'sleepUntil':'confusedUntil']=this.time+seconds;this.feedback((id==='burn'?'灼烧 '+u.burnStacks+'层':id==='antiheal'?'禁疗':id==='seal'?'封技':id==='sleep'?'沉睡':'惑音')+' '+seconds+'s',u.lane,u.x,ENVIRONMENTS[this.environment]?.color);return true;}
    cleanseUnit(u,seconds=2){u.confusedUntil=u.sleepUntil=u.sealedUntil=u.antihealUntil=u.dotUntil=u.burnUntil=0;u.burnStacks=0;u.resistUntil=this.time+seconds;this.effects.push({kind:'cleanse',lane:u.lane,x:u.x,ttl:.6,total:.6});}
    healUnit(u,amount,source=null){if(!u||u.hp<=0||u.antihealUntil>this.time)return 0;const healed=Math.min(amount,u.maxHp-u.hp);u.hp+=healed;this.healing+=healed;if(healed>1)this.effects.push({kind:'heal',lane:u.lane,x:u.x,text:'+'+Math.round(healed),color:'#78a987',ttl:.7,total:.7});return healed;}
    anchorArea(u){const lanes=(u.rank||1)>1?1:0;return {x1:Math.max(0,u.col-2),x2:Math.min(C,u.col+3),laneMin:Math.max(0,u.lane-lanes),laneMax:Math.min(R-1,u.lane+lanes)};}
    protectedEnvironment(u,minRank=1){return this.units.some(v=>{if(v.hp<=0||v.kind!=='fadeya'||(v.rank||1)<minRank)return false;const a=this.anchorArea(v);return u.col>=a.x1&&u.col<a.x2&&u.lane>=a.laneMin&&u.lane<=a.laneMax;});}
    damageUnit(u,amount,source={}){
      if(!u||u.hp<=0)return;
      const environment=this.inEnvironmentalDamage||source.environment;
      if(this.inBossNormalDamage)amount*=(UNITS[u.kind].bossDamageTaken||1)*(this.activeBossDamageScale||1);else if(u.kind==='zero'&&!this.resolvingBossSkill&&!this.inDirectBossSkill)amount*=.8;
      if(environment){if(this.protectedEnvironment(u))amount*=.2;}
      else if(u.kind==='crimson'&&u.rank===3){u.heat=Math.min(100,(u.heat||0)+amount*.45);if(u.heat>=100){u.hotUntil=this.time+12;u.heat=0;}}
      // One nearest protector supplies the shared shield; shields cannot stack.
      const protectedBy=u.kind==='adler'?null:this.units.filter(v=>v!==u&&v.kind==='adler'&&v.hp>0&&v.shield>0&&v.lane===u.lane&&v.col>u.col&&v.col-u.col<=(v.rank||1)).sort((a,b)=>a.col-b.col)[0]||null;
      const before=[u,protectedBy].filter(Boolean).map(v=>[v,v.shield||0]);
      super.damageUnit(u,amount,{...source,shieldFraction:environment?.25:1,protector:protectedBy});
      for(const [v,shield]of before)if(v.kind==='adler'&&shield>0&&v.shield<=0)v.shieldReadyAt=this.time+10;
    }

    counterFeedback(e,label){
      if((e.counterFxAt??-1)>this.time)return;e.counterFxAt=this.time+.9;
      this.effects.push({kind:'counter',lane:e.lane,x:e.x,text:'克制 · '+label,color:'#a17422',ttl:.75,total:.75});
    }
    damageEnemy(e,amount,options={}){
      if(!e||e.hp<=0||amount<=0||e.entryUntil>this.time)return;
      const d=ENEMIES[e.kind],kind=options.sourceKind,detector=['blackFeather','jiuyuan'].includes(kind);
      if(e.revealedUntil>this.time&&e.mirrorsUntil>this.time)this.revealButterfly(e);
      if(options.rankMultiplier)amount*=options.rankMultiplier;
      if(d.illusion){if(detector)this.counterFeedback(e,'幻象');else amount*=.2;}
      else if(e.mirrorsUntil>this.time){if(detector)this.counterFeedback(e,'识破');else amount*=.25;}
      if(d.air&&!d.illusion){amount*=kind==='nanally'?2:.55;if(kind==='nanally')this.counterFeedback(e,'对空');}
      if(this.isSubmerged(e)&&kind==='haiyue')this.counterFeedback(e,'水底');
      if(d.rear){amount*=kind==='skia'?4:.65;if(kind==='skia')this.counterFeedback(e,'背袭');}
      if(e.energyShield>0){const blocked=Math.min(e.energyShield,amount*.25);e.energyShield-=blocked;amount=Math.max(0,amount-blocked/.25);e.shieldHitUntil=this.time+.25;if(!amount)return;}
      const heavy=e.armor>0&&(d.rank==='armored'||!d.boss&&d.armor>=60||['foreman','mammon'].includes(e.kind));
      const armorCounter=kind==='daffodil'||kind==='lingko'&&options.linkAttack&&options.sourceRank>1;
      if(heavy&&!options.shieldBreak){if(armorCounter)this.counterFeedback(e,'破甲');else{amount*=.4;e.armor=Math.max(0,e.armor-amount*.2);options={...options,bypass:true,shred:0};}}
      const tax=e.taxed||0,before=e.hp;e.taxed=0;super.damageEnemy(e,amount,options);if(e.kind==='whale'&&(e.openingSkillReleases||0)<2)e.hp=Math.max(e.hp,e.maxHp*.12);
      if(e.kind==='decomposer'&&e.hp>0)e.mobCharge=Math.min(240,(e.mobCharge||0)+Math.max(0,before-e.hp));
      if(tax){e.taxed=tax;if(e.dead||e.recovery>0)this.recoverTax(e);}
    }
    damageMultiplier(u){return (UNITS[u.kind].damageClass==='ranged'?RANGED_DAMAGE:RANK_DAMAGE)[u.rank||1];}
    rankOptions(u,extra={}){return {attribute:UNITS[u.kind].attribute,sourceLane:u.lane,sourceKind:u.kind,sourceId:u.id,sourceRank:u.rank||1,rankMultiplier:this.damageMultiplier(u),...extra};}
    bossSkillHitAmount(u,amount){return super.bossSkillHitAmount(u,amount*(UNITS[u.kind].bossDamageTaken||1));}
    damageBossSkill(u,amount){const previous=this.inDirectBossSkill;this.inDirectBossSkill=true;try{super.damageBossSkill(u,amount);}finally{this.inDirectBossSkill=previous;}}
    allies(u,lanes=1,columns=2){return this.units.filter(v=>v.hp>0&&!UNITS[v.kind].ground&&Math.abs(v.lane-u.lane)<=lanes&&Math.abs(v.col-u.col)<=columns);}
    linkerFollows(linker,unit){if(!this.skillReady(linker))return false;const nearest=this.allies(linker,(linker.rank||1)>1?1:0,2).filter(v=>v!==linker&&v.col>=linker.col&&!['chiz','iroi','adler','edgar','hania','fadeya'].includes(v.kind)).sort((a,b)=>Math.abs(a.col-linker.col)+Math.abs(a.lane-linker.lane)-Math.abs(b.col-linker.col)-Math.abs(b.lane-linker.lane)||a.id-b.id)[0];return nearest===unit;}
    skillReady(u){return !(u.sealedUntil>this.time||u.sleepUntil>this.time||u.confusedUntil>this.time);}
    castLaneStop(u){if(u.hp<=0||!this.skillReady(u)||this.laneStopReady[u.lane]>this.time)return false;this.laneFreezeUntil[u.lane]=this.time+[0,2,3,5][u.rank||1];this.laneStopReady[u.lane]=this.time+24;u.skillTimer=24;u.anim=1;u.skillPoseUntil=this.time+1;this.effects.push({kind:'timeStop',lane:u.lane,x:u.x,ttl:1,total:1});this.emit('freeze',{lane:u.lane});return true;}
    mintWindReceiver(p,old,next){if(p.sourceKind!=='mint'||next<old)return null;return this.units.filter(u=>u.hp>0&&u.kind==='crimson'&&u.lane===p.lane&&this.skillReady(u)&&u.x+.25>=old-(p.radius||.4)&&u.x-.25-(p.radius||.4)<=next).sort((a,b)=>a.x-b.x||a.id-b.id)[0]||null;}
    convertMintWind(p,u){const rank=u.rank||1,hot=rank===3&&u.hotUntil>this.time,damage=p.damage*Math.max(p.minimumScale??1,1-(p.falloff||0)*p.hitIds.length)*1.5*RANGED_DAMAGE[rank]*(hot?1.3:1);p.ttl=0;u.anim=.65;u.skillPoseUntil=this.time+.65;u.flameCount=(u.flameCount||0)+1;
      // Queue the new flame until the inherited projectile step is finished.
      (this.convertedFlames??=[]).push({kind:'dragonflame',lane:u.lane,sourceLane:u.lane,sourceId:u.id,sourceKind:'crimson',x:u.x+.3,startX:u.x+.3,endX:u.x+3,speed:4.8,damage,ttl:3/4.8,hitIds:[],falloff:.12,minimumScale:.5,attribute:UNITS.crimson.attribute,radius:.35,slowSeconds:p.slowSeconds||0,burnSeconds:rank>1?6:4});this.emit('flameConversion',{lane:u.lane,kind:'crimson'});
      for(const h of this.hazards)if(['web','paint'].includes(h.kind))h.cells=h.cells.filter(c=>!(c.lane===u.lane&&c.col>=u.col&&c.col<=u.col+3));}
    attackUnits(dt){
      // Advance all clocks together; the shared-lane caster must not depend on array order.
      for(const u of this.units)if(u.hp>0)u.skillTimer=(u.skillTimer??5)-dt;
      for(const u of this.units){if(u.hp<=0)continue;const d=UNITS[u.kind],rank=u.rank||1,m=this.damageMultiplier(u);u.anim=Math.max(0,u.anim-dt);u.hurt=Math.max(0,u.hurt-dt);u.born=Math.max(0,(u.born||0)-dt);u.digest=Math.max(0,(u.digest||0)-dt);u.shieldFlash=Math.max(0,(u.shieldFlash||0)-dt);
        if(u.expiresAt&&u.expiresAt<=this.time){u.hp=0;continue;}if(u.sleepUntil>this.time)continue;
        if(u.confusedUntil>this.time){u.timer-=dt;if(u.timer<=0){const friend=this.units.filter(v=>v!==u&&v.hp>0&&v.lane===u.lane).sort((a,b)=>Math.abs(a.x-u.x)-Math.abs(b.x-u.x))[0];if(friend)this.damageUnit(friend,14);u.timer=Math.max(1.4,d.interval);u.anim=.6;}continue;}
        if(this.skillReady(u)&&u.skillTimer<=0){
          if(u.kind==='xun'&&this.laneStopReady[u.lane]<=this.time){const caster=this.units.filter(v=>v.hp>0&&v.kind==='xun'&&v.lane===u.lane&&this.skillReady(v)&&(v.skillTimer??5)<=0).sort((a,b)=>(b.rank||1)-(a.rank||1)||a.id-b.id)[0];if(caster===u)this.castLaneStop(u);}
          if(u.kind==='requiem'&&rank===3){const target=this.enemies.find(e=>e.hp>0&&this.inLane(e,u.lane));if(target){this.structures.push({kind:'requiem',sourceId:u.id,lane:u.lane,x:Math.min(C-1,target.x),until:this.time+8,timer:0});u.skillTimer=14;u.skillPoseUntil=this.time+.8;this.effects.push({kind:'construct',lane:u.lane,x:target.x,ttl:.8,total:.8});}}
          if(u.kind==='hathor'){const friend=this.allies(u,rank>1?1:0,2).find(v=>v!==u&&(this.hazards.some(h=>h.until>this.time&&h.cells.some(c=>cell(v,c)))||this.enemies.some(e=>e.debtMark?.targetId===v.id)));if(friend){const empty=[friend.col-1,friend.col-2].find(c=>c>=0&&!this.unitsAt(friend.lane,c).some(v=>!!UNITS[v.kind].ground===!!UNITS[friend.kind].ground));if(empty!==undefined){const old=friend.x;friend.col=empty;friend.x=empty+.5;this.effects.push({kind:'relocate',lane:friend.lane,x:old,endX:friend.x,ttl:.7,total:.7});for(const e of this.enemies)if(e.debtMark?.targetId===friend.id)this.clearDebt(e,'换位 · 契约失效');if(rank===3)friend.shield=(friend.shield||0)+100;u.skillTimer=[0,7,6,4][rank];u.skillPoseUntil=this.time+.8;}}}
        }
        const wind=this.birdWindAt(u.lane,u.col)&&!['mint','nanally','chiz','adler'].includes(u.kind);u.timer-=dt*(this.supportUntil>this.time?1.35:1)*(wind?.7:1);if(u.timer>0)continue;
        if(u.kind==='chiz'){const amount=[0,25,35,45][rank];this.dropCoin(u.lane,u.x,amount);u.timer=rank===3?12:15;u.anim=.7;this.effects.push({kind:'stamp',lane:u.lane,x:u.x,value:amount,ttl:.65,total:.65});continue;}
        if(u.kind==='iroi'){let healed=0;for(const v of this.allies(u))healed+=this.healUnit(v,[0,28,36,48][rank],u);if(healed>0){if(rank===3)for(const v of this.allies(u))if(v.hp<v.maxHp*.5&&!(v.antihealUntil>this.time))v.regenUntil=this.time+3;u.anim=.7;u.skillPoseUntil=this.time+.7;this.effects.push({kind:'sheepHeal',lane:u.lane,x:u.x,fromX:u.x+.5,fromLane:u.lane,ttl:.7,total:.7});}u.timer=d.interval;continue;}
        if(u.kind==='adler'){if(u.shield>0||this.time<(u.shieldReadyAt||0)){u.timer=.25;continue;}if(this.skillReady(u)){u.shield=[0,140,200,260][rank];u.skillPoseUntil=this.time+.7;this.effects.push({kind:'shieldRaise',lane:u.lane,x:u.x,ttl:.7,total:.7});}u.timer=d.interval;u.anim=.7;continue;}
        if(u.kind==='edgar'){if(this.skillReady(u)){const affected=this.allies(u,rank>1?1:0).filter(v=>['sleepUntil','confusedUntil','sealedUntil','antihealUntil','burnUntil'].some(k=>v[k]>this.time)).slice(0,rank===1?1:rank===2?3:6);for(const v of affected)this.cleanseUnit(v,[0,3,4,6][rank]);u.anim=.7;if(affected.length)u.skillPoseUntil=this.time+.7;}u.timer=5;continue;}
        if(u.kind==='hania'){if(this.skillReady(u)){for(const v of this.allies(u,rank>1?1:0))if(v!==u)v.skillTimer=Math.max(0,(v.skillTimer||0)-rank*1.2);u.anim=.7;u.skillPoseUntil=this.time+.7;this.effects.push({kind:'charge',lane:u.lane,x:u.x,ttl:.7,total:.7});}u.timer=6;continue;}
        if(u.kind==='fadeya'){if(this.skillReady(u)&&rank===3){for(const v of this.allies(u))v.antihealResistUntil=this.time+5;u.skillPoseUntil=this.time+.7;}u.timer=5;u.anim=0;continue;}
        if(u.kind==='crimson'&&rank<3)continue;
        let targets=this.enemies.filter(e=>this.targetable(e,u)&&this.inLane(e,u.lane)&&(u.kind==='skia'?Math.abs(e.x-u.x)<.65:e.x>=u.x-.35)).sort((a,b)=>a.x-b.x);
        if(u.kind==='xun')targets=targets.filter(e=>!ENEMIES[e.kind].air&&this.attackDistance(e,u)<=d.range);
        if(['jiuyuan','blackFeather'].includes(u.kind))targets=this.enemies.filter(e=>this.targetable(e,u)&&Math.abs(e.lane-u.lane)<=(rank>1?1:0)).sort((a,b)=>(!!ENEMIES[b.kind].illusion)-(!!ENEMIES[a.kind].illusion)||a.x-b.x);
        if(u.kind==='haiyue')targets=this.enemies.filter(e=>this.targetable(e,u)&&Math.abs(e.lane-u.lane)<=1&&this.attackDistance(e,u)<=d.range&&e.x>=u.x-.35).sort((a,b)=>Math.abs(a.lane-u.lane)-Math.abs(b.lane-u.lane)||a.x-b.x);
        if(u.kind==='nanally')targets.sort((a,b)=>Number(!!ENEMIES[b.kind].air)-Number(!!ENEMIES[a.kind].air)||a.x-b.x);
        if(u.kind==='chaos')targets.sort((a,b)=>Number((b.energyShield||0)+(rank>1?b.orderShield||0:0)>0)-Number((a.energyShield||0)+(rank>1?a.orderShield||0:0)>0)||a.x-b.x);
        if(u.kind==='zero'&&rank>1)targets=this.enemies.filter(e=>this.targetable(e,u)&&Math.abs(e.lane-u.lane)<=1&&Math.abs(e.x-u.x)<=3).sort((a,b)=>a.x-b.x);
        if(d.damageClass==='ranged')targets=targets.filter(e=>this.attackDistance(e,u)<=d.range);
        if(!targets.length||u.digest>0)continue;let target=targets[0];if(u.kind==='daffodil')target=targets.find(e=>e.armor>0&&this.attackDistance(e,u)<=d.range)||targets.find(e=>ENEMIES[e.kind].boss&&this.attackDistance(e,u)<=d.range)||target;const opts=this.rankOptions(u);
        if(u.kind==='skia'){const near=targets.filter(e=>!ENEMIES[e.kind].air&&Math.abs(e.x-u.x)<.55);if(!near.length)continue;for(const e of near){this.damageEnemy(e,24,{...opts,bypass:true,impact:'shadow'});if(ENEMIES[e.kind].rear)e.stunUntil=this.time+1.1;if(rank>1)e.status.slow=this.time+(rank===3?2:1);}if(rank===3)u.skillPoseUntil=this.time+.4;this.effects.push({kind:'shadowSpike',lane:u.lane,x:u.x,ttl:.4,total:.4});}
        else if(u.kind==='mint'){this.projectiles.push({kind:'wind',lane:u.lane,sourceLane:u.lane,sourceKind:'mint',sourceId:u.id,x:u.x+.3,speed:3.6,damage:d.damage*m,ttl:d.range/3.6+.15,hitIds:[],falloff:.18,minimumScale:.35,attribute:d.attribute,radius:rank>1?.65:.4,slowSeconds:rank===3?2:0});if(rank===3&&(u.attackCount+1)%3===0)u.skillPoseUntil=this.time+.6;}
        else if(u.kind==='sakiri'){if(this.attackDistance(target,u)>d.range)continue;const enemy=ENEMIES[target.kind],swallow=(enemy.swallowable||rank===3&&enemy.rank==='armored'&&target.armor<=0)&&!enemy.boss&&!(target.energyShield>0||target.orderShield>0)&&(enemy.rank!=='elite'&&!target.miniboss||target.hp<=target.maxHp*.4);if(swallow){this.effects.push({kind:'gulp',enemy:target.kind,lane:target.lane,sourceLane:u.lane,x:target.x,mouthX:u.x+.64,ttl:.5,total:.5});this.kill(target,true);u.digest=[0,12,9,7][rank];}else{this.damageEnemy(target,200,{...opts,bypass:true,impact:'bite'});u.digest=rank===3?4:6;}}
        else if(u.kind==='daffodil'){if(this.attackDistance(target,u)>d.range)continue;u.duelStacks=u.duelTarget===target.id?Math.min(6,(u.duelStacks||0)+1):1;u.duelTarget=target.id;u.duelLastHit=this.time;this.damageEnemy(target,ENEMIES[target.kind].boss?126:84,{...opts,shred:[0,60,90,120][rank],impact:'slash'});if(rank===3&&(u.attackCount+1)%3===0){this.damageEnemy(target,220,{...opts,bypass:true,impact:'slash'});for(const e of targets.slice(1))if(Math.abs(e.x-target.x)<1)this.damageEnemy(e,70,{...opts,bypass:true});this.effects.push({kind:'canhong',lane:u.lane,x:target.x,sourceX:u.x,ttl:.9,total:.9});u.skillPoseUntil=this.time+.8;this.emit('linkAttack');}}
        else if(u.kind==='nanally'){u.streak=u.target===target.id?(u.streak||0)+1:1;u.target=target.id;for(let i=0;i<(u.streak>=(rank>1?2:3)?rank===3?3:2:1);i++)this.projectiles.push({kind:'paw',lane:u.lane,sourceLane:u.lane,sourceKind:u.kind,sourceId:u.id,targetId:target.id,x:u.x+.2-i*.22,speed:6.2,damage:d.damage*m,ttl:4,attribute:d.attribute});if(u.streak>=(rank>1?2:3))u.skillPoseUntil=this.time+.4;}
        else if(u.kind==='requiem'){this.projectiles.push({kind:'tomato',lane:u.lane,sourceLane:u.lane,sourceKind:u.kind,sourceId:u.id,x:u.x,startX:u.x,endX:target.x,age:0,duration:.82,ttl:1.5,damage:d.damage*m,damageScale:m*.7,attribute:d.attribute,rank});}
        else if(u.kind==='haiyue'){
          const radius=[0,.9,1.15,1.4][rank];
          const caught=this.enemies.filter(e=>this.targetable(e,u)&&this.attackDistance(e,u)<=d.range&&e.x>=u.x-.35&&(this.inLane(e,u.lane)||Math.abs(e.lane-target.lane)<=1&&Math.abs(e.x-target.x)<=radius));
          if(!caught.length)continue;
          for(const e of caught){const submerged=this.isSubmerged(e);this.damageEnemy(e,d.damage*(submerged?3:1),{...opts,underwater:true,impact:'jellySpray'});if(rank===3&&submerged&&e.hp>0)e.status.slow=this.time+3;}
          this.effects.push({kind:'jellySpray',lane:u.lane,x:u.x,endX:u.x+d.range,splashLane:target.lane,splashX:target.x,radius,ttl:.55,total:.55});
        }
        else if(u.kind==='crimson'){const hot=u.hotUntil>this.time,range=hot?2:1.5;if(this.attackDistance(target,u)>range)continue;u.attackFormUntil=this.time+.7;for(const e of targets.filter(e=>this.attackDistance(e,u)<=range)){this.damageEnemy(e,62*(hot?1.55:1),{...opts,impact:'slash'});if(hot)e.status.burn=this.time+5;}this.effects.push({kind:'crimsonClaw',lane:u.lane,x:u.x,endX:u.x+range,hot,ttl:.6,total:.6});}
        else if(u.kind==='xun')this.damageEnemy(target,d.damage,{...opts,impact:'slash'});
        else if(u.kind==='zero'){if(this.attackDistance(target,u)>3)continue;this.assists.push({kind:'zero',ownerId:u.id,lane:u.lane,x:u.x,rank,remaining:4,next:0});}
        else if(u.kind==='jiuyuan'){for(const e of targets){if(ENEMIES[e.kind].illusion||e.mirrorsUntil>this.time)this.counterFeedback(e,'识破');if(e.mirrorsUntil>this.time)this.revealButterfly(e);e.revealedUntil=this.time+(rank===3?6:4);}this.damageEnemy(target,ENEMIES[target.kind].illusion?180:d.damage,opts);u.skillPoseUntil=this.time+.7;this.effects.push({kind:'reveal',lane:u.lane,x:target.x,ttl:.7,total:.7});}
        else if(u.kind==='blackFeather'){
          this.damageEnemy(target,ENEMIES[target.kind].illusion?180:d.damage,{...opts,bypass:!!ENEMIES[target.kind].illusion,impact:'shadow'});
          this.effects.push({kind:'blackFeatherShot',lane:target.lane,x:target.x,sourceX:u.x,sourceLane:u.lane,sourceId:u.id,targetId:target.id,ttl:.6,total:.6});
          if(rank>1){target.soulMarkUntil=this.time+5;target.soulExplosive=rank===3;u.skillPoseUntil=this.time+.7;}
        }
        else if(u.kind==='chaos'){const shield=(rank>1?target.orderShield||0:0)+(target.energyShield||0);if(shield>0){target.energyShield=0;if(rank>1)target.orderShield=0;this.counterFeedback(target,'破盾');this.damageEnemy(target,90,{...opts,bypass:true,shieldBreak:true});u.skillPoseUntil=this.time+.8;if(rank===3)for(const e of targets.slice(1,3)){e.orderShield=0;e.energyShield=0;this.counterFeedback(e,'破盾');}}else this.damageEnemy(target,d.damage,opts);}
        else if(u.kind==='baicang'){if(this.attackDistance(target,u)>2)continue;this.damageEnemy(target,60,{...opts,impact:'slash'});if(!ENEMIES[target.kind].boss){this.interruptEnemy(target);u.skillPoseUntil=this.time+.5;}else if(rank>1){target.breakMeter+=60;if(rank===3&&(u.attackCount+1)%4===0&&this.skillReady(u)&&!this.isBossControlProtected(target)){target.shot+=2;u.skillPoseUntil=this.time+.7;if(target.windup>0)target.windup=Math.min(target.windup+1,target.windupTotal+2);}}}
        else if(u.kind==='hathor'){if(this.attackDistance(target,u)>1.7)continue;this.damageEnemy(target,48,{...opts,impact:'slash'});}
        else if(u.kind==='lingko')this.damageEnemy(target,d.damage,opts);
        u.attackCount=(u.attackCount||0)+1;u.anim=.7;u.timer=(d.interval||2)/(u.kind==='daffodil'?1+(u.duelStacks||0)*.05:1);this.emit('attack',{kind:u.kind});
        for(const linker of this.units.filter(v=>v.hp>0&&v.kind==='lingko'&&v!==u&&this.linkerFollows(v,u))){
          linker.linkCount=(linker.linkCount||0)+1;
          if(linker.linkCount%3===0){
            linker.skillPoseUntil=this.time+.8;
            const strike=(victim,damage,extra={},secondary=false)=>{
              this.damageEnemy(victim,damage,this.rankOptions(linker,extra));
              this.effects.push({kind:'link',lane:victim.lane,x:victim.x,sourceX:linker.x,sourceLane:linker.lane,sourceId:linker.id,targetId:victim.id,allyId:u.id,rank:linker.rank||1,secondary,ttl:.8,total:.8});
            };
            strike(target,26,{linkAttack:true,shred:[0,0,75,110][linker.rank||1]});
            if(linker.rank===3&&targets[1])strike(targets[1],24,{linkAttack:true,shred:110},true);
          }
        }
      }
    }
    updateProjectiles(dt){const cans=this.projectiles.filter(p=>p.kind==='can');super.updateProjectiles(dt);this.projectiles=this.projectiles.filter(p=>p.ttl>0);if(this.convertedFlames?.length){this.projectiles.push(...this.convertedFlames);this.convertedFlames=[];}for(const p of cans)if(p.ttl<=0&&p.x>=0&&p.x<C){const owner=this.enemies.find(e=>e.hp>0&&e.kind==='boss');if(owner)this.addGround(owner,'crumbs',[{lane:p.lane,col:Math.floor(p.x)}],8);}for(const s of this.structures){s.timer-=dt;if(s.timer<=0){s.timer=1;for(const e of this.enemies)if(e.hp>0&&!e.controlCat&&!ENEMIES[e.kind].air&&e.lane===s.lane&&Math.abs(e.x-s.x)<1)this.damageEnemy(e,32,{bypass:true,attribute:'dark',sourceLane:s.lane,sourceKind:'requiem',sourceId:s.sourceId});}}
      for(const a of this.assists){a.next-=dt;if(a.next<=0&&a.remaining>0){const owner=this.units.find(u=>u.id===a.ownerId&&u.hp>0);if(!owner){a.remaining=0;continue;}const targets=this.enemies.filter(e=>this.targetable(e,owner)&&Math.abs(e.lane-owner.lane)<=(a.rank>1?1:0)&&this.attackDistance(e,owner)<=3).sort((x,y)=>x.x-y.x).slice(0,4);if(a.remaining<4)owner.skillPoseUntil=this.time+.3;for(const e of targets)this.damageEnemy(e,38*(a.remaining===1&&a.rank===3?1.5:1),this.rankOptions(owner,{impact:'slash'}));a.remaining--;a.next=.32;}}
      this.structures=this.structures.filter(s=>s.until>this.time);this.assists=this.assists.filter(a=>a.remaining>0);
    }
    interruptEnemy(e){
      if(!e||e.hp<=0||ENEMIES[e.kind].boss)return false;
      const cancelled=!!(e.mobCast||e.mobChannel||e.mobFollowUp);
      e.mobCast=e.mobChannel=e.mobFollowUp=null;e.recovery=0;e.attack=2.2;
      e.mobClock=e.eliteClock=8;e.healClock=Math.max(e.healClock||0,8);e.stunUntil=this.time+1.2;
      if(cancelled)this.counterFeedback(e,'打断');return cancelled;
    }
    updateEncounterSkills(dt){
      const boosted=new Map();
      for(const e of this.enemies){
        if(e.hp<=0||!NEW_ENCOUNTERS[e.kind]&&!ELITE_MECHANICS[e.kind])continue;
        if(e.controlCat){e.paintWardActive=false;if(e.mobCast||e.mobChannel||e.mobFollowUp){e.mobCast=e.mobChannel=e.mobFollowUp=null;e.recovery=0;}continue;}
        if(e.entryUntil>this.time||this.isLaneFrozen(e.lane))continue;
        if(e.stunUntil>this.time)continue;
        e.mobClock=Math.max(0,(e.mobClock||0)-dt);
        e.eliteClock=Math.max(0,(e.eliteClock||0)-dt);
        if(e.kind==='bopp'){e.paintWardActive=this.hazards.some(h=>h.kind==='paint'&&h.sourceId===e.id&&(h.at||0)<=this.time&&h.until>this.time&&h.cells.some(c=>c.lane===e.lane&&c.col===Math.floor(e.x)));if(e.paintWardActive&&(e.energyShield||0)<120)e.energyShield=Math.min(120,(e.energyShield||0)+40*dt);}
        if(e.kind==='cursedBlade')e.attack=Math.max(e.attack,e.mobClock+dt+.02);
        if(e.mobChannel){
          const channel=e.mobChannel;
          if(e.status.burn>this.time){e.mobChannel=null;e.recovery=.2;this.feedback('浊燃阻止缠回',e.lane,e.x,'#a7607c');continue;}
          const elapsed=Math.min(dt,channel.remaining);channel.remaining=Math.max(0,channel.remaining-dt);const heal=Math.min(e.maxHp-e.hp,40*elapsed);e.hp+=heal;e.healedUntil=this.time+.2;
          channel.pulse=(channel.pulse||0)-dt;if(heal>0&&channel.pulse<=0){this.encounterPulse(e,'#81af9b');channel.pulse=.6;}
          if(channel.remaining<=0){e.mobChannel=null;e.recovery=.25;}else e.recovery=channel.remaining+dt+.02;
          continue;
        }
        if(e.mobFollowUp){
          const next=e.mobFollowUp;next.wait=Math.max(0,next.wait-dt);
          if(next.wait>0){e.recovery=next.wait+dt+.02;continue;}
          e.mobFollowUp=null;e.mobCast={type:'bladeReturn',label:'回刃追斩',remaining:.7,total:.7,lane:next.lane,x:next.x,area:next.area};e.recovery=.7+dt+.02;this.emit('warning');continue;
        }
        const blocker=this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane===e.lane&&e.x-u.x>=-.12&&e.x-u.x<.75).sort((a,b)=>b.x-a.x)[0];
        if(e.mobCast){
          const cast=e.mobCast;cast.remaining=Math.max(0,cast.remaining-dt);
          if(cast.remaining>0){e.recovery=cast.remaining+dt+.02;continue;}
          e.mobCast=null;e.recovery=.12;e.anim=.5;e.mobSkillUntil=this.time+.55;
          if(cast.type==='blink'){
            const origin=e.x;e.x=cast.destination;e.attack=.5;
            this.effects.push({kind:'umbrellaBlink',lane:e.lane,x:e.x,fromX:origin,ttl:.55,total:.55});
            this.feedback('撑伞瞬移',e.lane,e.x,'#ad5270');
          }else if(cast.type==='punch'){
            for(const u of this.units)if(u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&Math.abs(u.lane-cast.lane)<=1&&Math.abs(u.x-cast.x)<=.78)this.damageUnit(u,e.damage);
            e.attack=Math.max(.1,ENEMIES[e.kind].attackInterval-cast.total);
            this.effects.push({kind:'glovePunch',lane:cast.lane,x:cast.x,ttl:.4,total:.4});
          }else if(cast.type==='paint'){
            this.hazards.push({id:this.nextId++,sourceId:e.id,bossId:null,kind:'paint',cells:cast.cells,at:this.time,until:this.time+3.5});
            e.mobClock=8-cast.total;this.effects.push({kind:'paintSplash',lane:cast.lane,x:cast.x,ttl:.5,total:.5});
          }else if(cast.type==='rush'){
            e.mobRushRemaining=2.5;e.mobClock=10-cast.total;
          }else if(cast.type==='dive'){
            e.mobRushRemaining=2;e.mobRushFactor=1.7;e.mobRushLabel='编队俯冲';e.mobClock=6-cast.total;
          }else if(cast.type==='ward'){
            for(const target of this.enemies)if(target.hp>0&&!target.controlCat&&!ENEMIES[target.kind].boss&&!ENEMIES[target.kind].loot&&!ENEMIES[target.kind].illusion&&target.entryUntil<=this.time&&Math.abs(target.lane-e.lane)<=1&&Math.abs(target.x-e.x)<=2){target.energyShield=Math.max(target.energyShield||0,80);target.shieldHitUntil=this.time+.4;}
            e.mobClock=9-cast.total;this.encounterPulse(e,'#d6b56d');
          }else if(cast.type==='castleWard'){
            e.energyShield=Math.max(e.energyShield||0,180);e.mobClock=12-cast.total;this.encounterPulse(e,'#bd9872');
          }else if(cast.type==='bearRage'){
            e.bearEnraged=true;e.armor=0;e.damage=Math.round(ENEMIES[e.kind].damage*1.35);this.encounterPulse(e,'#ba786b');
          }else if(cast.type==='regrow'){
            if(!(e.status.burn>this.time)){e.mobChannel={label:'缠回回血',remaining:2.4,total:2.4,pulse:0};e.recovery=2.4+dt+.02;}
          }else if(cast.type==='bladeReturn'){
            for(const u of this.encounterVictims(cast.area))this.damageUnit(u,Math.round(e.damage*.7));
            e.attack=Math.max(e.attack,e.mobClock+dt+.02);this.encounterPulse(e,'#a679cb',cast.x,cast.lane);
          }else if(cast.type==='bearPush'){
            for(const u of this.encounterVictims(cast.area).sort((a,b)=>a.col-b.col||a.id-b.id)){this.damageUnit(u,26);if(u.hp>0)this.moveEncounterUnit(u,u.col-1);}
            e.attack=Math.max(e.attack,1);this.encounterPulse(e,'#ba786b',cast.x,cast.lane);
          }else if(cast.type==='pounce'){
            e.x=Math.min(e.x,Math.max(.1,cast.x+.62));
            for(const u of this.encounterVictims(cast.area)){this.damageUnit(u,46);this.applyStatus(u,'antiheal',2);}
            e.mobClock=11-cast.total;e.attack=Math.max(e.attack,1.5);this.encounterPulse(e,'#9a89b4',cast.x,cast.lane);
          }else if(cast.type==='chainSeal'||cast.type==='weave'){
            const kind=cast.type==='chainSeal'?'chains':'web',duration=kind==='chains'?4:5;
            this.hazards.push({id:this.nextId++,sourceId:e.id,bossId:null,kind,cells:cast.cells,at:this.time,until:this.time+duration});
            if(kind==='chains')for(const u of this.units)if(u.hp>0&&!UNITS[u.kind].ground&&cast.cells.some(c=>cell(u,c)))this.applyStatus(u,'seal',.4);
            e.mobClock=(kind==='chains'?10:11)-cast.total;e.attack=Math.max(e.attack,1);this.encounterPulse(e,'#a48abb',cast.x,cast.lane);
          }else if(cast.type==='slash'||cast.type==='scrap'||cast.type==='sonic'||cast.type==='snow'){
            for(const u of this.units)if(u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane>=cast.area.laneMin&&u.lane<=cast.area.laneMax&&u.x>=cast.area.x1&&u.x<=cast.area.x2){
              if(cast.type==='slash')this.damageUnit(u,e.damage);
              else if(cast.type==='scrap')this.damageUnit(u,24);
              else if(cast.type==='snow'){this.damageUnit(u,12);this.applyStatus(u,'sleep',1.5);}
              else this.applyStatus(u,'seal',2);
            }
            const cadence=cast.type==='slash'?3:cast.type==='snow'?8:9;e.mobClock=cadence-cast.total;e.attack=Math.max(e.attack,cast.type==='slash'?cadence-cast.total+dt+.02:1);
            if(cast.type==='slash'&&cast.comboReturn){e.mobFollowUp={wait:.35,lane:cast.lane,x:cast.x,area:{...cast.area}};e.recovery=.35+dt+.02;}
            this.encounterPulse(e,cast.type==='snow'?'#75b9d6':cast.type==='slash'?'#9f7aca':cast.type==='sonic'?'#c5ae62':'#ad899c',cast.x,cast.lane);
          }else if(cast.type==='drag'){
            const u=this.units.find(u=>u.id===cast.targetId&&u.hp>0&&u.lane===cast.lane&&Math.abs(u.x-cast.x)<.4);
            if(u){this.moveEncounterUnit(u,u.col+1);this.damageUnit(u,18);this.applyStatus(u,'seal',2.5);this.effects.push({kind:'encounterTether',lane:e.lane,x:e.x,targetX:u.x,ttl:.55,total:.55});}
            e.mobClock=10-cast.total;e.attack=Math.max(e.attack,1);
          }else if(cast.type==='tide'){
            for(const c of cast.cells)this.terrain[c.lane][c.col].waterUntil=Math.max(this.terrain[c.lane][c.col].waterUntil||0,this.time+4);
            e.mobClock=10-cast.total;this.encounterPulse(e,'#75b9d6');
          }
          continue;
        }
        if(e.mobRushRemaining>0){
          e.mobRushRemaining=Math.max(0,e.mobRushRemaining-dt);
          boosted.set(e,e.speed);e.speed*=e.mobRushFactor||1.8;
        }
        if(e.kind==='rainman'&&!e.blinkUsed&&blocker){
          e.blinkUsed=true;
          e.mobCast={type:'blink',label:'撑伞瞬移',remaining:.6,total:.6,destination:Math.max(.1,blocker.x-.85),lane:e.lane,x:blocker.x};
        }else if(e.kind==='auraGloves'&&blocker&&e.attack<=dt){
          const lane=blocker.lane;
          e.mobCast={type:'punch',label:'范围重拳',remaining:.7,total:.7,lane,x:blocker.x,area:{x1:blocker.x-.78,x2:blocker.x+.78,laneMin:Math.max(0,lane-1),laneMax:Math.min(R-1,lane+1)}};
        }else if(e.kind==='bopp'&&e.mobClock<=0){
          const target=this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane===e.lane&&u.x<=e.x+.15&&e.x-u.x<=3.4).sort((a,b)=>b.x-a.x)[0];
          if(target){const cells=[target.col-1,target.col,target.col+1].filter(col=>col>=0&&col<C).map(col=>({lane:target.lane,col}));
            e.mobCast={type:'paint',label:'涂鸦投掷',remaining:.9,total:.9,lane:target.lane,x:target.x,cells};
          }
        }else if(e.kind==='bandage'&&e.hp<=e.maxHp*.5&&e.mobClock<=0&&!e.mobRushRemaining){
          e.mobCast={type:'rush',label:'松绑追击',remaining:.8,total:.8,lane:e.lane,x:e.x};
        }else if(e.kind==='bandage'&&e.hp<e.maxHp*.65&&e.eliteClock<=0&&!e.mobRushRemaining&&!(e.status.burn>this.time)){
          e.mobCast={type:'regrow',label:'缠回蓄力',remaining:1.1,total:1.1,lane:e.lane,x:e.x};e.eliteClock=14;
        }else if(e.kind==='paperSquadron'&&e.mobClock<=0&&!e.mobRushRemaining){
          e.mobCast={type:'dive',label:'编队俯冲',remaining:.7,total:.7,lane:e.lane,x:e.x};
        }else if(e.kind==='everlight'&&e.mobClock<=0){
          e.mobCast={type:'ward',label:'灯火护持',remaining:1,total:1,lane:e.lane,x:e.x,area:{x1:Math.max(0,e.x-2),x2:Math.min(C,e.x+2),laneMin:Math.max(0,e.lane-1),laneMax:Math.min(R-1,e.lane+1)}};
        }else if(e.kind==='cardboardCastle'&&e.mobClock<=0){
          e.mobCast={type:'castleWard',label:'合拢城门',remaining:1,total:1,lane:e.lane,x:e.x};
        }else if(e.kind==='heroBear'&&!e.bearEnraged&&e.hp<=e.maxHp*.5){
          e.mobCast={type:'bearRage',label:'愤怒重掌',remaining:.9,total:.9,lane:e.lane,x:e.x};
        }else if(e.kind==='heroBear'&&e.bearEnraged&&e.eliteClock<=0&&this.units.some(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane===e.lane&&e.x-u.x>=-.12&&e.x-u.x<=2.5)){
          e.mobCast={type:'bearPush',label:'蓄力震退',remaining:1.2,total:1.2,lane:e.lane,x:e.x,area:{x1:Math.max(0,e.x-2.5),x2:Math.min(C,e.x+.12),laneMin:Math.max(0,e.lane-1),laneMax:Math.min(R-1,e.lane+1)}};e.eliteClock=12;
        }else if(e.kind==='heroBear'&&e.bearEnraged&&blocker&&e.attack<=dt){
          e.mobCast={type:'punch',label:'暴怒拍击',remaining:.7,total:.7,lane:blocker.lane,x:blocker.x,area:{x1:blocker.x-.78,x2:blocker.x+.78,laneMin:Math.max(0,blocker.lane-1),laneMax:Math.min(R-1,blocker.lane+1)}};
        }else if(['cursedBlade','recordSpirit','weatherGirl','trailerOctopus','decomposer'].includes(e.kind)&&e.mobClock<=0){
          const reach=({cursedBlade:2,recordSpirit:3,weatherGirl:2.5,trailerOctopus:2.5,decomposer:2})[e.kind];
          const target=this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane===e.lane&&e.x-u.x>=-.12&&e.x-u.x<=reach).sort((a,b)=>b.x-a.x)[0];
          if(target&&(e.kind!=='decomposer'||e.mobCharge>=120)){
            const type=({cursedBlade:'slash',recordSpirit:'sonic',weatherGirl:'snow',trailerOctopus:'drag',decomposer:'scrap'})[e.kind],total=({slash:.8,sonic:1,snow:.9,drag:1.2,scrap:.8})[type],radius=type==='slash'?.48:type==='scrap'?.75:.6;
            e.mobCast={type,label:({slash:'隔格斩击',sonic:'杂音封技',snow:'雪团催眠',drag:'触腕牵引',scrap:'碎屑反击'})[type],remaining:total,total,lane:target.lane,x:target.x,targetId:target.id,area:{x1:target.x-radius,x2:target.x+radius,laneMin:target.lane,laneMax:target.lane}};
            if(type==='slash'){e.mobSlashCount++;if(e.mobSlashCount%3===0){e.mobCast.comboReturn=true;e.mobCast.label='双斩起手';}}
            if(type==='scrap')e.mobCharge=0;
          }
        }else if(['dreamHound','chainAcolyte','veilDoll'].includes(e.kind)&&e.mobClock<=0){
          const targets=this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane===e.lane&&e.x-u.x>=-.12&&e.x-u.x<=2.5&&(e.kind!=='dreamHound'||u.hp/u.maxHp<.7));
          targets.sort((a,b)=>e.kind==='dreamHound'?a.hp/a.maxHp-b.hp/b.maxHp||b.x-a.x:b.x-a.x);const target=targets[0];
          if(target){const type=e.kind==='dreamHound'?'pounce':e.kind==='chainAcolyte'?'chainSeal':'weave',total=type==='chainSeal'?1.1:1;
            e.mobCast={type,label:({pounce:'梦痕扑咬',chainSeal:'锁页封印',weave:'赤幕织网'})[type],remaining:total,total,lane:target.lane,x:target.x,targetId:target.id};
            if(type==='pounce')e.mobCast.area={x1:target.x-.52,x2:target.x+.52,laneMin:target.lane,laneMax:target.lane};
            else e.mobCast.cells=[target.col,target.col+(type==='chainSeal'?-1:1)].filter(col=>col>=0&&col<C).map(col=>({lane:target.lane,col}));
          }
        }else if(e.kind==='cascadeKoi'&&e.mobClock<=0){
          const col=Math.min(C-1,Math.max(0,Math.floor(e.x))),cells=[col,col-1].filter(c=>c>=0).map(c=>({lane:e.lane,col:c}));
          e.mobCast={type:'tide',label:'潮圈涌动',remaining:1,total:1,lane:e.lane,x:e.x,cells};
        }
        if(e.mobCast){e.recovery=e.mobCast.remaining+dt+.02;this.emit('warning');}
      }
      return boosted;
    }
    encounterVictims(area){return this.units.filter(u=>u.hp>0&&!u.oneShot&&!UNITS[u.kind].ground&&u.lane>=area.laneMin&&u.lane<=area.laneMax&&u.x>=area.x1&&u.x<=area.x2);}
    moveEncounterUnit(u,col){if(col<0||col>=C||this.unitsAt(u.lane,col).some(v=>v.hp>0&&!UNITS[v.kind].ground))return false;u.col=col;u.x=col+.5;this.refreshCombos();return true;}
    encounterPulse(e,color,x=e.x,lane=e.lane){this.effects.push({kind:'encounterPulse',lane,x,color,ttl:.65,total:.65});}
    updateLessonEnemies(dt){
      const lesson=this.chapter?.lesson;if(!lesson)return;
      for(const e of this.enemies.filter(e=>e.hp>0&&!e.lessonUsed&&(lesson.mirrors&&e.kind==='prismMoth'||lesson.fire&&e.kind==='fireRunner'))){
        if(e.entryUntil>this.time||this.isLaneFrozen(e.lane)||e.stunUntil>this.time)continue;
        e.lessonClock=(e.lessonClock??5)-dt;if(e.lessonClock>0)continue;e.lessonUsed=true;
        if(lesson.mirrors){
          e.lessonMirror=true;e.mirrorsUntil=this.time+18;
          const echo=this.spawn('butterflyEcho',e.lane);if(!echo){e.mirrorsUntil=0;continue;}echo.illusionOwner=e.id;echo.x=e.x-.45;echo.entryUntil=0;echo.enter=0;
          this.feedback('蝶影出现 · 识破或清除',e.lane,e.x,'#70baca');
        }else{
          const target=this.units.filter(u=>u.hp>0&&!UNITS[u.kind].ground&&u.lane===e.lane).sort((a,b)=>b.col-a.col)[0],col=target?.col??5;
          const cells=[col,col+1].filter(c=>c<C).map(col=>({lane:e.lane,col}));
          this.addGround(e,'fire',cells,7,2);this.feedback('鬼火灼地 · 2s后生效',e.lane,col+.5,'#c97756');
        }
      }
    }
    updateEnemies(dt){
      this.updateLessonEnemies(dt);
      const loot=this.enemies.filter(e=>ENEMIES[e.kind].loot);this.enemies=this.enemies.filter(e=>!ENEMIES[e.kind].loot);
      const originalSpeeds=new Map(),legacyShots=new Map();
      for(const e of this.enemies){const d=ENEMIES[e.kind];if(d.boss){if(['boss','parcelKing'].includes(e.kind))legacyShots.set(e,e.shot);continue;}if(d.air)continue;const active=this.hazards.filter(h=>(h.at||0)<=this.time&&h.until>this.time&&h.cells.some(c=>c.lane===e.lane&&c.col===Math.floor(e.x)));const multiplier=active.some(h=>h.kind==='crumbs')?.75:active.some(h=>h.kind==='conveyor')?1.4:1;if(multiplier!==1){originalSpeeds.set(e,e.speed);e.speed*=multiplier;}}
      try{this.updateEnemyBodies(dt);}finally{for(const [e,speed] of originalSpeeds)e.speed=speed;this.enemies.push(...loot.filter(e=>e.hp>0));}
      for(const [e,before] of legacyShots)if(e.hp>0&&e.shot>before+1&&e.kind==='parcelKing'){const lanes=[e.lane,(e.lane+2)%R],cells=[];for(const lane of lanes)for(let col=6;col<C;col++)cells.push({lane,col});this.addGround(e,'conveyor',cells,10,3);this.feedback('配送带 · 3s后加速',e.lane,8,'#a78b70');}
    }
updateEnemyBodies(dt){const rear=this.enemies.filter(e=>ENEMIES[e.kind].rear);this.enemies=this.enemies.filter(e=>!ENEMIES[e.kind].rear);const boosted=this.updateEncounterSkills(dt);try{super.updateEnemies(dt);}finally{for(const [e,speed]of boosted)e.speed=speed;}for(const e of rear){if(e.hp<=0)continue;if(e.entryUntil>this.time||this.isLaneFrozen(e.lane)||e.stunUntil>this.time)continue;if(e.controlCat){const target=this.enemies.filter(v=>v.hp>0&&v.lane===e.lane).sort((a,b)=>Math.abs(a.x-e.x)-Math.abs(b.x-e.x))[0];if(target){e.x+=Math.sign(target.x-e.x)*e.speed*dt;if(Math.abs(target.x-e.x)<.7){e.attack-=dt;if(e.attack<=0){this.damageEnemy(target,e.damage);e.attack=1;}}}if(e.reverseUntil<=this.time)e.controlCat=null;continue;}const target=this.units.filter(u=>u.hp>0&&!UNITS[u.kind].ground&&u.lane===e.lane&&u.x>=e.x-.2).sort((a,b)=>a.x-b.x)[0];e.attack-=dt;if(target&&Math.abs(target.x-e.x)<.6){if(e.attack<=0){this.damageUnit(target,e.damage*.8);e.attack=1.4;}}else e.x+=e.speed*(e.status.slow>this.time?.6:1)*dt;if(e.x>C){e.hp=0;this.hearts=Math.max(0,this.hearts-1);if(!this.hearts){this.phase='lost';this.emit('end',{won:false});}}}this.enemies.push(...rear);}
    useItem(id,lane=2,x=5){if(!['running','preparing'].includes(this.phase))return {ok:false,error:'当前不能使用道具'};const randomCard=this.mode==='random'&&this.queue.find(q=>q.id===this.queueSelected&&q.type==='item'&&q.kind===id);if(!randomCard&&(this.inventory[id]||0)<=0)return {ok:false,error:'没有这个道具'};if(id==='cat'&&(this.itemsUsed.cat||0)>=2)return {ok:false,error:'猫猫本局已使用两次'};
      if(id==='cat'){const target=this.enemies.filter(e=>e.hp>0&&!ENEMIES[e.kind].boss&&!ENEMIES[e.kind].air&&!e.controlCat).sort((a,b)=>Math.abs(a.lane-lane)*2+Math.abs(a.x-x)-(Math.abs(b.lane-lane)*2+Math.abs(b.x-x)))[0];if(!target)return {ok:false,error:'没有可反攻的普通或精英敌人'};target.controlCat={kind:'mintCat'};target.reverseUntil=this.time+8;this.effects.push({kind:'catItem',lane:target.lane,x:target.x,ttl:.9,total:.9});this.emit('catControl',{enemy:target.kind});}
      else if(id==='medkit')for(const u of this.units)this.healUnit(u,u.maxHp*.35);
      else if(id==='cleanse')for(const u of this.units)this.cleanseUnit(u,4);
      else if(id==='lamp'){this.lampUntil=this.time+10;for(const e of this.enemies){e.revealedUntil=this.time+10;if(e.mirrorsUntil>this.time)this.revealButterfly(e);}}
      else return {ok:false,error:'不能使用这个道具'};
      if(randomCard)this.consumeQueue();else{this.inventory[id]--;if((this.localItems?.[id]||0)>0)this.localItems[id]--;else this.emit('itemConsumed',{id});}this.itemsUsed[id]=(this.itemsUsed[id]||0)+1;return {ok:true};}
    supply(id){const prices={medkit:125,cleanse:100,lamp:75};if(!prices[id]||this.money<prices[id])return {ok:false,error:'局内方斯不足'};this.money-=prices[id];this.spent+=prices[id];this.inventory[id]=(this.inventory[id]||0)+1;this.localItems=this.localItems||{};this.localItems[id]=(this.localItems[id]||0)+1;return {ok:true};}
    updateQueue(dt){if(this.mode!=='random'||this.queue.length>=6)return;this.queueTimer-=dt;if(this.queueTimer>0)return;const counter=ENVIRONMENTS[this.environment||this.endlessBossAt(this.endlessBlock)]?.counter.filter(k=>this.available.includes(k))||[];let kind;const n=this.queueSerial;if(n%5===0&&counter.length)kind=counter[(n/5|0)%counter.length];else if(n%3===0&&this.randomHistory.length)kind=this.randomHistory.at(-1);else kind=this.available[Math.floor(this.random()*this.available.length)];const item=n%11===0?['medkit','cleanse','lamp','cat'][Math.floor(this.random()*4)]:null;if(item&&!(item==='cat'&&(this.itemsUsed.cat||0)>=2))this.queue.push({id:this.queueSerial++,type:'item',kind:item});else{this.queue.push({id:this.queueSerial++,type:'unit',kind});this.randomHistory.push(kind);this.randomHistory=this.randomHistory.slice(-6);}this.queueTimer=4+this.random()*2;this.emit('queue');}
    swapFormation(index,kind){if(this.phase!=='preparing'||this.formationSwaps<=0)return {ok:false,error:'换卡只在首领战前的战备阶段开放'};if(!Number.isInteger(index)||index<0||index>=this.deck.length||this.changedSlots.includes(index))return {ok:false,error:'请选择尚未更换的出战位'};if(!this.available.includes(kind)||this.deck.includes(kind))return {ok:false,error:'请选择已招募且未出战的角色'};const old=this.deck[index];this.deck[index]=kind;this.changedSlots.push(index);this.formationSwaps--;this.emit('formationSwap',{index,old,kind});return {ok:true};}
    rerollQueue(id,kind){if(this.mode!=='random'||this.phase!=='preparing'||this.formationSwaps<=0||!this.available.includes(kind))return {ok:false,error:'请选择已招募角色'};const q=this.queue.find(v=>v.id===id);if(!q||q.changed)return {ok:false,error:'请选择尚未更换的传送卡'};q.kind=kind;q.type='unit';q.changed=true;this.formationSwaps--;return {ok:true};}
    nextEncounter(){if(this.phase!=='preparing')return false;this.phase='running';this.formationSwaps=0;this.beginWave();this.emit('resume');return true;}
    cashOut(){if(!this.endless||!['running','paused','preparing'].includes(this.phase))return false;this.phase='cashed';this.emit('end',{won:true,cashout:true});return true;}
    tick(dt){dt=Math.min(.1,Math.max(0,dt));this.stepDt=dt;if(this.phase==='preparing'){for(const k of ORDER)this.cooldowns[k]=Math.max(0,(this.cooldowns[k]||0)-dt);return;}if(this.phase!=='running')return;
      this.inEnvironmentalDamage=true;try{if(this.environment==='morpheus'&&this.time-this.environmentStarted>=1.8)for(const u of this.units)if(u.hp>0&&!UNITS[u.kind].ground)this.damageUnit(u,u.maxHp*.0025*dt,{environment:true});for(const u of this.units){if(u.burnUntil>this.time)this.damageUnit(u,(2+(u.burnStacks||1)*1.5)*dt,{environment:true});else u.burnStacks=0;if(u.regenUntil>this.time)this.healUnit(u,8*dt);}}finally{this.inEnvironmentalDamage=false;}
      // The inherited hazard loop also passes through the environment mitigation path.
      const pendingGround=this.hazards.filter(h=>(h.at||0)>this.time);this.hazards=this.hazards.filter(h=>(h.at||0)<=this.time);this.inEnvironmentalDamage=true;const originalAttack=this.attackUnits;this.attackUnits=function(step){this.inEnvironmentalDamage=false;return originalAttack.call(this,step);};try{const heldTimer=this.bossWave&&this.enemies.filter(e=>e.hp>0&&!ENEMIES[e.kind].boss).length>=api.BOSS_CADENCE.minionLimit?this.spawnTimer:null;if(heldTimer!==null)this.spawnTimer=Infinity;try{super.tick(dt);}finally{if(heldTimer!==null)this.spawnTimer=Math.max(.8,heldTimer);}}finally{this.attackUnits=originalAttack;this.inEnvironmentalDamage=false;this.hazards.push(...pendingGround.filter(h=>h.until>this.time));}
      if(this.phase!=='running')return;this.updateQueue(dt);
      for(const u of this.units){if(u.resistUntil>this.time){u.sleepUntil=u.confusedUntil=u.sealedUntil=u.antihealUntil=0;}const nearby=this.hazards.filter(h=>(h.at||0)<=this.time&&h.until>this.time&&h.cells.some(c=>cell(u,c)));if(!(u.resistUntil>this.time)){if(nearby.some(h=>h.kind==='chains'))u.sealedUntil=Math.max(u.sealedUntil||0,this.time+.4);if(!(u.antihealResistUntil>this.time)&&!this.protectedEnvironment(u,3)&&nearby.some(h=>['cracked','silence'].includes(h.kind)))u.antihealUntil=Math.max(u.antihealUntil||0,this.time+.4);}}
      if(this.environment==='morpheus'){this.raidClock=(this.raidClock??12)-dt;if(this.raidClock<=0&&this.enemies.filter(e=>e.kind==='rearHound').length<2){const lane=Math.floor(this.random()*R);this.raidWarnings.push({lane,x:.6,at:this.time+3});this.raidClock=26;this.feedback('后门突袭 · 3s',lane,.7,'#ab8ac4');}}
      for(const w of this.raidWarnings)if(w.at<=this.time&&!w.done){w.done=true;this.spawn('rearHound',w.lane);}this.raidWarnings=this.raidWarnings.filter(w=>!w.done);
      if(this.endless&&this.bossWave&&!this.spawns.length&&!this.enemies.length){this.runsBossCleared++;this.bossWave=false;this.raidWarnings=[];this.environment=null;this.environmentLeaving=null;this.hazards=[];}
    }
  }
  Object.assign(api,{Game,ENDLESS_DUO_PLANS,STORE,ENVIRONMENTS,BOSS_COUNTER_GUIDANCE,bossCounterReadiness,NEW_ENCOUNTERS,ELITE_MECHANICS,ELITE_COUNTERS,eliteRecommendedDeck,MIDDLE_ENCOUNTERS,ELITE_LESSONS,UPGRADE_RULES,RANK_DAMAGE,RANK_HEALTH,unitHealth,normalizeMeta,buy,settle,unlockedRoster,normalizeProgress,migrateProgress,completeCampaign,RECRUITMENT_SEQUENCE,RECRUIT_LESSONS,NEW_HERO_KEYS:Object.keys(NEW_UNITS),VERSION:3});root.EibonTD=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
