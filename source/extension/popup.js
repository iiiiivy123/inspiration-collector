const BUILD=Hub.BUILD,q=s=>document.querySelector(s),t=s=>globalThis.UI?.t(s)||s;
let defaults,site,currentTab,defaultPath='',active=false,ready=false,videoMode='download',control='running',resumeOptions=null,checkpoint=null,secondary=false,approval=false,picking=false,folderBefore='';
const error=e=>{UI.feedback(q('#status'),e.message||String(e));q('#diagnostic-text').textContent=e.message||String(e);};
const guarded=fn=>async(...args)=>{try{await fn(...args);}catch(e){error(e);}};
const isVideo=()=>q('#collection-mode').value==='video';
function showSecondary(value){secondary=value;render();q('#scroll-content').scrollTop=0;}
function render(){
 if(!defaults||!site)return;
 const video=isVideo(),plain=q('#collection-mode').value==='plain',text=plain||q('#collection-mode').value==='text';
 const allowed=Boolean(site.bulk)&&(site.site!=='B站'||video)&&(!text||['小红书','X','Instagram'].includes(site.site))&&(!video||['小红书','X','Instagram','Pinterest','B站'].includes(site.site));
 if(!allowed)q('#scope').value='current';const bulk=q('#scope').value==='bulk';
 q('#scope-bulk').disabled=!allowed||Boolean(resumeOptions);q('#scope-current').disabled=Boolean(resumeOptions);
 for(const s of ['current','bulk'])q('#scope-'+s).setAttribute('aria-pressed',String(q('#scope').value===s));
 q('#main-options').hidden=secondary;q('#secondary-options').hidden=!secondary;
 q('#video-tools').hidden=!video;q('#limit-row').hidden=!bulk;q('#quota-help').hidden=!video||!bulk;
 q('#text-options').hidden=!text;q('#images-option').hidden=!text||plain;q('#attachment-row').hidden=video||plain;
 q('#include-comments').parentElement.hidden=plain;q('#ocr-enabled').parentElement.hidden=plain;q('#plain-comments-option').hidden=!plain;
 q('#frame-options').hidden=plain|| (video?videoMode==='download':q('#video-action').value!=='frames');
 q('#more-options').hidden=q('#frame-options').hidden;
 q('#collect-video').hidden=!video||bulk||site.site==='B站';
 q('#limit-label').textContent=t(video?'视频数量上限':'本次最多处理');
 q('#mode-help').textContent=bulk?site.site+' · '+t(site.hint||''):t(text?'正文与图片文字整理为 Markdown':video?'只处理视频，不保存图片帖':'保存当前作品图片');
 q('#task-options').disabled=!ready||active;
 for(const input of q('#task-options').querySelectorAll('input,select'))input.disabled=Boolean(resumeOptions);
 q('#save-video').disabled=q('#download-frames').disabled=Boolean(resumeOptions);
 q('#choose-folder').disabled=Boolean(resumeOptions);q('#choose-folder-more').disabled=Boolean(resumeOptions)||picking;
 q('#default-path').disabled=q('#collect-video').disabled=Boolean(resumeOptions);
 q('#save-video').setAttribute('aria-pressed',String(videoMode==='download'));
 q('#download-frames').setAttribute('aria-pressed',String(videoMode==='download-frames'));
 q('#controls').hidden=!active||approval;q('#pause').textContent=t(control==='paused'?'继续':'暂停');
 q('#pause').disabled=q('#stop').disabled=control==='stopped';
 q('#reset').hidden=!active;q('#start').hidden=active||approval;
 q('#start').disabled=!ready||active||picking;
 q('#start').textContent=t(secondary?'返回采集':resumeOptions?'继续未完成任务':video?(bulk?'扫描视频并估算大小':videoMode==='video'?'仅抽帧':'检查视频并估算大小'):'▶ 开始采集');
 if(plain)q('#mode-help').textContent=t('只保存 MD；不下载图片、视频或识别图片文字');
 const kind=plain?t('纯文字 · Markdown'):video?t(videoMode==='download'?'视频':videoMode==='video'?'仅抽帧':'视频抽帧'):t(text?'图文笔记':'图片');
 const summary=[bulk?t('批量采集'):t('当前作品'),kind,...(bulk?[q('#batch-limit').value+' '+t(video?'个视频':'篇')]:[])].join(' · ');
 q('#summary').textContent=summary;q('#summary').title=summary;
 const policy={fill:'自动去重补齐',skip:'跳过已有',refresh:'重新读取原帖'}[q('#duplicate-policy').value];
 q('#options-summary').textContent=[t(policy),...(text?[t(q('#ocr-enabled').checked?'OCR 开':'OCR 关'),t(q('#include-comments').checked?'评论 开':'评论 关')]:[]),...(video&&videoMode==='download-frames'?[t('抽帧参数可调整')]:[])].join(' · ');
 q('#duplicate-help').textContent=t({fill:'检查本地文件并补齐缺失；相同内容不重复保存。',skip:'旧任务沿用跳过已有策略。',refresh:'重新读取原帖；同一目录复用，保留手动编辑内容。'}[q('#duplicate-policy').value]);
 const destination=effectiveFolder();q('#save-path').textContent=destination;q('#save-path').title=destination;
 q('#default-path').hidden=!q('#task-destination').value.trim();
 q('#destination-label').textContent=t(q('#task-destination').value.trim()?'仅本次另存':'使用默认目录');
 q('#recovery').hidden=active||!checkpoint||checkpoint.completed;q('#resume-help').hidden=!resumeOptions;q('#resume-task').disabled=active;
 globalThis.refreshSelects?.();
}
function effectiveFolder(){
 const root=q('#task-destination').value.trim()||defaultPath;
 const category=q('#scope').value==='bulk'?'批量':isVideo()?'视频':['text','plain'].includes(q('#collection-mode').value)?'图文':'图片';
 return root.replace(/[\\/]+$/,'')+'\\'+category+'\\'+(site?.site==='网页'?'其他网页':site?.site||'其他网页');
}
function options(){
 if(resumeOptions)return {...resumeOptions,resume:true};
 const video=isVideo(),plain=q('#collection-mode').value==='plain',bulk=q('#scope').value==='bulk',frames=!plain&&(video?videoMode!=='download':q('#video-action').value==='frames');
 const limit=bulk?Number(q('#batch-limit').value):defaults.limit,interval=frames?Number(q('#video-interval').value):defaults.interval;
 if(bulk&&(!Number.isInteger(limit)||limit<1||limit>500)){showSecondary(false);q('#batch-limit').focus();throw new Error('数量请填写 1–500。');}
 if(frames&&(!Number.isFinite(interval)||interval<0.5||interval>60)){showSecondary(true);q('#video-interval').focus();throw new Error('采样间隔应为 0.5–60 秒');}
 return Hub.options({...defaults,md_only:plain,collection_mode:plain?'text':video?'images':q('#collection-mode').value,video_only:video&&bulk,limit,video_action:video?(videoMode==='download'?'save':'frames'):q('#video-action').value,capture_scope:bulk?'batch':'single',capture_kind:plain?'text':video?'video':q('#collection-mode').value,duplicate_policy:q('#duplicate-policy').value,include_images:video?false:q('#include-images').checked,include_comments:plain?q('#plain-comments').checked:!video&&q('#include-comments').checked,plain_comments:q('#plain-comments').checked,ocr_enabled:q('#ocr-enabled').checked,strategy:q('#video-strategy').value,interval,destination:q('#task-destination').value.trim()||null,resume:false});
}
async function start(){
 if(!ready||active)return;const value=options();if(secondary){await remember();showSecondary(false);return;}
 const mode=q('#scope').value==='bulk'?site.bulk:isVideo()?videoMode:'current';
 if(!mode)throw new Error('此页面不支持所选采集方式');
 if(isVideo()&&videoMode==='video'&&q('#scope').value!=='bulk'){value.include_videos=false;value.extract_frames=false;}
 await remember();active=true;render();await chrome.storage.local.remove('collectorPopupDraft');
 UI.message(q('#status'),value.include_videos?'正在检查本次媒体…':'开始采集…');
 chrome.runtime.sendMessage({type:'COLLECT_V2',build:BUILD,mode,options:value,port:8766},response=>{active=false;resumeOptions=null;q('#task-destination').value='';q('#resume-task').checked=false;render();if(chrome.runtime.lastError||!response?.ok)error(new Error(response?.error||chrome.runtime.lastError?.message||'任务未完成'));update().catch(error);});
}
async function update(){
 const s=await chrome.storage.local.get(['liblibActiveJob','liblibProgress','collectorApproval','liblibControl','collectorCheckpoint']);
 active=Boolean(s.liblibActiveJob);control=s.liblibControl||'running';checkpoint=s.collectorCheckpoint;const p=s.liblibProgress;
 q('#result-context').hidden=!p;
 if(p){const source=p.context?.title||p.context?.url?.split('?')[0]||t('来源未记录');UI.message(q('#result-context'),active?'正在执行 · {source}':'上次任务 · {source} · {time}',{source,time:p.updatedAt?new Date(p.updatedAt).toLocaleString():t('时间未记录')});UI.feedback(q('#status'),(p.message||'').split('\n')[0],'任务状态已更新，请查看详情。');q('#diagnostic-text').textContent=[p.message,p.details].filter(Boolean).join('\n');}
 else{UI.message(q('#status'),'等待开始');q('#diagnostic-text').textContent='';}
 q('#progress').hidden=!active;q('#progress').value=p?.percent||0;
 approval=s.collectorApproval?.state==='pending';q('#approval').hidden=!approval;if(approval)UI.feedback(q('#approval-text'),s.collectorApproval.message,'等待下载确认');render();
}
function showOptions(d){
 for(const [id,key]of [['collection-mode','collection_mode'],['batch-limit','limit'],['duplicate-policy','duplicate_policy'],['video-strategy','strategy'],['video-interval','interval']])q('#'+id).value=(key==='duplicate_policy'&&d[key]==='skip'&&!resumeOptions)?'fill':d[key]??defaults[key];
 if(d.video_only)q('#collection-mode').value='video';
 if(d.md_only)q('#collection-mode').value='plain';
 q('#plain-comments').checked=Boolean(d.plain_comments??(d.md_only&&d.include_comments));
 q('#video-action').value=d.video_action||(d.include_videos?(d.extract_frames?'frames':'save'):'skip');
 videoMode=d.extract_frames||d.video_action==='frames'?'download-frames':'download';q('#task-destination').value=d.destination||'';
 for(const [id,key]of [['include-images','include_images'],['include-comments','include_comments'],['ocr-enabled','ocr_enabled']])q('#'+id).checked=d[key]??defaults[key];
}
q('#task-options').addEventListener('change',()=>{render();if(ready&&!resumeOptions)remember().catch(()=>{});});q('#start').onclick=guarded(start);
for(const s of ['current','bulk'])q('#scope-'+s).onclick=guarded(async()=>{q('#scope').value=s;if(s==='bulk'&&videoMode==='video')videoMode='download';render();await remember();});
q('#save-video').onclick=guarded(async()=>{videoMode='download';render();await remember();});q('#download-frames').onclick=guarded(async()=>{videoMode='download-frames';render();await remember();});
q('#collect-video').onclick=()=>{videoMode='video';render();};
q('#more-options').onclick=()=>showSecondary(true);
q('#manage').onclick=()=>chrome.runtime.openOptionsPage();q('#open-path').onclick=guarded(()=>Hub.api('/settings/open',{directory:effectiveFolder()}));
q('#task-details').onclick=()=>q('#task-dialog').showModal();q('#close-task').onclick=()=>q('#task-dialog').close();
q('#resume-task').addEventListener('change',()=>q('#task-dialog').close());
q('#default-path').onclick=guarded(async()=>{q('#task-destination').value='';await chrome.storage.local.remove('collectorPopupDraft');render();});

