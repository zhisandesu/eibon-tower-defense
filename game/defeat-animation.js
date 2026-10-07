/* Generated raster frames; one grounded, constant-scale performance. */
(() => {
  'use strict';
  const canvas=document.querySelector('#result-defeat');
  if(!canvas)return;
  const context=canvas.getContext('2d'),image=new Image();
  image.src='assets/atrium-v1/result-defeat-mint-v1.png';
  const frames=[
    {x:29,y:30,w:404,h:421},{x:466,y:34,w:410,h:417},
    {x:900,y:51,w:416,h:399},{x:1338,y:68,w:412,h:381},
    {x:24,y:487,w:417,h:379},{x:462,y:460,w:415,h:406},
    {x:897,y:465,w:417,h:401},{x:1335,y:467,w:415,h:399}
  ];
  const durations=[260,160,180,300,500,180,200,620],duration=durations.reduce((a,b)=>a+b,0);
  const ready=image.decode();ready.catch(()=>{});
  let request=0,generation=0;
  function stop(){generation++;cancelAnimationFrame(request);request=0;}
  function draw(index){
    const f=frames[index],scale=canvas.height*.83/421;
    context.clearRect(0,0,canvas.width,canvas.height);
    context.drawImage(image,f.x,f.y,f.w,f.h,(canvas.width-f.w*scale)/2,canvas.height*.94-f.h*scale,f.w*scale,f.h*scale);
    canvas.dataset.frame=String(index);canvas.dataset.ready='true';
  }
  function play(reducedMotion=false){
    stop();const current=generation;
    ready.then(()=>{
      if(current!==generation||canvas.hidden||document.querySelector('#result').hidden)return;
      const start=performance.now();let previous=-1;
      function update(now){
        if(current!==generation||canvas.hidden||document.querySelector('#result').hidden){request=0;return;}
        if(reducedMotion||document.body.classList.contains('reduce-motion')){draw(3);request=0;return;}
        let remaining=(now-start)%duration,index=0;
        while(index<durations.length-1&&remaining>=durations[index])remaining-=durations[index++];
        if(index!==previous){draw(index);previous=index;}
        request=requestAnimationFrame(update);
      }
      update(start);
    }).catch(()=>{
      canvas.hidden=true;
      const fallback=document.querySelector('#result-crew');
      fallback.src='assets/atrium-v1/avatars/mint.png';fallback.hidden=false;
    });
  }
  window.EibonDefeatAnimation={play,stop};
})();
