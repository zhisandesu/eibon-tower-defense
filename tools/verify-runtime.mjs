import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]||'game'),manifest=JSON.parse(await fs.readFile('runtime-manifest.json','utf8'));
const context={};context.window=context;vm.createContext(context);
for(const name of ['engine','expansion','evolution','atlas','expansion-atlas','v2-atlas','encounter-atlas'])vm.runInContext(await fs.readFile(path.join(root,name+'.js'),'utf8'),context);
const A=context.EibonTD;
for(const f of manifest.files){const data=await fs.readFile(path.join(root,f.path));assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256,f.path);assert(!/(qa|references|prompts)\//.test(f.path));}
for(const id of Object.keys(A.STORE))await fs.access(path.join(root,'assets/pop-ui-v2/shop-'+id+'.png'));
const game=new A.Game({mode:'sandbox',demo:true,deck:[],seed:17});game.start();game.spawns=[];game.money=9999;const boss=game.spawn('whale',2);boss.entryUntil=0;
game.deck.push('mint');const unit=game.place('mint',0,6).unit;game.random=()=>0;for(const row of game.terrain)for(const tile of row)tile.waterUntil=0;const before=unit.hp;game.chargeBoss(boss);game.releaseBoss(boss);assert(unit.hp<before);
assert.equal(A.CAMPAIGN.length,33);assert.equal(A.ORDER.length,22);assert.equal(A.BOSS_CADENCE.normal,1.8);assert.equal(A.WHALE_WATER_SECONDS,10);
console.log(JSON.stringify({passed:true,version:manifest.version,files:manifest.files.length,heroes:A.ORDER.length,stages:A.CAMPAIGN.length,bosses:Object.values(A.ENEMIES).filter(d=>d.boss).length,surgeDamage:before-unit.hp}));
