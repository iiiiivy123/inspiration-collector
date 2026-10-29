const q=s=>document.querySelector(s);
if(q('#live-test'))q('#live-test').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('live-test.html')});
const notice=(message,params={})=>UI.message(q('#notice'),message,params);
const guard=fn=>async(...args)=>{try{await fn(...args);}catch(e){UI.feedback(q('#notice'),e.message);q('#diagnostic-text').textContent=e.message;}};
function button(label,action){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',guard(action));return b;}
function line(parent,text,params={}){const p=document.createElement('p');UI.message(p,text,params);parent.append(p);return p;}
let historyRequest=0,taskRequest=0;
function recordView(pending){
 q('#history-content').hidden=pending;q('#tasks').hidden=!pending;
 q('#records-tab').setAttribute('aria-selected',String(!pending));q('#pending-tab').setAttribute('aria-selected',String(pending));
}
q('#records-tab').onclick=()=>recordView(false);
q('#pending-tab').onclick=()=>recordView(true);
async function history(){
  const request=++historyRequest,query=q('#query').value;
  const category=q('#history-category').value,platform=q('#history-platform').value;
  const {items}=await Hub.api('/history?q='+encodeURIComponent(query)+'&category='+encodeURIComponent(category)+'&platform='+encodeURIComponent(platform));
  if(request!==historyRequest||q('#query').value!==query)return;
  q('#history-list').replaceChildren();
  if(!items.length)line(q('#history-list'),'没有匹配的采集记录；旧文件可从下方导入。');
  for(const item of items){
    const row=document.createElement('article');row.className='entry';
    line(row,'{title} · {author} · {mode} · {time}',{title:item.title,author:item.author,mode:{ui:({text:'图文',images:'图片',video:'视频',batch:'批量'})[item.category||item.mode]||'图片'},time:new Date(item.updated*1000).toLocaleString()});
    line(row,'{state} · {directory}',{state:{ui:item.available?'文件存在':'文件已移走、删除或大小改变'},directory:item.directory});
    row.append(button('打开文件夹',()=>Hub.api('/history/'+item.id+'/open',{})),button('打开原帖',()=>chrome.tabs.create({url:item.url})),button('重新采到当前目录',async()=>{
      await chrome.storage.local.set({collectorNextAction:{url:item.url,duplicate_policy:'refresh'}});await chrome.tabs.create({url:item.url});notice('已打开原帖。打开采集面板后确认本次位置并开始；不会删除旧文件。');
    }));q('#history-list').append(row);
  }
}
async function tasks(){
  const request=++taskRequest,{items}=await Hub.api('/tasks');
  const stored=await chrome.storage.local.get(['liblibActiveJob','collectorCheckpoint']);
  if(request!==taskRequest)return;q('#task-list').replaceChildren();
  for(const item of items){
    const row=document.createElement('article');row.className='entry';
    const records=Object.values(item.records||{}),failures=records.filter(r=>['failed','partial'].includes(r.status));
    const running=stored.liblibActiveJob&&Boolean(item.id)&&stored.collectorCheckpoint?.id===item.id;
    if(item.completed&&!failures.length&&!running)continue;
    const filter=q('#task-state').value;
    if(filter==='running'&&!running||filter==='unfinished'&&(running||item.completed)||filter==='completed'&&!item.completed||filter==='failed'&&!failures.length)continue;
    line(row,'{name} · {state} · {count} 篇 · 失败/部分失败 {failures}',{name:item.name||item.source||'',state:{ui:item.completed?'本轮结束':running?'正在运行':'中断／可恢复'},count:records.length,failures:failures.length});
    if(item.directory){const p=document.createElement('p');p.dataset.userContent='';p.textContent=item.directory;row.append(p);}else line(row,'尚未确认保存位置');
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='逐项结果';details.append(summary);
    for(const r of records){const p=document.createElement('p');p.dataset.userContent='';p.textContent=r.status+' · '+(r.url||'').split('?')[0]+' · '+(r.reason||'').replace(/https?:\/\/\S+/g,u=>u.split('?')[0]);details.append(p);}
    row.append(details);
    if(!running&&!item.completed)row.append(button('回原页续采',()=>restore(item,false)));
    if(!running&&failures.length)row.append(button('只重试失败项',()=>restore(item,true)));
    q('#task-list').append(row);
  }
  if(!q('#task-list').children.length)line(q('#task-list'),'暂无匹配的任务记录');
}
async function restore(item,retry){
  const state=await chrome.storage.local.get(['liblibActiveJob']);if(state.liblibActiveJob)throw new Error('请先停止当前任务');
  if(retry&&!Object.values(item.records||{}).some(r=>['failed','partial'].includes(r.status)))throw new Error('没有失败项');
  const checkpoint=structuredClone(item);checkpoint.completed=false;
  if(retry){checkpoint.retryKeys=Object.entries(checkpoint.records).filter(([,r])=>['failed','partial'].includes(r.status)).map(([k])=>k);for(const key of checkpoint.retryKeys)delete checkpoint.records[key];}
  await chrome.storage.local.set({collectorCheckpoint:checkpoint,collectorResumeRequested:true});await chrome.tabs.create({url:checkpoint.source});notice('已恢复任务。打开原页采集面板，确认继续上次任务后开始。');
}
async function approval(){const {collectorApproval:a}=await chrome.storage.local.get(['collectorApproval']);q('#approval').hidden=!a||a.state!=='pending';if(a)UI.feedback(q('#approval-text'),a.message,'等待下载确认');}
q('#approve').onclick=guard(async()=>{await chrome.runtime.sendMessage({type:'APPROVE_DOWNLOAD',approve:true});await approval();});
q('#reject').onclick=guard(async()=>{await chrome.runtime.sendMessage({type:'APPROVE_DOWNLOAD',approve:false});await approval();});
q('#defaults-form').onsubmit=guard(async e=>{
  e.preventDefault();const data={};for(const input of e.target.elements){if(!input.name)continue;data[input.name]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;}
  const submit=e.target.querySelector('[type=submit]');submit.disabled=true;
  try{await Hub.api('/settings/defaults',{...data,layout:'organized',duplicate_policy:'fill'});await chrome.storage.local.remove('collectorLastOptions');notice('默认设置已保存；正在运行的任务不变。');}finally{submit.disabled=false;}
});
q('#query').addEventListener('input',()=>{historyRequest++;});
q('#history-category').onchange=q('#history-platform').onchange=guard(history);
q('#task-state').onchange=guard(tasks);
q('#search-form').onsubmit=guard(async e=>{e.preventDefault();await history();});
q('#refresh-tasks').onclick=guard(tasks);q('#local-video').onclick=()=>chrome.tabs.create({url:chrome.runtime.getURL('video.html')});
let previewToken,previewDirectory,previewRequest=0,importing=false;
function invalidatePreview(){previewRequest++;previewToken=undefined;previewDirectory=undefined;q('#import-confirm').disabled=true;}
q('#import-directory').addEventListener('input',()=>{invalidatePreview();UI.message(q('#import-result'),'目录已改变，请重新预览。');});
q('#import-preview').onclick=guard(async()=>{
  if(importing)return;invalidatePreview();const request=previewRequest,directory=q('#import-directory').value.trim();
  q('#import-preview').disabled=true;
  UI.message(q('#import-result'),'正在预览…');
  try{
    const result=await Hub.api('/history/import/preview',{directory});
    if(request!==previewRequest||directory!==q('#import-directory').value.trim())return;
    previewToken=result.token;previewDirectory=directory;
    UI.message(q('#import-result'),'预览目录：{directory}\n可导入 {count} 条；异常 {errors} 个{limited}',{directory,count:result.count,errors:result.errors,limited:{ui:result.limited?'；已达到扫描上限':''}});
    q('#import-confirm').disabled=!result.count;
  }catch(e){if(request===previewRequest){invalidatePreview();UI.feedback(q('#import-result'),e.message);throw e;}}
  finally{q('#import-preview').disabled=importing;}
});
q('#import-confirm').onclick=guard(async()=>{
  if(importing)return;
  if(!previewToken||previewDirectory!==q('#import-directory').value.trim())throw new Error('请先预览当前目录。');
  const token=previewToken;invalidatePreview();importing=true;
  q('#import-directory').disabled=q('#import-preview').disabled=true;UI.message(q('#import-result'),'正在导入…');
  try{const r=await Hub.api('/history/import/confirm',{token});UI.message(q('#import-result'),'已导入 {count} 条',{count:r.count});await history();}
  catch(e){UI.feedback(q('#import-result'),e.message);throw e;}
  finally{importing=false;q('#import-directory').disabled=q('#import-preview').disabled=false;}
});
chrome.storage.onChanged.addListener(()=>approval().catch(e=>{UI.feedback(q('#notice'),e.message);q('#diagnostic-text').textContent=e.message;}));
guard(async()=>{const d=await Hub.defaults();for(const [k,v]of Object.entries(d)){const input=q('#defaults-form').elements.namedItem(k);if(input)input.type==='checkbox'?input.checked=v:input.value=v;}globalThis.refreshSelects?.();await history();await tasks();await approval();const {liblibProgress:p}=await chrome.storage.local.get(['liblibProgress']);q('#diagnostic-text').textContent=[p?.message,p?.details].filter(Boolean).join('\n');})();
