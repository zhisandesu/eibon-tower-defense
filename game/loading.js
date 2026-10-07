(() => {
  'use strict';
  const overlay = document.querySelector('#eibon-loading');
  const bar = document.querySelector('#eibon-loading-progress');
  const percent = document.querySelector('#eibon-loading-percent');
  const label = document.querySelector('#eibon-loading-label');
  const retry = document.querySelector('#eibon-loading-retry');
  let imageFraction = 0, videoFraction = 0, gameReady = false, videoReady = false, failed = false, finished = false;
  let movieUrl;
  const controller = new AbortController();
  const timeout = setTimeout(() => fail('加载时间较长，请检查网络后重试。'), 180000);
  function render() {
    if (failed || finished) return;
    const value = Math.floor(imageFraction * 28 + videoFraction * 70 + (gameReady && videoReady ? 2 : 0));
    bar.value = value;
    percent.textContent = `${value}%`;
    label.textContent = !videoReady ? '正在加载首页动画…' : !gameReady ? '正在准备游戏素材…' : '准备完毕，正在进入游戏…';
    if (!gameReady || !videoReady) return;
    finished = true;
    clearTimeout(timeout);
    window.removeEventListener('error', scriptError, true);
    // Show 100% for one paint, then uncover this same, fully prepared document.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.body.removeAttribute('data-eibon-loading');
      overlay.classList.add('is-ready');
      setTimeout(() => { overlay.hidden = true; }, 260);
    }));
  }
  function fail(message) {
    if (finished || failed) return;
    failed = true;
    clearTimeout(timeout);
    controller.abort();
    label.textContent = message;
    retry.hidden = false;
    retry.focus({ preventScroll: true });
  }
  function scriptError(event) {
    if (event.target instanceof HTMLScriptElement || event.error) fail('游戏未能加载完成，请重新加载。');
  }
  retry.addEventListener('click', () => location.reload());
  window.addEventListener('error', scriptError, true);
  window.addEventListener('pagehide', event => { if (!event.persisted) { controller.abort(); if (movieUrl) URL.revokeObjectURL(movieUrl); } });
  window.EibonLoading = {
    get videoReady() { return videoReady; },
    images(loaded, total) { imageFraction = total ? Math.min(1, loaded / total) : 1; render(); },
    ready() { gameReady = true; render(); },
    fail,
  };
  document.addEventListener('DOMContentLoaded', async () => {
    const video = document.querySelector('#menu-video');
    try {
      const response = await fetch(video.dataset.src, { signal: controller.signal });
      if (!response.ok) throw new Error('animation download failed');
      const length = Number(response.headers.get('content-length'));
      const chunks = [];
      let received = 0;
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          if (length > 0) { videoFraction = Math.min(.99, received / length); render(); }
        }
      } else chunks.push(await response.arrayBuffer());
      if (failed) return;
      const blob = new Blob(chunks, { type: 'video/mp4' });
      movieUrl = URL.createObjectURL(blob);
      await new Promise((resolve, reject) => {
        video.addEventListener('canplay', resolve, { once: true });
        video.addEventListener('error', reject, { once: true });
        video.src = movieUrl;
        video.load();
      });
      if (failed) return;
      videoReady = true;
      videoFraction = 1;
      render();
    } catch (error) {
      if (!failed && error.name !== 'AbortError') fail('首页动画加载失败，请检查网络后重试。');
    }
  }, { once: true });
})();
