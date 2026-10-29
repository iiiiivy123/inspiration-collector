(() => {
 const get=id=>document.getElementById(id);
 let ready=false,busy=false,picking=false,configured=true;
 const error=e=>{UI.feedback(get('path-message'),e.message);get('diagnostic-text').textContent=e.message;};
 function sync(){get('change-path').disabled=!ready||busy||picking;get('save-path-button').disabled=!ready||busy||picking;get('open-path').disabled=!ready||!configured;get('use-recommended').disabled=!ready||busy||picking;}
 function show(h){configured=h.library_configured!==false;get('save-path').textContent=h.inbox;get('path-input').value=h.inbox;get('use-recommended').hidden=configured;UI.message(get('library-title'),configured?'素材库位置':'首次使用：选择素材库位置');ready=true;sync();}
 async function save(){
  const state=await chrome.storage.local.get(['liblibActiveJob']);if(state.liblibActiveJob)throw new Error('请先停止采集，再修改保存目录。');
  show(await Hub.api('/settings/directory',{directory:get('path-input').value}));get('path-editor').hidden=true;
  await chrome.storage.local.remove('collectorPopupDraft');UI.message(get('path-message'),'已记住新目录。旧文件保留原位置。');
 }
 get('change-path').onclick=async()=>{
  picking=true;sync();UI.message(get('path-message'),'正在打开系统目录窗口…');
  try{
   const r=await chrome.runtime.sendMessage({type:'CHOOSE_TASK_FOLDER'});if(!r?.ok)throw new Error(r?.error||'无法选择文件夹');
   if(!r.cancelled){get('path-input').value=r.directory;get('path-editor').hidden=false;UI.message(get('path-message'),'请确认：只改变以后保存的位置，不搬迁旧文件。');}
   else UI.message(get('path-message'),'已取消选择，原目录保留。');
  }catch(e){get('path-editor').hidden=false;error(e);}finally{picking=false;sync();}
 };
 get('cancel-path').onclick=()=>{get('path-editor').hidden=true;};
 get('save-path-button').onclick=()=>save().catch(error);
 get('use-recommended').onclick=()=>save().catch(error);
 get('open-path').onclick=()=>Hub.api('/settings/open',{}).catch(error);
 chrome.storage.local.get(['liblibActiveJob']).then(s=>{busy=!!s.liblibActiveJob;sync();});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.liblibActiveJob){busy=!!changes.liblibActiveJob.newValue;sync();}});
 sync();Hub.api('/health').then(show).catch(error);
})();
