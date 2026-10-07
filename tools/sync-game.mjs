import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const source=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Usage: node tools/sync-game.mjs /path/to/eibon-tower-defense');
const dest=path.resolve('game');
if(source===dest)throw Error('Source must differ from export');
const html=await fs.readFile(path.join(source,'play.html'),'utf8');
const files=new Set(['play.html','favicon-v02.ico']);
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
const styles=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
for(const f of [...scripts,...styles])files.add(f);
const context={console};context.window=context;vm.createContext(context);
for(const file of scripts.filter(f=>/^(engine|expansion|evolution|atlas|v2-atlas|expansion-atlas|encounter-atlas)\.js$/.test(f)||f.startsWith('audio/')))vm.runInContext(await fs.readFile(path.join(source,file),'utf8'),context);
const add=value=>{value=value.replace(/^\/eibon-tower-defense\//,'').split('?')[0];if(!value.includes('${')&&!value.includes('..')&&!value.endsWith('/')&&/\.[a-z0-9]+$/i.test(value))files.add(value);};
for(const file of ['play.html',...scripts.filter(f=>!f.startsWith('audio/')),...styles]){
  const text=await fs.readFile(path.join(source,file),'utf8');
  for(const m of text.matchAll(/["'`]((?:\/eibon-tower-defense\/)?(?:assets|audio)\/[^"'`\r\n]+)["'`]/g))add(m[1]);
  for(const m of text.matchAll(/url\(\s*["']?([^\)"']+)/g))add(m[1]);
}
for(const sheet of Object.keys(context.ATLAS_META))add('assets/'+(sheet==='street'?'street-v06':sheet)+'.png');
for(const sheet of context.EIBON_V3_ENVIRONMENT_ASSETS||[])add('assets/'+sheet+'.png');
for(const kind of context.EibonTD.ORDER){const newer=context.EibonTD.NEW_HERO_KEYS?.includes(kind);add('assets/'+(newer?'pop-ui-v2':'atrium-v1')+'/avatars/'+kind+'.png');add('assets/'+(newer?'pop-ui-v2':'pop-ui-v1')+'/portraits/'+kind+'.png');}
for(const id of Object.keys(context.EibonTD.STORE||{}))add('assets/pop-ui-v2/shop-'+id+'.png');
for(const name of ['boss-impact-fx-v01','boss-ground-fx-v02','boss-falling-fx-v01','terrain-water-fire-v01','boss-debuff-terrain-v01','sea-surface-v02','tsunami-front-v02','atrium-v1/battle-shop','flower-fx-v01','fons-ticket','atrium-v1/menu-wallpaper'])add('assets/'+name+'.png');
for(const folder of ['assets/ui-icons','assets/attributes'])for(const name of await fs.readdir(path.join(source,folder)))add(folder+'/'+name);
for(const name of await fs.readdir(path.join(source,'assets')))if(/OFL|LICENSE/i.test(name))add('assets/'+name);
for(const manifest of ['EIBON_AUDIO_MANIFEST','EIBON_MUSIC','EIBON_BOSS_MUSIC','EIBON_SFX'])for(const value of Object.values(context[manifest]||{}))if(value)add(value);
await fs.mkdir(dest,{recursive:true});
const hashes=[];
for(const file of [...files].sort()){
  if(file.includes('/qa/')||file.includes('/references/'))throw Error('Non-runtime asset '+file);
  let data=await fs.readFile(path.join(source,file));
  if(/\.(js|css|html)$/.test(file))data=Buffer.from(data.toString().replaceAll('/eibon-tower-defense/',''));
  if(file==='play.html')data=Buffer.from(data.toString().replace(/<a\b[^>]*data-site-return=[\s\S]*?<\/a>/g,'').replace('NTE FAN GAME','NTE FAN GAME · v3.0').replace('</head>','<script src="host.js"></script>\n</head>'));
  const target=path.join(dest,file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,data);
  hashes.push({path:file,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
await fs.writeFile(path.join(dest,'host.js'),`/* Offline app lifecycle shared by Windows and Android. */
window.EibonHost={setPaused(value){if(value)document.dispatchEvent(new Event('eibon-host-pause'));}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.EibonHost.setPaused(true);});
`);
let game=await fs.readFile(path.join(dest,'game.js'),'utf8');
game=game.replace('  function animate(now){',`  document.addEventListener('eibon-host-pause',()=>{cancelDrag();if(game.phase==='running')game.pause();stopVoice();music?.pause();for(const track of fadingMusic)track.pause();menuVideo.pause();updateHUD();});\n  function animate(now){`);
await fs.writeFile(path.join(dest,'game.js'),game);
for(const f of hashes){const data=await fs.readFile(path.join(dest,f.path));f.bytes=data.length;f.sha256=createHash('sha256').update(data).digest('hex');}
const host=await fs.readFile(path.join(dest,'host.js'));hashes.push({path:'host.js',bytes:host.length,sha256:createHash('sha256').update(host).digest('hex')});
await fs.writeFile('runtime-manifest.json',JSON.stringify({version:'3.0.0',revision:'20261007-combat-ui13',files:hashes,totalBytes:hashes.reduce((n,f)=>n+f.bytes,0)},null,2)+'\n');
console.log(JSON.stringify({files:hashes.length,megabytes:Math.round(hashes.reduce((n,f)=>n+f.bytes,0)/1048576)}));
