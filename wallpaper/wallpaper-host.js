// Loaded before the game so Wallpaper Engine can deliver settings during startup.
window.EibonWallpaper={paused:false,fps:60,onPause:null,inputVersion:'3.0.0'};
window.wallpaperPropertyListener={
 setPaused(value){const state=window.EibonWallpaper;const paused=!!value;if(state.paused===paused)return;state.paused=paused;state.onPause?.(paused);},
 applyGeneralProperties(properties){const fps=Number(properties.fps);if(Number.isFinite(fps)&&fps>0)window.EibonWallpaper.fps=Math.max(1,Math.min(60,fps));}
};
// Native select rendering crashes in the installed Wallpaper Engine CEF build.
// Retain the hidden value control for game logic and use ordinary HTML buttons.
document.addEventListener('DOMContentLoaded',()=>{
 const select=document.querySelector('#boss-choice'),wrap=select.parentElement;
 const toggle=document.createElement('button'),list=document.createElement('div');
 toggle.type='button';toggle.id='wallpaper-boss-toggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','wallpaper-boss-options');
 list.id='wallpaper-boss-options';list.hidden=true;list.setAttribute('role','group');list.setAttribute('aria-label','试验首领');
 const close=()=>{list.hidden=true;toggle.setAttribute('aria-expanded','false');};
 const sync=()=>{toggle.textContent=(select.selectedOptions[0]?.textContent||'日常波次')+' ▾';for(const b of list.children)b.setAttribute('aria-pressed',String(b.dataset.value===select.value));};
 for(const option of select.options){const b=document.createElement('button');b.type='button';b.textContent=option.textContent;b.dataset.value=option.value;b.onclick=()=>{select.value=option.value;close();sync();select.dispatchEvent(new Event('change',{bubbles:true}));toggle.focus();};list.append(b);}
 toggle.onclick=()=>{sync();list.hidden=!list.hidden;toggle.setAttribute('aria-expanded',String(!list.hidden));};
 wrap.querySelector('label').htmlFor=toggle.id;wrap.append(toggle,list);window.EibonWallpaper.syncBossChoice=sync;sync();
 document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
});
