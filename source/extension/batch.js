// Persistent, one-task-at-a-time batch journal. Content navigation stays platform-specific.
let batchJob;
const videoBatch = () => Boolean(batchJob?.options?.video_only);
const batchCount = () => videoBatch() ? Object.values(batchJob.records).reduce((n,r)=>n+(r.video_count||0),0) : Object.keys(batchJob.records).length;
const batchFull = () => batchCount() >= batchJob.limit || Object.keys(batchJob.records).length >= 500;
function batchLimit(value) {
  if (value === 'all') return 500;
  const n = Number(value ?? 20);
  if (!Number.isInteger(n) || n < 1 || n > 500) throw new Error('篇数请填写 1–500；全部也有每轮 500 篇安全上限。');
  return n;
}
function batchSummary(job) {
  const records = Object.values(job.records);
  const sum = k => records.reduce((n, r) => n + (r[k] || 0), 0);
  if(job.options?.video_only)return `视频额度 ${sum('video_count')}/${job.limit} · 已保存 ${sum('videos')} · 已有 ${sum('existingVideos')} · 扫描 ${records.length} 篇\n失败/部分失败 ${records.filter(r=>['failed','partial'].includes(r.status)).length} 篇；图片帖不占视频额度。\n${job.directory?'保存位置：'+job.directory:'尚未确认文件落盘'}`;
  return `已处理 ${records.length}/${job.limit} 篇 · 图文 ${sum('documents')} 篇 · 新增图片 ${sum('images')} · 重复图片 ${sum('duplicates')} · 视频 ${sum('videos')}\n跳过 ${records.filter(r => r.status === 'skipped').length} 篇 · 失败/部分失败 ${records.filter(r => r.status === 'failed' || r.status === 'partial').length} 篇\n${job.directory ? '保存位置：' + job.directory : '尚未确认文件落盘'}`;
}
async function saveBatch() {
  if(typeof service==='function'&&healthCache?.capture_history)batchJob.id ||= crypto.randomUUID();
  await chrome.storage.local.set({collectorCheckpoint: batchJob});
  if(typeof service==='function'&&healthCache?.capture_history)await service('/tasks',{id:batchJob.id,data:batchJob});
}
async function beginBatch(tab, mode, options) {
  const url = new URL(tab.url); url.search = ''; url.hash = ''; url.pathname = url.pathname.replace(/\/$/, '');
  const previous = (await chrome.storage.local.get(['collectorCheckpoint'])).collectorCheckpoint;
  if (options.resume && previous && !previous.completed) {
    if(['organized','organized_flat'].includes(options.layout) && !['four-categories-v1','function-platform-v2'].includes(previous.options.directory_schema))throw new Error('旧版任务使用不同目录结构。已保存文件保留；请取消续采并开始新任务，避免同一任务分散到两个目录。');
    if (previous.source !== url.href || previous.mode !== mode || Boolean(previous.options.video_only)!==Boolean(options.video_only) || (previous.options.collection_mode || 'images') !== (options.collection_mode || 'images')) throw new Error('待续任务属于其他页面或采集模式，请回到原页面和模式；或取消续采开始新任务。');
    // A resumed task pins its original root, independent of the new library default.
    previous.options.destination ||= previous.root;
    batchJob = previous;
  } else batchJob = {source: url.href, mode, name: tab.title, root: batchDirectory, options: {...options}, limit: batchLimit(options.limit), records: {}, queue: [], completed: false};
  batchOptions = batchJob.options;
  for(const [key,record] of Object.entries(batchJob.records))if(record.status==='planned')delete batchJob.records[key];
  if(typeof startPreparation==='function')startPreparation();
  await saveBatch();
}
async function recordPost(key, record) {
  batchJob.records[key] = record;
  if (record.directory) batchJob.directory = record.directory;
  await saveBatch();
  await reportProgress({percent:Math.min(100,Math.round(batchCount()/batchJob.limit*100)),message: batchSummary(batchJob), details: Object.values(batchJob.records).filter(r => r.reason).map(r => r.reason).join('\n')});
}
async function batchProblem(tabId) {
  const problem = await pageProblem(tabId);
  if (problem === 'verification') throw new Error('NEEDS_ATTENTION: 页面需要验证或重新登录。已保留断点，请手动处理后续采。');
  return problem;
}
async function processBatchPost(tab, port, group, payload) {
  let images = 0, duplicates = 0, videos = 0, existingVideos = 0, documents = 0, directory, failed = false;
  const textMode = batchOptions.collection_mode === 'text';
  const reasons = [];
  let media = payload._preparedMedia || payload._media || await loadedMedia(tab.id);
  let videoMeta={};
  if(batchOptions.video_only){
    media=media.filter(m=>m.kind==='video'||m.kind==='gif');
    if(!media.length&&payload.has_video&&!payload._preflightIssue){
      try{const source=await videoSource(tab,{});media=[{...source,kind:'video'}];}
      catch(error){return {status:'failed',video_count:1,url:payload.canonical_url,reason:error.message};}
    }
    if(!payload._preparedMedia){
      const seen=new Set(Object.values(batchJob.records).flatMap(r=>r.video_urls||[]));
      media=media.filter(m=>m.url&&!seen.has(m.url)&&(seen.add(m.url),true)).slice(0,Math.max(0,batchJob.limit-batchCount()));
    }
    if(!media.length)return {status:'skipped',video_count:0,url:payload.canonical_url,reason:'没有新的可采视频；图片帖不占额度'};
    videoMeta={video_count:media.length,video_urls:media.map(m=>m.url)};
    payload={...payload,images:[],body_text:''};
  }
  if(typeof preparePost==='function'){
    const plan=await preparePost(tab,port,group,payload,media);if(plan)return {...plan,...videoMeta};
  }
  if(payload._preflightIssue){failed=true;reasons.push(payload._preflightIssue);}
  const photos = media.filter(m => m.kind === 'photo').map(m => ({url: m.url, alt: ''}));
  if (photos.length && (!textMode || batchOptions.include_images)) payload.images = photos;
  if(textMode && !batchOptions.include_images)payload.images=[];
  if (payload.images?.length || (textMode && payload.body_text?.trim())) {
    const result = await submit({...payload, ...group}, payload.canonical_url, port);
    images += result.new_images || 0; duplicates += result.duplicate_images || 0; directory = result.directory;
    failed ||= Boolean(result.failed_images);
    documents = textMode ? 1 : 0;
    reasons.push(...(result.warnings || []));
  }
  const candidates = media.filter(m => m.kind === 'video' || m.kind === 'gif');
  if (payload.has_video && !candidates.length && !payload._preflightIssue) candidates.push({});
  if (candidates.length && !batchOptions.include_videos) reasons.push('已跳过视频：批量视频开关关闭');
  if (batchOptions.include_videos) for (const candidate of candidates) {
    await controlPoint();
    try {
      const result = await downloadVideo(tab, port, {...batchOptions, group, source: candidate.url ? {...candidate, canonical_url: payload.canonical_url, page_title: payload.page_title} : null}, healthCache, batchOptions.extract_frames);
      videos += result.new_videos || 0;
      existingVideos += result.duplicate_videos || 0;
      if(result.partial) {failed=true; reasons.push(result.message);}
      images += result.new_images || 0;
      directory = result.directory || directory;
      if(textMode && documents && result.video_file)await submit({...payload,...group,images:[],media_files:[result.video_file]},payload.canonical_url,port);
    } catch (error) {
      if (error.message === 'USER_STOPPED' || error.message.includes('NEEDS_ATTENTION')) throw error;
      failed = true; reasons.push(error.message);
    }
  }
  return {...videoMeta,status: failed ? (images || duplicates || videos || existingVideos || documents ? 'partial' : 'failed') : images || duplicates || videos || existingVideos || documents ? 'saved' : 'skipped', images, duplicates, videos, existingVideos, documents, directory,
    reason: reasons.join('\n') || (existingVideos ? `重复视频 ${existingVideos} 个，已确认文件存在` : !images && !duplicates && !videos && !documents ? '没有已加载的可保存媒体' : ''), url: payload.canonical_url};
}
async function finishBatch() {
  if(typeof commitPrepared==='function')await commitPrepared();
  batchJob.completed = true; await saveBatch();
  return {message: batchSummary(batchJob) + '\n仅表示本轮已处理的内容，未确认全部轮播或全部历史作品。', details: Object.values(batchJob.records).filter(r => r.reason).map(r => `${r.url}: ${r.reason}`).join('\n')};
}
async function runXhsBatch(tab, port, options) {
  const group = await authorContext(tab, port);
  if (!/^\/user\/profile\/[a-f0-9]{24}\/?$/i.test(new URL(tab.url).pathname)) throw new Error('请先回到作者主页，再开始或继续任务。');
  await beginBatch(tab, 'author', options); await inject(tab.id);
  let idle = 0;
  while (!batchFull() && idle < 4) {
    await controlPoint(); await batchProblem(tab.id);
    const data = await chrome.tabs.sendMessage(tab.id, {type:'LIBLIB_CARDS'});
    if (!Array.isArray(data?.cards)) throw new Error('无法读取作者卡片，已保留断点。');
    const card = data.cards.find(c => !batchJob.records[c.id] && (!batchJob.retryKeys || batchJob.retryKeys.includes(c.id)));
    if (!card) { idle++; await chrome.tabs.sendMessage(tab.id,{type:'LIBLIB_SCROLL'}); await controlledWait(2500); continue; }
    idle = 0;
    if(typeof existingCapture==='function'){
      const old=await existingCapture(card.url);if(old){await recordPost(card.id,old);continue;}
    }
    const opened = await chrome.tabs.sendMessage(tab.id,{type:'LIBLIB_OPEN_WORK',url:card.url});
    if (!opened?.opened) throw new Error('未能打开卡片，停止以避免采集错帖。');
    let payload, unavailable = false;
    for (let i=0;i<12;i++) {
      await controlledWait(1000);
      if (await batchProblem(tab.id) === 'unavailable') { unavailable = true; break; }
      const detail = await chrome.tabs.sendMessage(tab.id,{type:'LIBLIB_DETAIL',id:card.id,options:batchOptions});
      payload = detail?.payload;
      if (payload?.images?.length || payload?.has_video || payload?.body_text?.trim()) break;
    }
    try {
      const result = payload && !unavailable ? await processBatchPost({...tab,url:payload.canonical_url},port,group,payload) : {status:'skipped',reason: unavailable ? '帖子失效或无法访问' : '未确认已加载的正文媒体',url:card.url};
      await recordPost(card.id,result);
    } catch(error) {
      if (error.message === 'USER_STOPPED' || error.message.includes('NEEDS_ATTENTION') || /fetch|保存服务|超时/i.test(error.message)) throw error;
      await recordPost(card.id,{status:'failed',reason:error.message,url:card.url});
    }
    await controlPoint();
    const closed = await chrome.tabs.sendMessage(tab.id,{type:'LIBLIB_CLOSE_WORK'});
    if (!closed?.closed) throw new Error('已记录结果，请手动返回作者主页后续采。');
    await controlledWait(2500);
    if (new URL((await chrome.tabs.get(tab.id)).url).pathname !== new URL(tab.url).pathname) throw new Error('尚未回到作者主页，已保留断点。');
  }
  return finishBatch();
}
async function runBoardBatch(tab, port, options) {
  await beginBatch(tab,'board',options);
  const snapshot = async () => {
    await batchProblem(tab.id);
    const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},files:['board.js']});
    if (result?.error || !result) throw new Error(result?.error || '无法读取画板');
    return result;
  };
  const board = await snapshot();
  const queue = new Set(batchJob.queue);
  let idle = 0;
  const scanLimit=videoBatch()?500:batchJob.limit;
  for (let round=0;round<80 && idle<4 && queue.size<scanLimit;round++) {
    await controlPoint();
    const data = await snapshot();
    if (data.board_url !== board.board_url) throw new Error('页面离开画板，已停止扫描。');
    const before=queue.size;
    data.urls.forEach(url=>{if(queue.size<scanLimit)queue.add(url);});
    batchJob.queue=[...queue]; await saveBatch();
    idle=queue.size===before?idle+1:0;
    await reportProgress({message:videoBatch()?`扫描「${board.board_name}」 · 已找到 ${queue.size} 篇待检查，视频上限 ${batchJob.limit} 个`:`扫描「${board.board_name}」 · 已找到 ${queue.size}/${batchJob.limit} 篇`});
    if(queue.size>=scanLimit)break;
    await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>window.scrollBy(0,Math.max(400,innerHeight*.85))});
    await controlledWait(2000);
  }
  if(!queue.size)throw new Error('未识别到画板内的 Pin，未开始保存。');
  let workTab, keep = false;
  try {
    for(const url of queue) {
      if(batchFull())break;
      if(batchJob.records[url])continue;
      if(batchJob.retryKeys&&!batchJob.retryKeys.includes(url))continue;
      if(typeof existingCapture==='function'){const old=await existingCapture(url);if(old){await recordPost(url,old);continue;}}
      await controlPoint();
      if(!workTab) workTab=await chrome.tabs.create({url,active:false}); else await chrome.tabs.update(workTab.id,{url});
      let payload;
      for(let attempt=0;attempt<15;attempt++) {
        await controlledWait(1000);
        const current=await chrome.tabs.get(workTab.id);
        if(current.status!=='complete')continue;
        if(await batchProblem(workTab.id)==='unavailable')break;
        if(/\/(login|signin|auth)(\/|$)/i.test(new URL(current.url).pathname))throw new Error('NEEDS_ATTENTION: 请先登录，再返回画板继续任务。');
        if(new URL(current.url).pathname!==new URL(url).pathname)continue;
        try {payload=await pagePayload(workTab.id);} catch(_) {continue;}
        if(payload.images?.length||payload.has_video)break;
      }
      try {
        await recordPost(url,payload ? await processBatchPost({...workTab,url},port,{board_url:board.board_url,board_name:board.board_name},payload) : {status:'skipped',url,reason:'Pin 未加载出可识别媒体'});
      } catch(error) {
        if(error.message==='USER_STOPPED'||error.message.includes('NEEDS_ATTENTION')||/fetch|保存服务|超时/i.test(error.message))throw error;
        await recordPost(url,{status:'failed',url,reason:error.message});
      }
      await controlledWait(Object.keys(batchJob.records).length%10===0?20000:2000);
    }
    return await finishBatch();
  } catch(error) { keep=error.message.includes('NEEDS_ATTENTION'); if(keep&&workTab)await chrome.tabs.update(workTab.id,{active:true}); throw error; }
  finally {if(workTab&&!keep)await chrome.tabs.remove(workTab.id).catch(()=>{});}
}
async function runXBatch(tab, port, options) {
  return runSocialBatch(tab,port,options,'x');
}
async function runSocialBatch(tab, port, options, platform) {
  const instagram=platform==='instagram',bilibili=platform==='bilibili',label=bilibili?'B站':instagram?'Instagram':'X';
  if(bilibili&&!options.video_only)throw new Error('B站批量仅支持视频，请选择批量视频或批量视频抽帧');
  const postId = value => {
    const u=new URL(value);
    if(bilibili)return /^(www\.)?bilibili\.com$/.test(u.hostname)?u.pathname.match(/^\/video\/(BV[\da-zA-Z]{10})\/?$/)?.[1]:null;
    if(instagram)return /(^|\.)instagram\.com$/.test(u.hostname) ? u.pathname.match(/^\/(?:p|reels?)\/([\w-]{5,30})\/?$/)?.[1] : null;
    return /(^|\.)(x\.com|twitter\.com)$/.test(u.hostname) ? u.pathname.match(/^\/[\w]+\/status\/(\d+)\/?$/)?.[1] : null;
  };
  const snapshot = async () => {
    await batchProblem(tab.id);
    const current=await chrome.tabs.get(tab.id);
    if(/\/(accounts\/login|challenge|checkpoint|i\/flow|login)(\/|$)/i.test(new URL(current.url).pathname))throw new Error('NEEDS_ATTENTION: 请先完成登录或验证，再回作者主页续采。');
    const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},files:[bilibili?'bilibili.js':instagram?'instagram-profile.js':'x-profile.js']});
    if (!result || result.error) throw new Error(result?.error || '无法读取作者主页');
    return result;
  };
  const profile = await snapshot();
  await beginBatch({...tab,url:profile.author_url+(instagram&&profile.view==='reels'?'/reels':'')},platform+'-author',options);
  const group = {author_url:profile.author_url,author_name:profile.author_name};
  const queue = new Set(batchJob.queue);
  let idle = 0, workTab, keep = false;
  try {
    for(let round=0;round<100 && idle<5 && !batchFull();round++) {
      await controlPoint();
      const data = await snapshot();
      if(data.author_url!==profile.author_url || (instagram&&data.view!==profile.view))throw new Error('已离开原作者主页或列表，停止并保留断点。');
      const before = queue.size;
      for(const url of data.urls)if(queue.size<(videoBatch()?500:batchJob.limit))queue.add(url);
      batchJob.queue=[...queue]; await saveBatch();
      idle=before===queue.size?idle+1:0;
      for(const url of queue) {
        if(batchFull())break;
        if(batchJob.records[url])continue;
        if(batchJob.retryKeys&&!batchJob.retryKeys.includes(url))continue;
        if(typeof existingCapture==='function'){const old=await existingCapture(url);if(old){await recordPost(url,old);continue;}}
        await controlPoint();
        if(!workTab)workTab=await chrome.tabs.create({url,active:false});
        else await chrome.tabs.update(workTab.id,{url});
        let payload, issue='未识别到当前帖正文或媒体，可能未加载或不可访问';
        for(let attempt=0;attempt<18;attempt++) {
          await controlledWait(1000);
          const current=await chrome.tabs.get(workTab.id);
          if(/\/(i\/flow|login|account\/access|accounts\/login|challenge|checkpoint)(\/|$)/i.test(new URL(current.url).pathname))throw new Error('NEEDS_ATTENTION: 需要登录或验证，处理后回作者主页续采。');
          if(current.status!=='complete')continue;
          if(await batchProblem(workTab.id)==='unavailable')break;
          const targetId=postId(url);
          if(!targetId || postId(current.url)!==targetId)continue;
          try {
            const candidate=await pagePayload(workTab.id,batchOptions);
            if(postId(candidate.canonical_url)!==targetId)continue;
            if((instagram||bilibili) && candidate.author_handle?.toLowerCase()!==profile.handle) {
              issue=candidate.author_handle?'当前帖作者与主页不一致，未保存':'未能确认当前帖作者，未保存';
              if(candidate.author_handle)break;
              continue;
            }
            if(candidate.images?.length || candidate.has_video || candidate.body_text?.trim()) {payload=candidate;break;}
          } catch(error) {
            if(/旧版|NEEDS_ATTENTION/.test(error.message))throw error;
          }
        }
        try {
          await recordPost(url,payload ? await processBatchPost({...workTab,url},port,group,payload) : {status:'skipped',url,reason:issue});
        } catch(error) {
          if(error.message==='USER_STOPPED'||error.message.includes('NEEDS_ATTENTION')||/fetch|保存服务|超时/i.test(error.message))throw error;
          await recordPost(url,{status:'failed',url,reason:error.message});
        }
        await controlledWait(Object.keys(batchJob.records).length%10===0?20000:2500);
      }
      if(batchFull())break;
      await reportProgress({message:videoBatch()?`扫描 ${label} 作者主页 · 视频额度 ${batchCount()}/${batchJob.limit} · 已检查 ${Object.keys(batchJob.records).length} 篇`:`扫描 ${label} 作者主页 · 已处理 ${Object.keys(batchJob.records).length}/${batchJob.limit} 篇`});
      if(bilibili&&idle>=1){
        await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
          const next=document.querySelector('.be-pager-next:not(.be-pager-disabled),.vui_pagenation--btn-side:not([disabled])[title="下一页"]');
          if(next&&next.getAttribute('aria-disabled')!=='true')next.click();else window.scrollBy(0,Math.max(400,innerHeight*.8));
        }});
      }else await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>window.scrollBy(0,Math.max(400,innerHeight*.8))});
      await controlledWait(2500);
    }
    if(!queue.size)throw new Error('未找到本人帖子。请确认已登录、主页帖子已加载；未开始保存。');
    return await finishBatch();
  } catch(error) {
    keep=error.message.includes('NEEDS_ATTENTION');
    if(keep&&workTab)await chrome.tabs.update(workTab.id,{active:true});
    throw error;
  } finally {if(workTab&&!keep)await chrome.tabs.remove(workTab.id).catch(()=>{});}
}
if(typeof module!=='undefined')module.exports={batchLimit,batchSummary};
