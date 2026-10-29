(() => {
  const get = id => document.getElementById(id);
  let objectUrl, busy = false, ready = false, savedAsset;
  function status(message){UI.feedback(get('status'),message,'任务状态已更新，请查看详情。');get('diagnostic-text').textContent=message;}
  chrome.tabs.getCurrent().then(tab => {globalThis.inspirationVideoTabId = tab.id;});
  function sync() {
    get('file').disabled = busy;
    get('start').disabled = busy || !ready;
    get('pause').disabled = get('stop').disabled = !busy;
    get('video').controls = !busy;
  }
  get('file').addEventListener('change', async () => {
    ready = false; sync();
    const file = get('file').files[0];
    if (!file) return;
    savedAsset = undefined;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    // This identifier groups re-runs of the same local selection; it is not a content hash.
    const descriptor = new TextEncoder().encode(`${file.name}|${file.size}|${file.lastModified}`);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', descriptor))].map(x => x.toString(16).padStart(2, '0')).join('');
    globalThis.inspirationLocalVideo = {canonical_url: `local-video://${hash}`, page_title: file.name};
    objectUrl = URL.createObjectURL(file);
    get('video').src = objectUrl;
    status('正在读取视频…');
  });
  get('video').addEventListener('loadeddata', () => {ready = true; sync(); status('视频已就绪。');});
  get('video').addEventListener('error', () => {ready = false; sync(); status('浏览器无法解码这个视频，请尝试 MP4（H.264）格式。');});
  get('start').addEventListener('click', () => {
    const interval=Number(get('interval').value);
    if(!Number.isFinite(interval)||interval<0.5||interval>60){status('采样间隔应为 0.5–60 秒');get('interval').focus();return;}
    busy = true; sync();
    chrome.runtime.sendMessage({type: 'COLLECT_V2', build: Hub.BUILD, mode: 'video', port: 8766,
      options: {strategy: get('strategy').value, interval, savedAsset}}, response => {
      busy = false; sync();
      status(chrome.runtime.lastError?.message || (response?.ok ? response.result?.message : response?.error) || '抽帧连接中断');
    });
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message.type !== 'PREPARE_SAVED_VIDEO' || message.tabId !== globalThis.inspirationVideoTabId) return false;
    if (sender.id !== chrome.runtime.id || !/^http:\/\/127\.0\.0\.1:8766\/video\/media\/[A-Za-z0-9_-]+$/.test(message.mediaUrl)) return false;
    ready = false; sync();
    savedAsset = message.asset.asset_id;
    globalThis.inspirationLocalVideo = message.asset.page;
    get('strategy').value = message.options.strategy || 'slides';
    get('interval').value = message.options.interval || 1;
    status(`视频已保存：${message.asset.path}\n正在加载本地视频，随后自动抽帧…`);
    const video = get('video');
    let timer;
    const finish = error => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', loaded);
      video.removeEventListener('error', failed);
      reply(error ? {ok: false, error} : {ok: true});
    };
    const loaded = () => finish();
    const failed = () => finish('浏览器无法解码该视频，原文件已保留');
    video.addEventListener('loadeddata', loaded, {once: true});
    video.addEventListener('error', failed, {once: true});
    timer = setTimeout(() => finish('本地视频加载超时，原文件已保留'), 15000);
    video.crossOrigin = 'anonymous';
    video.src = message.mediaUrl;
    video.load();
    return true;
  });
  get('pause').addEventListener('click', async () => {
    const {liblibControl} = await chrome.storage.local.get(['liblibControl']);
    const action = liblibControl === 'paused' ? 'running' : 'paused';
    chrome.runtime.sendMessage({type: 'CONTROL_COLLECTOR', action}, () => {get('pause').textContent = action === 'paused' ? '继续' : '暂停';});
  });
  get('stop').addEventListener('click', () => chrome.runtime.sendMessage({type: 'CONTROL_COLLECTOR', action: 'stopped'}, () => {status('正在停止，已保存图片保留…');}));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if(changes.liblibControl)get('pause').textContent=UI.t(changes.liblibControl.newValue==='paused'?'继续':'暂停');
    if (changes.liblibActiveJob) {busy = Boolean(changes.liblibActiveJob.newValue); sync();}
    if (changes.liblibProgress?.newValue) {
      status(changes.liblibProgress.newValue.message || '');
      get('progress').value = changes.liblibProgress.newValue.percent || 0;
    }
  });
  chrome.storage.local.get(['liblibActiveJob','liblibControl']).then(state => {busy = Boolean(state.liblibActiveJob);get('pause').textContent=UI.t(state.liblibControl==='paused'?'继续':'暂停'); sync();});
})();
