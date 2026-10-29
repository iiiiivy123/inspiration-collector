const Hub = (() => {
  let health;
  async function api(path, value) {
    health ||= await fetch('http://127.0.0.1:8766/health',{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)throw new Error('保存服务不可用');return r.json();});
    if(path==='/health')return health;
    const response=await fetch('http://127.0.0.1:8766'+path,{method:value===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Collector-Token':health.settings_token},...(value===undefined?{}:{body:JSON.stringify(value)}),signal:AbortSignal.timeout(15000)});
    const body=await response.json();if(!response.ok)throw new Error(typeof body.detail==='string'?body.detail:'本地服务请求失败');if(path==='/settings/directory')health=body;return body;
  }
  function options(d) {return {...d,...(d.md_only?{collection_mode:'text',include_images:false,ocr_enabled:false,video_action:'skip'}:{}),layout:'organized',include_videos:!d.md_only&&d.video_action!=='skip',extract_frames:!d.md_only&&d.video_action==='frames',directory_schema:'function-platform-v2'};}
  async function defaults(){
    let d=await api('/settings/defaults');
    if(!d._configured){
      const {collectorPreferences:p={},collectionMode}=await chrome.storage.local.get(['collectorPreferences','collectionMode']);
      const limit=p.limit==='all'?500:Number(p.limit==='custom'?p.custom:p.limit||20);
      d=await api('/settings/defaults',{...d,layout:['flat','organized_flat'].includes(p.layout)?'organized_flat':'organized',limit:Number.isInteger(limit)&&limit>=1&&limit<=500?limit:20,collection_mode:collectionMode==='text'?'text':'images',video_action:p.videos?(p.frames?'frames':'save'):'skip'});
    }
    return d;
  }
  const size=n=>n==null?'未知':(n/1048576).toFixed(1)+' MB';
  return {api,options,size,defaults,BUILD:'0.5.0'};
})();