async function remember(){
 if(resumeOptions)return;
 const value=options();value.duplicate_policy='fill';value.destination=null;
 await chrome.storage.local.set({collectorLastOptions:{options:value,kind:q('#collection-mode').value,scope:q('#scope').value,videoMode}});
}
q('#restore-defaults').onclick=guarded(async()=>{await chrome.storage.local.remove(['collectorLastOptions','collectorPopupDraft']);showOptions(defaults);q('#scope').value='current';render();});
async function chooseFolder(){
 if(picking)return;
 const value=options();
 picking=true;render();UI.message(q('#folder-status'),'正在打开系统窗口；若未出现，可直接输入路径。');
 const requestId=crypto.randomUUID();
 await chrome.storage.local.set({collectorPopupDraft:{requestId,tabId:currentTab.id,picking:true,options:value,scope:q('#scope').value,kind:q('#collection-mode').value,videoMode,expires:Date.now()+15*60000}});
 try{const r=await chrome.runtime.sendMessage({type:'CHOOSE_TASK_FOLDER',requestId});if(!r?.ok)throw new Error(r?.error||'无法选择文件夹');const state=await chrome.storage.local.get(['collectorPopupDraft']);if(state.collectorPopupDraft?.requestId!==requestId)return;if(!r.cancelled){q('#task-destination').value=r.directory;}q('#folder-dialog').close();}
 catch(e){UI.message(q('#folder-status'),'系统选择未完成，请直接输入路径后使用。');q('#diagnostic-text').textContent=e.message;}
 finally{picking=false;render();}
}
q('#choose-folder').onclick=guarded(async()=>{folderBefore=q('#task-destination').value;q('#folder-dialog').showModal();await chooseFolder();});
q('#choose-folder-more').onclick=guarded(chooseFolder);
q('#folder-apply').onclick=guarded(async()=>{const path=q('#task-destination').value.trim();if(path&&!/^(?:[a-z]:[\\/]|\\\\)/i.test(path))throw new Error('请填写完整的绝对路径');await chrome.storage.local.set({collectorPopupDraft:{tabId:currentTab.id,picking:false,options:options(),scope:q('#scope').value,kind:q('#collection-mode').value,videoMode,expires:Date.now()+15*60000}});picking=false;await remember();q('#folder-dialog').close();render();});
q('#folder-cancel').onclick=guarded(async()=>{q('#task-destination').value=folderBefore;await chrome.storage.local.remove('collectorPopupDraft');picking=false;q('#folder-dialog').close();render();});
q('#folder-dialog').addEventListener('cancel',guarded(async()=>{q('#task-destination').value=folderBefore;await chrome.storage.local.remove('collectorPopupDraft');picking=false;render();}));
q('#pause').onclick=guarded(async()=>{await chrome.runtime.sendMessage({type:'CONTROL_COLLECTOR',action:control==='paused'?'running':'paused'});await update();});
q('#stop').onclick=guarded(async()=>{await chrome.runtime.sendMessage({type:'CONTROL_COLLECTOR',action:'stopped'});await update();});
q('#approve').onclick=()=>chrome.runtime.sendMessage({type:'APPROVE_DOWNLOAD',approve:true});q('#reject').onclick=()=>chrome.runtime.sendMessage({type:'APPROVE_DOWNLOAD',approve:false});
q('#reset').onclick=guarded(async()=>{const r=await chrome.runtime.sendMessage({type:'RESET_COLLECTOR'});if(!r?.ok)throw new Error(r?.error||'任务未完成');await update();UI.message(q('#status'),r.stopping?'已请求停止；若仍无响应，请在扩展管理页重新加载。已保存文件和批量断点保留。':'已解除卡住状态');});
q('#end-task').onclick=guarded(async()=>{const r=await chrome.runtime.sendMessage({type:'END_BATCH'});if(!r?.ok)throw new Error(r?.error);resumeOptions=null;q('#resume-task').checked=false;await update();});
q('#resume-task').onchange=guarded(async()=>{if(q('#resume-task').checked){if(!checkpoint||checkpoint.completed)throw new Error('没有未完成任务，请在管理页选择历史任务。');resumeOptions={...checkpoint.options,...(checkpoint.options.destination||checkpoint.root?{destination:checkpoint.options.destination||checkpoint.root}:{})};showOptions(resumeOptions);q('#scope').value='bulk';}else{resumeOptions=null;showOptions(defaults);}render();});
document.addEventListener('uilanguage',render);
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;const d=changes.collectorPopupDraft?.newValue;if(d?.tabId===currentTab?.id&&d.expires>Date.now()){picking=Boolean(d.picking);q('#task-destination').value=d.options.destination||'';render();if(d.error)error(new Error(d.error));}if(['liblibActiveJob','liblibProgress','collectorApproval','liblibControl','collectorCheckpoint'].some(k=>k in changes))update().catch(error);});
guarded(async()=>{
 [currentTab]=await chrome.tabs.query({active:true,currentWindow:true});site=CollectorSite.context(currentTab?.url||'');
 const health=await Hub.api('/health'),hello=await chrome.runtime.sendMessage({type:'COLLECTOR_HELLO'});
 if(health.version!==BUILD||hello?.build!==BUILD)throw new Error('扩展或保存服务版本不一致，请更新并重新加载扩展');
 defaults=await Hub.defaults();defaultPath=health.inbox;showOptions(defaults);q('#version').textContent=chrome.runtime.getManifest().version;
 const s=await chrome.storage.local.get(['collectorNextAction','collectorResumeRequested','collectorCheckpoint','collectorPopupDraft','collectorLastOptions']);
 const last=s.collectorLastOptions;if(last){showOptions({...last.options,destination:null});q('#collection-mode').value=last.kind;q('#scope').value=last.scope;videoMode=last.videoMode;}
 const d=s.collectorPopupDraft;if(d?.tabId===currentTab.id&&d.expires>Date.now()){showOptions(d.options);q('#collection-mode').value=d.kind;q('#scope').value=d.scope;videoMode=d.videoMode;picking=Boolean(d.picking)&&d.expires>Date.now()+12*60000;}
 if(s.collectorNextAction?.url?.split('?')[0]===currentTab?.url?.split('?')[0]){q('#duplicate-policy').value='refresh';await chrome.storage.local.remove('collectorNextAction');}
 if(s.collectorResumeRequested&&s.collectorCheckpoint&&!s.collectorCheckpoint.completed){resumeOptions={...s.collectorCheckpoint.options,...(s.collectorCheckpoint.options.destination||s.collectorCheckpoint.root?{destination:s.collectorCheckpoint.options.destination||s.collectorCheckpoint.root}:{})};showOptions(resumeOptions);q('#resume-task').checked=true;q('#scope').value='bulk';await chrome.storage.local.remove('collectorResumeRequested');}
 if(health.library_configured===false){await chrome.runtime.openOptionsPage();UI.message(q('#status'),'请先在设置页选择素材库位置');return;}
 ready=true;await update();if(d?.tabId===currentTab.id&&d.expires>Date.now()&&d.error)error(new Error(d.error));
})();
