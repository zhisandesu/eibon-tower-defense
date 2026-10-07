/* Offline app lifecycle shared by Windows and Android. */
window.EibonHost={setPaused(value){if(value)document.dispatchEvent(new Event('eibon-host-pause'));}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.EibonHost.setPaused(true);});
