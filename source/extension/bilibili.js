// Read only already-loaded page state. Never call private APIs or export cookies.
(() => {
  const bv = value => {try {const u=new URL(value);return /^(www\.)?bilibili\.com$/.test(u.hostname)?u.pathname.match(/^\/video\/(BV[\da-zA-Z]{10})\/?$/)?.[1]:null;}catch(_){return null;}};
  const mediaUrl = (value,cid) => {try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&/(^|\.)bilivideo\.(com|cn)$/.test(u.hostname)&&u.pathname.includes('/'+cid+'/')?u.href:null;}catch(_){return null;}};
  function post(url,state,play) {
    const id=bv(url),video=state?.videoData;
    if(!id||video?.bvid!==id||!/^\d+$/.test(String(video?.owner?.mid||'')))throw Error('未确认当前B站稿件和UP主，未保存广告或推荐内容');
    const part=Number(new URL(url).searchParams.get('p')||1);
    if(!Number.isInteger(part)||part<1)throw Error('无效的分P编号');
    const page=video.pages?.find(p=>p.page===part);
    const cid=String(page?.cid||(part===1?video.cid:'')||'');
    if(!/^\d+$/.test(cid))throw Error('未确认当前分P，未读取视频源');
    const canonical='https://www.bilibili.com/video/'+id+'/' +(part>1?'?p='+part:'');
    const payload={canonical_url:canonical,page_title:video.title+(part>1?' · P'+part+' '+(page.part||''):''),author_name:video.owner.name||String(video.owner.mid),author_handle:String(video.owner.mid),platform:'bilibili',has_video:true,images:[],body_text:video.desc||'',extraction_warnings:[]};
    try{const pic=new URL(video.pic);if(pic.protocol==='https:'&&/(^|\.)hdslb\.com$/.test(pic.hostname))payload.images=[{url:pic.href,alt:'当前稿件封面'}];}catch(_){}
    const data=play?.data;
    let source,error;
    if(!data || (data.cid && String(data.cid)!==cid) || data.is_drm || data.drm_tech_type || data.is_preview)error='播放信息缺失、受保护或仅提供试看；请打开允许保存的视频并播放后重试';
    else if(data.dash){
      const valid=(items,type)=>(items||[]).filter(x=>x&&mediaUrl(x.baseUrl||x.base_url,cid)&&!x.drm&&(!x.mimeType||x.mimeType.startsWith(type+'/')));
      const videos=valid(data.dash.video,'video').filter(x=>/^avc1/i.test(x.codecs||''))
        .sort((a,b)=>(b.height||0)-(a.height||0)||(b.bandwidth||0)-(a.bandwidth||0));
      const audios=valid(data.dash.audio,'audio').filter(x=>/^mp4a/i.test(x.codecs||''))
        .sort((a,b)=>(b.bandwidth||0)-(a.bandwidth||0));
      if(!videos.length||!audios.length)error='未找到完整的兼容视频/音频轨道（AVC/AAC），不会保存无声或不完整视频';
      else source={url:mediaUrl(videos[0].baseUrl||videos[0].base_url,cid),audio_url:mediaUrl(audios[0].baseUrl||audios[0].base_url,cid),media_kind:'bilibili-dash',quality:(videos[0].height||'?')+'p AVC',...pickPage(payload)};
    }else if(data.durl?.length===1){
      const url=mediaUrl(data.durl[0].url,cid);
      if(url && !/\.flv(?:[?#]|$)/i.test(url))source={url,media_kind:'bilibili-file',quality:String(data.quality||'当前'),...pickPage(payload)};
      else error='当前视频源不是支持的完整MP4，未把FLV分段或广告当作视频';
    }else error='当前是多段或未知格式，未保存不完整视频';
    return {payload,source,error};
  }
  function pickPage(p){return {canonical_url:p.canonical_url,page_title:p.page_title};}
  function profile(url,doc) {
    const u=new URL(url),match=u.hostname==='space.bilibili.com'&&u.pathname.match(/^\/(\d+)\/(?:upload\/video|video)\/?$/);
    if(!match)throw Error('请打开B站UP主空间的「投稿 → 视频」列表，再开始批量');
    const root=doc.querySelector('#submit-video-list,.upload-video-list,.upload-list');
    if(!root)throw Error('未识别投稿列表；不会退回抓取整个页面的广告和推荐');
    const urls=new Set();
    for(const a of root.querySelectorAll('a[href]')){
      if(a.closest('[data-ad],[data-is-ad="true"],.ad-card,.ad-report,.bili-video-card__info--ad,aside,.recommend-list'))continue;
      const card=a.closest('.bili-video-card,.small-item,.video-card,.bili-cover-card');
      if(!card)continue;
      if([...card.querySelectorAll('[class*="badge"],[class*="ad-tag"]')].some(n=>/^(广告|推广|商业推广)$/.test((n.textContent||'').trim())))continue;
      const id=bv(a.href);if(id)urls.add('https://www.bilibili.com/video/'+id+'/');
    }
    return {author_url:'https://space.bilibili.com/'+match[1]+'/upload/video',author_name:(doc.querySelector('#h-name,.nickname,.upinfo-detail__top__name')?.textContent||match[1]).trim(),handle:match[1],view:'videos',urls:[...urls]};
  }
  if(typeof module!=='undefined'){module.exports={bv,mediaUrl,post,profile};return;}
  try {
    if(location.hostname==='space.bilibili.com')return profile(location.href,document);
    return post(location.href,window.__INITIAL_STATE__,window.__playinfo__);
  }catch(e){return {error:e.message};}
})();
