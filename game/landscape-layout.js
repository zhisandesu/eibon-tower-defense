/* Full-window horizontal composition, without portrait layout breakpoints. */
(() => {
  'use strict';
  const height = 941;
  const fit = () => {
    const scale = window.innerHeight / height;
    document.documentElement.style.setProperty('--game-width', window.innerWidth / scale + 'px');
    document.documentElement.style.setProperty('--game-scale', String(scale));
  };
  window.EibonLayout = {
    height,
    point(clientX, clientY) {
      const bounds = document.body.getBoundingClientRect();
      return {x: (clientX - bounds.left) * document.body.clientWidth / bounds.width,
        y: (clientY - bounds.top) * height / bounds.height};
    }
  };
  window.addEventListener('resize', fit);
  fit();
})();
