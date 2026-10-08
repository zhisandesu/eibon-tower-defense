import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inflateRawSync,crc32} from 'node:zlib';
import {createHash} from 'node:crypto';
import {androidAsset} from './android-assets.mjs';

// Check the signed APK itself: zipalign alone ignores compressed entries,
// including the Android 11+ resource-table installation requirement.
export async function verifyApk(apk,manifestPath='runtime-manifest.json') {
  const data=await fs.readFile(apk),entries=new Map();
  let end=-1;
  for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--) {
    if(data.readUInt32LE(i)===0x06054b50&&i+22+data.readUInt16LE(i+20)===data.length){end=i;break;}
  }
  if(end<0)throw Error('APK ZIP end record not found');
  const count=data.readUInt16LE(end+10);
  let position=data.readUInt32LE(end+16);
  for(let i=0;i<count;i++) {
    if(data.readUInt32LE(position)!==0x02014b50)throw Error('Invalid ZIP directory');
    const method=data.readUInt16LE(position+10),crc=data.readUInt32LE(position+16);
    const size=data.readUInt32LE(position+20),rawSize=data.readUInt32LE(position+24);
    const nameLength=data.readUInt16LE(position+28),extraLength=data.readUInt16LE(position+30),commentLength=data.readUInt16LE(position+32);
    const local=data.readUInt32LE(position+42),name=data.toString('utf8',position+46,position+46+nameLength);
    if(name.includes('\\')||name.split('/').includes('..')||name.startsWith('/')||entries.has(name))throw Error(`Invalid APK path: ${name}`);
    if(data.readUInt32LE(local)!==0x04034b50||data.readUInt16LE(local+8)!==method)throw Error(`Invalid local header: ${name}`);
    const offset=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28);
    if(data.toString('utf8',local+30,local+30+data.readUInt16LE(local+26))!==name)throw Error(`Mismatched local name: ${name}`);
    if(method!==0&&method!==8)throw Error(`Unsupported APK compression: ${name}`);
    if(offset+size>data.length)throw Error(`Truncated entry: ${name}`);
    if(method===0&&offset%4!==0)throw Error(`Unaligned stored entry: ${name}`);
    const compressed=data.subarray(offset,offset+size),raw=method===0?compressed:inflateRawSync(compressed);
    if(raw.length!==rawSize||crc32(raw)!==crc)throw Error(`Corrupt APK entry: ${name}`);
    entries.set(name,{method,offset,sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length});
    position+=46+nameLength+extraLength+commentLength;
  }
  const resource=entries.get('resources.arsc');
  if(!resource||resource.method!==0||resource.offset%4!==0)throw Error('Android 11+ requires STORED resources.arsc aligned to 4 bytes');
  if(!entries.has('AndroidManifest.xml')||!entries.has('classes.dex'))throw Error('Missing Android manifest or DEX');
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  let adaptedFiles=0;
  for(const file of manifest.files) {
    const entry=entries.get(`assets/game/${file.path}`);
    let expected=file;
    if(/\.(js|css)$/.test(file.path)) {
      const source=await fs.readFile(path.join(path.dirname(manifestPath),'game',file.path));
      if(createHash('sha256').update(source).digest('hex')!==file.sha256)throw Error(`Unverified game source: ${file.path}`);
      const adapted=await androidAsset(file.path,source);
      expected={sha256:createHash('sha256').update(adapted).digest('hex'),bytes:adapted.length};adaptedFiles++;
    }
    if(!entry||entry.sha256!==expected.sha256||entry.bytes!==expected.bytes)throw Error(`APK runtime mismatch: ${file.path}`);
  }
  const runtimeCount=[...entries.keys()].filter(name=>name.startsWith('assets/game/')&&!name.endsWith('/')).length;
  if(runtimeCount!==manifest.files.length)throw Error('Unexpected APK runtime files');
  return {apk,entries:count,runtimeFiles:runtimeCount,adaptedFiles,webViewTarget:'Chromium 80+',resourceTable:{compression:'STORED',offset:resource.offset,aligned:true},sha256:createHash('sha256').update(data).digest('hex')};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(!process.argv[2])throw Error('Usage: node tools/verify-android.mjs path/to/game.apk');
  console.log(JSON.stringify(await verifyApk(process.argv[2]),null,2));
}
