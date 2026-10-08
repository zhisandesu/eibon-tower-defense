import {transform} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

const polyfills=`
// APIs missing from the Android 11 system WebView (Chromium 83).
(function () {
  if(!CanvasRenderingContext2D.prototype.roundRect) Object.defineProperty(CanvasRenderingContext2D.prototype,'roundRect',{configurable:true,writable:true,value:function(x,y,w,h,r) {
    if(w<0){x+=w;w=-w;}if(h<0){y+=h;h=-h;}
    r=Math.max(0,Math.min(Number(r)||0,w/2,h/2));
    this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);this.arcTo(x+w,y+h,x,y+h,r);
    this.arcTo(x,y+h,x,y,r);this.arcTo(x,y,x+w,y,r);this.closePath();
  }});
  if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', {configurable:true,writable:true,value:function(index) {
    index=Number(index)||0;index=index<0?Math.ceil(index):Math.floor(index);
    if(index<0)index+=this.length;return this[index];
  }});
  [Element.prototype,Document.prototype,DocumentFragment.prototype].forEach(function(proto) {
    if(!proto.replaceChildren) Object.defineProperty(proto,'replaceChildren',{configurable:true,writable:true,value:function() {
      var fragment=document.createDocumentFragment();
      for(var i=0;i<arguments.length;i++)fragment.appendChild(arguments[i] instanceof Node?arguments[i]:document.createTextNode(String(arguments[i])));
      while(this.firstChild)this.removeChild(this.firstChild);this.appendChild(fragment);
    }});
  });
  document.documentElement.style.setProperty('--eibon-cqw','calc(var(--game-width,1672px) * .01)');
  document.documentElement.style.setProperty('--eibon-cqh','9.41px');
  if(!CSS.supports('aspect-ratio: 1')) {
    var scheduled=false;
    function scheduleCards() {
      if(scheduled)return;scheduled=true;
      requestAnimationFrame(function() {
        scheduled=false;
        document.querySelectorAll('#deck-picker .deck-card, #deck-picker .deck-slot').forEach(function(card) {
          if(card.clientWidth)card.style.height=(card.clientWidth*(card.classList.contains('deck-card')?1499/1048:1/.85))+'px';
        });
      });
    }
    document.addEventListener('DOMContentLoaded',scheduleCards);
    window.addEventListener('resize',scheduleCards);
    new MutationObserver(scheduleCards).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  }
})();
`;

// Keep game/ identical to the 3.0 source snapshot; compatibility changes apply
// only to the assets packaged for Android, with their own verified hashes.
export async function androidAsset(name,data) {
  if(!/\.(js|css)$/.test(name))return data;
  const loader=name.endsWith('.css')?'css':'js';
  let source=data.toString('utf8');
  if(name==='host.js')source=polyfills+'\n'+source;
  let {code}=await transform(source,{loader,target:'chrome80',sourcefile:name,legalComments:'inline',charset:'utf8'});
  if(loader==='css') {
    // Preserve native container units on recent WebViews; older ones take the
    // preceding fallback based on the game's existing 941px horizontal canvas.
    code=code.replace(/(^[ \t]*[\w-]+:[^;{}]*\b\d*\.?\d+cq[wh][^;{}]*;)/gm,declaration=> {
      const fallback=declaration.replace(/(-?\d*\.?\d+)cqw/g,'calc($1 * var(--eibon-cqw))').replace(/(-?\d*\.?\d+)cqh/g,'calc($1 * var(--eibon-cqh))');
      // Custom properties accept unknown units even on old WebViews, so an
      // unsupported original would override the fallback and collapse cards.
      return declaration.trimStart().startsWith('--')?fallback:fallback+'\n'+declaration;
    });
  }
  return Buffer.from(code);
}

export async function adaptAndroidAssets(directory) {
  async function walk(folder,prefix='') {
    for(const entry of await fs.readdir(folder,{withFileTypes:true})) {
      const name=prefix+entry.name,file=path.join(folder,entry.name);
      if(entry.isDirectory())await walk(file,name+'/');
      else if(/\.(js|css)$/.test(name))await fs.writeFile(file,await androidAsset(name,await fs.readFile(file)));
    }
  }
  await walk(directory);
}
