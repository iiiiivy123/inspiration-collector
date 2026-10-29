(() => {
  if (globalThis.inspirationVideoListener) chrome.runtime.onMessage.removeListener(globalThis.inspirationVideoListener);
  let extracting = false;
  const handler = (message, _sender, reply) => {
    if (message.type !== 'EXTRACT_VIDEO') return false;
    if (location.protocol === 'chrome-extension:' && message.tabId !== globalThis.inspirationVideoTabId) return false;
    if (extracting) { reply({error: '当前视频正在抽帧，请先停止。'}); return false; }
    const candidates = [...document.querySelectorAll('video')].filter(video => {
      const rect = video.getBoundingClientRect();
      return rect.width > 100 && rect.height > 100 && rect.bottom > 0 && rect.top < innerHeight && getComputedStyle(video).visibility !== 'hidden';
    });
    if (candidates.length !== 1) {
      reply({error: candidates.length ? '当前有多个可见视频，请单独打开要采集的作品。' : '未找到可读取的视频，请先打开视频笔记，或选择已下载的视频。'});
      return false;
    }
    extracting = true;
    const command = async data => {
      const result = await chrome.runtime.sendMessage({...data, tabId: message.tabId, session: message.session});
      if (!result?.ok) throw new Error(result?.error || '采集后台连接中断');
      return result;
    };
    const control = async () => {
      while (true) {
        const state = await command({type: 'VIDEO_CONTROL'});
        if (state.control === 'stopped') throw new Error('USER_STOPPED');
        if (state.control !== 'paused') return;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };
    const page = globalThis.inspirationLocalVideo || {
      canonical_url: location.href.split('#')[0],
      page_title: document.querySelector('h1')?.textContent || document.title,
    };
    InspirationFrames.extract(candidates[0], message.options, control,
      frame => command({type: 'VIDEO_FRAME', page, frame}),
      progress => command({type: 'VIDEO_PROGRESS', progress}))
      .then(result => reply({ok: true, result}))
      .catch(error => reply({error: error.message}))
      .finally(() => {extracting = false;});
    return true;
  };
  globalThis.inspirationVideoListener = handler;
  chrome.runtime.onMessage.addListener(handler);
})();
