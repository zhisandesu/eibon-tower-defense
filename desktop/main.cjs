const {app,BrowserWindow,protocol,net,Menu}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
protocol.registerSchemesAsPrivileged([{scheme:'eibon',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
const smoke=process.argv.includes('--smoke-test');
const wallpaperArg=process.argv.indexOf('--wallpaper-path');
const wallpaperPath=wallpaperArg>=0&&smoke?process.argv[wallpaperArg+1]:null;
let win;
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
app.whenReady().then(async()=>{
  const root=path.resolve(__dirname,'../game');
  protocol.handle('eibon',request=>{
    const url=new URL(request.url);
    if(url.hostname!=='game')return new Response('Not found',{status:404});
    let relative;try{relative=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400});}
    const file=path.resolve(root,'.'+relative);
    if(file!==root&&!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
    return net.fetch(pathToFileURL(file===root?path.join(root,'play.html'):file).href);
  });
  Menu.setApplicationMenu(null);
  win=new BrowserWindow({title:'异象大战伊波恩',width:1440,height:900,minWidth:960,minHeight:540,backgroundColor:'#211c2c',icon:path.join(root,'assets/game-icon-v02-180.png'),show:!smoke,autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('eibon://game/'))event.preventDefault();});
  win.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'){event.preventDefault();win.setFullScreen(!win.isFullScreen());}});
  const pause=()=>win?.webContents.executeJavaScript('window.EibonHost?.setPaused(true)').catch(()=>{});
  win.on('minimize',pause);win.on('blur',pause);
  app.on('browser-window-created',(_,window)=>window.webContents.on('will-attach-webview',event=>event.preventDefault()));
  const errors=[];win.webContents.on('console-message',(_event,...args)=>{const details=args[0];if(details&&typeof details==='object'&&details.level==='error')errors.push(details.message);});
  win.webContents.on('render-process-gone',(_event,details)=>{console.error(details.reason);if(smoke)app.exit(1);});
  if(wallpaperPath)await win.loadFile(path.join(path.resolve(wallpaperPath),'index.html'));
  else await win.loadURL('eibon://game/play.html');
  if(smoke){
    const deadline=Date.now()+90000;let state;
    do{state=await win.webContents.executeJavaScript('({ready:!!window.eibonDebug?.snapshot().assetsReady,loading:document.body.hasAttribute("data-eibon-loading"),label:document.querySelector("#eibon-loading-label")?.textContent,video:document.querySelector("#menu-video")?.readyState,heroes:window.EibonTD?.ORDER.length,stages:window.EibonTD?.CAMPAIGN.length,bosses:window.EibonTD?.BOSS_ORDER.length,host:!!window.EibonHost})');if(state.ready&&!state.loading)break;await new Promise(r=>setTimeout(r,250));}while(Date.now()<deadline);
    const report={passed:!!state.ready&&!state.loading,platform:process.platform,packaged:app.isPackaged,version:app.getVersion(),wallpaper:!!wallpaperPath,state,errors};
    const output=process.env.EIBON_QA_DIR;if(output){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,wallpaperPath?'wallpaper-smoke.json':'windows-smoke.json'),JSON.stringify(report,null,2));}
    console.log(JSON.stringify(report));app.exit(report.passed?0:1);
  }
}).catch(error=>{console.error(error);app.exit(1)});
app.on('window-all-closed',()=>app.quit());
}
