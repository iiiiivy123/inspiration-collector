// Service-backed history; preparation never downloads media bodies.
let preparedPosts=[],preparing=false,committing=false,approvedSizes=new Map();
async function service(path,body){return downloadApi(8766,healthCache.settings_token,path,body);}
async function probeSource(source){
  if(source.media_kind?.startsWith('bilibili')&&!healthCache.bilibili_mux)throw new Error('本地服务缺少B站音视频合并组件，请更新完整安装包；不会保存无声视频');
  const urls=[source.url,...(source.audio_url?[source.audio_url]:[])];
  const result=await service('/video/probe',{urls,destination:batchOptions.destination,duplicate_policy:source.audio_url?'refresh':batchOptions.duplicate_policy});
  return {bytes:result.items.length===urls.length&&result.items.every(i=>Number.isFinite(i.bytes))?result.items.reduce((n,i)=>n+i.bytes,0):null,local:result.items.every(i=>i.local)};
}
function startPreparation(){preparedPosts=[];approvedSizes=new Map();committing=false;preparing=Boolean(healthCache?.space_preflight&&batchOptions.include_videos);}
async function existingCapture(url){
  if(!healthCache?.capture_history || batchOptions.duplicate_policy!=='skip')return null;
  const required=batchOptions.collection_mode==='text'?['text']:['images'];
  if(batchOptions.collection_mode==='text'){
    if(batchOptions.include_images)required.push('images');
    if(batchOptions.include_comments)required.push('comments');
    if(batchOptions.ocr_enabled&&batchOptions.include_images)required.push('ocr');
  }
  if(batchOptions.include_videos)return null; // Never infer an unseen video's completeness.
  const {item}=await service('/history/lookup',{url,required});
  return item?{status:'skipped',existing:true,url,directory:item.directory,reason:'已有可用副本（上次已加载内容）；未复制到本次目录，也未刷新评论：'+item.directory}:null;
}
async function preparePost(tab,port,group,payload,media){
  if(!preparing||committing)return null;
  let sources=media.filter(m=>m.kind==='video'||m.kind==='gif').map(m=>({...m,canonical_url:payload.canonical_url,page_title:payload.page_title}));
  let issue;
  if(payload.has_video&&!sources.length){try{sources=[await videoSource(tab,{})];}catch(e){issue=e.message;}}
  const estimates=[];
  for(const source of sources){await controlPoint();estimates.push({source,...await probeSource(source)});}
  preparedPosts.push({tab,port,group,payload,media,estimates,issue});
  return {status:'planned',url:payload.canonical_url,reason:issue||'媒体预检完成，尚未下载'};
}
async function approveDownloads(entries){
  const unique=new Map();let unknown=0;
  for(const e of entries){for(const estimate of e.estimates)unique.set(estimate.source.url,estimate);if(e.issue)unknown++;}
  if(!unique.size&&!unknown)return;
  let known=0;for(const [url,item]of unique){if(item.bytes==null)unknown++;else known+=item.bytes;approvedSizes.set(url,item.bytes);if(item.bytes>(batchOptions.max_video_mb||512)*1048576)throw new Error('有视频超过单个文件上限，请修改设置或跳过视频。');}
  const disk=await service('/video/probe',{urls:[],destination:batchOptions.destination});
  if(disk.free_bytes<known+(batchOptions.min_free_mb??256)*1048576)throw new Error('目标磁盘空间不足，未开始下载');
  const local=[...unique.values()].reduce((n,e)=>n+(e.local?(e.bytes||0):0),0);
  const message=`本次预检 ${entries.length} 篇：已知视频 ${(known/1048576).toFixed(1)} MB（可本地复用 ${(local/1048576).toFixed(1)} MB），${unknown} 项大小或地址未知。\n磁盘剩余 ${(disk.free_bytes/1073741824).toFixed(1)} GB；图片、抽帧和临时空间未计入。确认后开始下载。`;
  await chrome.storage.local.set({collectorApproval:{state:'pending',message,createdAt:Date.now()}});
  await reportProgress({message:'媒体预检完成，等待确认下载',details:message});
  while(true){await controlPoint();const {collectorApproval:a}=await chrome.storage.local.get(['collectorApproval']);if(a?.state==='approved')break;if(!a||a.state==='rejected')throw new Error('USER_STOPPED');await wait(750);}
  await chrome.storage.local.remove('collectorApproval');
}
async function commitPrepared(){
  if(!preparing||committing)return;
  await approveDownloads(preparedPosts);committing=true;
  for(const entry of preparedPosts){await controlPoint();
    const key=Object.keys(batchJob.records).find(k=>batchJob.records[k].url===entry.payload.canonical_url&&batchJob.records[k].status==='planned');
    if(!key)continue;
    try{const media=entry.estimates.map(e=>({...e.source,kind:'video'}));
      const result=await processBatchPost(entry.tab,entry.port,entry.group,{...entry.payload,_preparedMedia:[...entry.media.filter(m=>m.kind==='photo'),...media],_preflightIssue:entry.issue});
      await recordPost(key,result);
    }catch(error){if(error.message==='USER_STOPPED'||error.message.includes('NEEDS_ATTENTION')||/保存服务|fetch|超时/.test(error.message))throw error;await recordPost(key,{...batchJob.records[key],status:'failed',url:entry.payload.canonical_url,reason:error.message});}
  }
  preparing=false;preparedPosts=[];
}
