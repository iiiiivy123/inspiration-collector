// Read only already-loaded page state. Never call private APIs or export cookies.
(() => {
  const bv = value => {try {const u=new URL(value);return /^(www\.)?bilibili\.com$/.test(u.hostname)?u.pathname.match(/^\/video\/(BV[\da-zA-Z]{10})\/?$/)?.[1]:null;}catch(_){return null;}};
  const mediaUrl = (value,cid) => {try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&/(^|\.)bilivideo\.(com|cn)$/.test(u.hostname)&&(cid===null||u.pathname.includes('/'+cid+'/')||new RegExp('/'+cid+'[-_]').test(u.pathname))?u.href:null;}catch(_){return null;}};
  function post(url,state,play,quality='best') {
    const id=bv(url),video=state?.videoData;
    if(!id||video?.bvid!==id||!/^\d+$/.test(String(video?.owner?.mid||'')))throw Error('未确认当前B站稿件和UP主，未保存广告或推荐内容');
    const part=Number(new URL(url).searchParams.get('p')||1);
    if(!Number.isInteger(part)||part<1)throw Error('无效的分P编号');
    const page=video.pages?.find(p=>p.page===part);
    const cid=String(page?.cid||(part===1?video.cid:'')||'');
    if(!/^\d+$/.test(cid))throw Error('未确认当前分P，未读取视频源');
    const canonical='https://www.bilibili.com/video/'+id+'/' +(part>1?'?p='+part:'');
    const payload={canonical_url:canonical,page_title:video.title+(part>1?' · P'+part+' '+(page.part||''):''),author_name:video.owner.name||String(video.owner.mid),author_handle:String(video.owner.mid),platform:'bilibili',has_video:true,images:[],body_text:video.desc||'',extraction_warnings:[]};
    try{const pic=new URL(video.pic,'https://www.bilibili.com');if(pic.protocol==='http:')pic.protocol='https:';if(pic.protocol==='https:'&&/(^|\.)hdslb\.com$/.test(pic.hostname))payload.images=[{url:pic.href,alt:'当前稿件封面'}];}catch(_){}
    const data=play?.data;
    let source,error;
    if(!data || (data.cid && String(data.cid)!==cid) || data.is_drm || data.drm_tech_type || data.is_preview)error='播放信息缺失、受保护或仅提供试看；请打开允许保存的视频并播放后重试';
    else if(data.dash){
      // Audio belongs to the matched play-info, but can have an independent CDN resource ID.
      const trackUrl=(x,type)=>[x.baseUrl,x.base_url,...(x.backupUrl||x.backup_url||[])].map(v=>mediaUrl(v,type==='audio'?null:cid)).find(Boolean);
      const valid=(items,type)=>(items||[]).filter(x=>x&&trackUrl(x,type)&&!x.drm&&(!(x.mimeType||x.mime_type)||String(x.mimeType||x.mime_type).toLowerCase().startsWith(type+'/')));
      const allVideos=valid(data.dash.video,'video');
      const codec=x=>x.codecs||({7:'avc1',12:'hev1',13:'av01'})[x.codecid]||'';
      const videos=allVideos.filter(x=>/^(avc1|hev1|hvc1|av01)/i.test(codec(x))&&(quality==='best'||x.height&&x.height<=Number(quality)))
        .sort((a,b)=>(b.height||0)-(a.height||0)||Number(/^avc1/.test(codec(b)))-Number(/^avc1/.test(codec(a)))||(b.bandwidth||0)-(a.bandwidth||0));
      const audios=valid(data.dash.audio,'audio').filter(x=>/^mp4a/i.test(x.codecs||''))
        .sort((a,b)=>(b.bandwidth||0)-(a.bandwidth||0));
      if(!videos.length||!audios.length)error=`当前分P ${cid}：网页提供视频 ${data.dash.video?.length||0} 条、音轨 ${data.dash.audio?.length||0} 条；来源校验后视频 ${allVideos.length} 条，符合清晰度的 MP4 视频 ${videos.length} 条、AAC ${audios.length} 条。音轨诊断：${(data.dash.audio||[]).map((x,i)=>`#${i+1} ${x.drm?'受保护':!trackUrl(x,'audio')?'无受支持的主/备用地址':(x.mimeType||x.mime_type)&&!String(x.mimeType||x.mime_type).toLowerCase().startsWith('audio/')?'媒体类型非音频':!/^mp4a/i.test(x.codecs||'')?'编码未识别为AAC':'可用'}（${String(x.codecs||'未标注').replace(/[^\w.]/g,'')}）`).join('；')}。视频编码：${[...new Set((data.dash.video||[]).map(v=>String(v.codecs||v.codecid||'未标注').replace(/[^\w.]/g,'')))].join('、')||'无'}。未保存不完整视频；音轨不可用时，改变视频画质不能解决音轨问题。`;
      else source={url:trackUrl(videos[0],'video'),audio_url:trackUrl(audios[0],'audio'),media_kind:'bilibili-dash',quality:(videos[0].height||'?')+'p '+(/^avc1/i.test(codec(videos[0]))?'AVC':/^av01/i.test(codec(videos[0]))?'AV1':'HEVC'),...pickPage(payload)};
    }else if(data.durl?.length===1){
      const url=mediaUrl(data.durl[0].url,cid);
      if(url && !/\.flv(?:[?#]|$)/i.test(url))source={url,media_kind:'bilibili-file',quality:String(data.quality||'当前'),...pickPage(payload)};
      else error='当前视频源不是支持的完整MP4，未把FLV分段或广告当作视频';
    }else error='当前是多段或未知格式，未保存不完整视频';
    return {payload,source,error};
  }
  function pickPage(p){return {canonical_url:p.canonical_url,page_title:p.page_title};}
  function article(url,doc,state){
    const u=new URL(url),id=u.pathname.match(/^\/(?:opus\/(\d+)|read\/cv(\d+))\/?$/);
    if(!id||! /^(www\.)?bilibili\.com$/.test(u.hostname))throw Error('请打开具体B站图文或专栏');
    const root=doc.querySelector('.opus-module-content,.article-content,#read-article-holder');
    if(!root)throw Error('图文正文尚未加载或当前结构未支持，未抓取页面推荐内容');
    const owner=doc.querySelector('.opus-module-author a[href*="space.bilibili.com"],a.opus-module-author__name[href],.up-info a[href*="space.bilibili.com"],.author-container a[href*="space.bilibili.com"],.article-up-info a[href*="space.bilibili.com"],.up-info-container a[href*="space.bilibili.com"]');
    let handle=owner?.href?.match(/space\.bilibili\.com\/(\d+)/)?.[1],authorName=owner?.textContent?.trim()||'';
    // Opus pages use a detail/basic record and an array of modules, unlike dynamic feeds.
    const detail=state?.detail,basic=detail?.basic;
    const loadedId=detail?.id_str||detail?.opus_id||basic?.opus_id||state?.opusId||state?.opus_id;
    let samePage=false;
    try{const canonical=doc.querySelector('link[rel="canonical"]')?.href||doc.querySelector('meta[property="og:url"]')?.content;samePage=new URL(canonical,u).pathname.replace(/\/$/,'')===u.pathname.replace(/\/$/,'');}catch(_){}
    const detailMatches=id[1]&&(loadedId?String(loadedId)===id[1]:samePage);
    if(detailMatches){
      const author=Array.isArray(detail.modules)?detail.modules.find(m=>m.module_author)?.module_author:detail.modules?.module_author;
      const uid=basic?.uid||author?.mid;
      if(/^\d+$/.test(String(uid||''))){handle ||= String(uid);authorName ||= author?.name||'';}
    }
    // Only accept loaded state bound to this exact article, never a recommended author.
    const stack=[state],seenState=new Set();let visits=0;
    while(stack.length&&visits++<3000){
      const node=stack.pop();if(!node||typeof node!=='object'||seenState.has(node))continue;seenState.add(node);
      const matches=id[1]?String(node.id_str||node.id||node.opus_id||'')===id[1]:String(node.id||node.cvid||'')===id[2];
      if(matches){const author=(Array.isArray(node.modules)?node.modules.find(m=>m.module_author)?.module_author:node.modules?.module_author)||node.author||node.authorInfo;
        if(/^\d+$/.test(String(author?.mid||''))){handle ||= String(author.mid);authorName ||= author.name||'';}}
      for(const child of Object.values(node))if(child&&typeof child==='object')stack.push(child);
    }
    const images=[],seen=new Set();
    for(const img of root.querySelectorAll('img')){
      if(img.closest('.video-card,.opus-module-video,[data-ad],.ad-report,.emoji'))continue;
      const raw=img.getAttribute('data-src')||img.currentSrc||img.getAttribute('src');
      try{const image=new URL(raw,u);if(image.protocol==='http:')image.protocol='https:';
        if(image.protocol!=='https:'||!/(^|\.)hdslb\.com$/.test(image.hostname)||seen.has(image.href))continue;
        seen.add(image.href);images.push({url:image.href,alt:img.alt||''});
      }catch(_){}
    }
    const body=root.cloneNode(true);
    for(const node of body.querySelectorAll('script,style,.video-card,.opus-module-video,[data-ad],.ad-report'))node.remove();
    const payload={canonical_url:u.origin+u.pathname,page_title:(doc.querySelector('.opus-module-title,h1,.title-container')?.textContent||doc.title).trim(),
      author_name:authorName,author_handle:handle,platform:'bilibili',has_video:false,
      images,body_text:(body.innerText||body.textContent||'').trim(),extraction_warnings:[],author_diagnostic:handle?'':`正文已加载；作者链接未识别；文章数据${detail?'存在':'缺失'}，页面身份${detailMatches?'匹配':'尚未匹配'}，作者模块${Array.isArray(detail?.modules)?'数组':typeof detail?.modules}。`};
    if(!payload.body_text&&!payload.images.length)throw Error('未找到图文正文或图片');
    if(root.querySelector('.video-card,.opus-module-video'))payload.extraction_warnings.push('正文内嵌视频不自动下载，请进入该视频页面保存。');
    return {payload};
  }
  function profile(url,doc) {
    const locationUrl=new URL(url);
    if(/^\/\d+\/upload\/(opus|article)/.test(locationUrl.pathname)||/^\/read\/readlist\/rl\d+/.test(locationUrl.pathname))return articleList(url,doc);
    const u=new URL(url),match=u.hostname==='space.bilibili.com'&&u.pathname.match(/^\/(\d+)\/(?:upload\/video|video|lists\/\d+)\/?$/);
    if(!match)throw Error('请打开B站UP主空间的「投稿 → 视频」列表，再开始批量');
    const root=doc.querySelector('#submit-video-list,.upload-video-list,.upload-list,.video-list,.video-section,.video-list-body,.items-list,.video-list__content,main');
    if(!root)throw Error('未识别投稿列表；不会退回抓取整个页面的广告和推荐');
    const urls=new Set();
    for(const a of root.querySelectorAll('a[href]')){
      if(a.closest('[data-ad],[data-is-ad="true"],.ad-card,.ad-report,.bili-video-card__info--ad,aside,.recommend-list'))continue;
      const card=a.closest('.bili-video-card,.small-item,.video-card,.bili-cover-card,.video-list-item,.video-item');
      if(!card)continue;
      if([...card.querySelectorAll('[class*="badge"],[class*="ad-tag"]')].some(n=>/^(广告|推广|商业推广)$/.test((n.textContent||'').trim())))continue;
      const id=bv(a.href);if(id)urls.add('https://www.bilibili.com/video/'+id+'/');
    }
    const owner=(doc.querySelector('#h-name,.nickname,.upinfo-detail__top__name')?.textContent||match[1]).trim(),collection=/\/lists\/\d+/.test(u.pathname);
    return {author_url:u.origin+u.pathname,author_name:owner,handle:match[1],view:'videos',urls:[...urls],list_url:u.origin+u.pathname,list_kind:collection?'collection':'videos',list_owner:owner,list_name:collection?(doc.querySelector('.series-header__title,.collection-title,.list-title,h1')?.textContent||'合集 '+u.pathname.split('/').pop()).trim():'视频'};
  }
  function articleList(url,doc){
    const u=new URL(url),owner=u.hostname==='space.bilibili.com'&&u.pathname.match(/^\/(\d+)\/upload\/(?:opus|article)/);
    const collection=/^(www\.)?bilibili\.com$/.test(u.hostname)&&/^\/read\/readlist\/rl\d+\/?$/.test(u.pathname);
    if(!owner&&!collection)throw Error('请进入具体图文列表或文集');
    const root=doc.querySelector('.article-list,.opus-list,.read-list,.article-list-content,.opus-list-container,.opus-list__content,.upload-opus,.upload-content,.article-list-wrp,.article-list-wrap,.opus-items,main');
    // The route already proves this is a concrete submission list/readlist. Use
    // explicit article cards if a new layout has renamed only its outer wrapper.
    const links=root?[...root.querySelectorAll('a[href]')]:[...doc.querySelectorAll('.bili-opus-card a[href],.opus-card a[href],.article-card a[href],.article-item a[href],.opus-item a[href],.bili-cover-card a[href]')];
    if(!root&&!links.length)throw Error('当前图文列表识别失败，页面结构尚未适配；这不是合集总览');
    const urls=new Set();
    for(const a of links){
      if(a.closest('[data-ad],.ad-report,aside,nav,header,footer,.recommend-list,.recommend'))continue;
      try{const link=new URL(a.href,u);if(/^(www\.)?bilibili\.com$/.test(link.hostname)&&/^\/(opus\/\d+|read\/cv\d+)\/?$/.test(link.pathname))urls.add(link.origin+link.pathname);}catch(_){}
    }
    if(!urls.size)throw Error('当前图文列表未识别到文章链接，请等待列表加载；不会跨文集递归采集');
    const name=(doc.querySelector('.read-list-title,.article-list-title,h1')?.textContent||doc.title).trim();
    const creator=(doc.querySelector('#h-name,.nickname,.list-author,.author-name,.up-info .name')?.textContent||owner?.[1]||'文集作者未识别').trim();
    return {author_url:u.origin+u.pathname,author_name:creator,handle:owner?.[1]||null,view:'articles',urls:[...urls],list_url:u.origin+u.pathname,list_kind:collection?'collection':'works',list_name:collection?name:'图文',list_owner:creator};
  }
  if(typeof module!=='undefined'){module.exports={bv,mediaUrl,post,profile,article,articleList};return;}
  try {
    if(location.hostname==='space.bilibili.com')return profile(location.href,document);
    if(/^\/read\/readlist\/rl\d+/.test(location.pathname))return articleList(location.href,document);
    if(/^\/(opus\/\d+|read\/cv\d+)/.test(location.pathname))return article(location.href,document,window.__INITIAL_STATE__);
    return post(location.href,window.__INITIAL_STATE__,window.__playinfo__,globalThis.__collectorVideoQuality||'best');
  }catch(e){return {error:e.message};}
})();
