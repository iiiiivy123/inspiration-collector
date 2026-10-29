/* Single-post, DOM-only adapters. No private API calls, cookie exports or auto paging. */
(() => {
  const hostIs = (host, domain) => host === domain || host.endsWith('.' + domain);
  function platform(host) {
    if (hostIs(host, 'bilibili.com')) return 'bilibili';
    if (hostIs(host, 'xiaohongshu.com')) return 'xhs';
    if (hostIs(host, 'instagram.com')) return 'instagram';
    if (hostIs(host, 'x.com') || hostIs(host, 'twitter.com')) return 'x';
    if (hostIs(host, 'pinterest.com') || hostIs(host, 'pinterest.cn')) return 'pinterest';
    if (hostIs(host, 'huaban.com')) return 'huaban';
    if (hostIs(host, 'weibo.com') || hostIs(host, 'weibo.cn')) return 'weibo';
    return 'generic';
  }
  const configs = {
    xhs: {post: /\/(explore|discovery\/item)\/[a-f0-9]{24}|\/user\/profile\/[a-f0-9]{24}\/[a-f0-9]{24}/i,
      root: '.note-detail-mask,.note-container', gallery: '.media-container,.swiper',
      body: '#detail-desc .note-text,#detail-desc,.note-content .desc', author: '.author-container .username,.author-wrapper .name', comments: '.comment-item', commentBody: '.content,.note-text', time: '.publish-date,time'},
    x: {post: /\/status\/\d+/, root: 'article[data-testid="tweet"]', gallery: '[data-testid="tweetPhoto"]',
      body: '[data-testid="tweetText"]', author: '[data-testid="User-Name"]', comments: '', time: 'time'},
    instagram: {post: /^\/(p|reel|reels)\/[\w-]+/, root: '[role="dialog"] article,main article,article', gallery: '',
      body: 'h1', author: 'header a', comments: 'ul ul li', commentBody: 'span[dir="auto"]', time: 'time'},
    pinterest: {post: /^\/pin\/\d+/, root: '[data-test-id="pin-closeup-container"],[data-test-id="pin-closeup"]', gallery: '[data-test-id="pin-closeup-image"], [data-test-id="pin-image"]',
      body: '[data-test-id="pin-description"],h1', author: '[data-test-id="creator-profile-name"]', comments: '[data-test-id="comment-item"]', commentBody: '[data-test-id="comment-text"]', time: 'time'},
    huaban: {post: /^\/pins\/\d+/, root: '#pin_view,.pin-view,[class*="PinDetail"],[class*="pin-detail"]', gallery: '.main-image,[class*="mainImage"],[class*="image-view"]',
      body: '.description,[class*="description"],h1', author: '.author [class*="name"]', comments: '.comment-item', commentBody: '.content', time: 'time'},
    weibo: {post: /^\/(?:detail\/\d+|status\/[\w]+|\d+\/[A-Za-z0-9]+)\/?$/,
      root: 'article,[class*="Feed_wrap"],.card-wrap', gallery: '[class*="woo-picture"],[class*="picture"],.media-piclist',
      body: '[class*="detail_wbtext"],.weibo-text,.txt', author: '[class*="head_name"],.name', comments: '[class*="CommentItem_wrap"],.comment-item', commentBody: '[class*="text"],.content', time: 'time,[class*="head_info"]'},
    generic: {root: 'article,main,[role="main"]', body: '', author: '[rel="author"],.author', comments: '', time: 'time'}
  };
  function imageUrl(img, kind) {
    // Choose the largest advertised candidate; retain signed query strings.
    const candidates = (img.srcset || '').split(',').map(part => {
      const [url, size] = part.trim().split(/\s+/); return {url, size: parseFloat(size) || 0};
    }).filter(item => /^https?:/.test(item.url)).sort((a, b) => b.size - a.size);
    let value = candidates[0]?.url || img.currentSrc || img.src || '';
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      if (kind === 'x' && url.hostname === 'pbs.twimg.com' && url.pathname.startsWith('/media/')) url.searchParams.set('name', 'orig');
      return url.href;
    } catch (_) { return ''; }
  }
  function pinterestImages(doc, pageUrl) {
    const pinId = new URL(pageUrl).pathname.match(/^\/pin\/(\d+)/)?.[1];
    if (!pinId) return {images: [], inferred: false};
    const eligible = img => {
      try {
        const url = new URL(imageUrl(img, 'pinterest'));
        if (!hostIs(url.hostname, 'pinimg.com') || /avatar|profile|75x75|30x30/.test(url.pathname)) return false;
        const link = img.closest('a[href]');
        const linkedId = link && new URL(link.href, pageUrl).pathname.match(/^\/pin\/(\d+)/)?.[1];
        return (!linkedId || linkedId === pinId) && Math.max(img.naturalWidth || 0, img.width || 0) >= 180;
      } catch (_) { return false; }
    };
    const toImages = nodes => [...new Map(nodes.filter(eligible).map(img => {
      const url = imageUrl(img, 'pinterest'); return [url, {url, alt: img.alt || ''}];
    })).values()];
    // A marker can be the image itself, not necessarily a wrapper containing img.
    const marked = [...doc.querySelectorAll('[data-test-id="pin-closeup-image"],[data-test-id="closeup-image"],[data-test-id="pin-closeup-image-container"]')];
    const explicit = toImages(marked.flatMap(node => node.tagName === 'IMG' ? [node] : [...node.querySelectorAll('img')]));
    if (explicit.length) return {images: explicit, inferred: false};
    // Fallback for product/detail layouts: select only a clearly dominant visible image.
    // Never dump all page images; ties or scrolling into recommendations return no guess.
    const candidates = [...doc.querySelectorAll('img')].filter(eligible).filter(img => !img.closest('[data-test-id="pin"],[data-test-id="related-pins"],[data-test-id="masonry-container"],[role="listitem"]'))
      .map(img => ({img, rect: img.getBoundingClientRect(), style: getComputedStyle(img)}))
      .filter(({rect, style}) => rect.width >= 300 && rect.height >= 350 && rect.top >= -80 && rect.top < innerHeight * .5 && rect.bottom > 0 && style.display !== 'none' && style.visibility !== 'hidden')
      .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);
    if (!candidates.length) return {images: [], inferred: false};
    const area = item => item.rect.width * item.rect.height;
    if (candidates[1] && area(candidates[0]) < area(candidates[1]) * 1.8) return {images: [], inferred: false};
    return {images: toImages([candidates[0].img]), inferred: true};
  }
  function extract(options = {}) {
    const kind = platform(location.hostname), cfg = configs[kind];
    if(kind==='bilibili')throw new Error('B站必须通过专用稿件提取器读取，不采集整页广告或推荐图');
    if (cfg.post && !cfg.post.test(location.pathname)) throw new Error('请单独打开一篇帖子再采集；当前是主页或列表，未保存推荐图。');
    const visible = node => node.getBoundingClientRect().width > 0 && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
    let roots = [...document.querySelectorAll(cfg.root)].filter(visible);
    if (kind === 'x') {
      const id = location.pathname.match(/\/status\/(\d+)/)?.[1];
      roots = roots.filter(node => [...node.querySelectorAll('a[href]')].some(a => a.querySelector('time') && new URL(a.href).pathname.endsWith('/status/' + id)));
    }
    // Nested wrappers are one post; unrelated multiple roots are not.
    roots = roots.filter(node => !roots.some(other => other !== node && other.contains(node)));
    let root = roots.length === 1 ? roots[0] : null;
    if (!root && kind === 'generic') root = document.body;
    const warnings = [];
    if (!root) warnings.push('未定位到单帖正文区域，仅读取本页明确的分享元数据；不会抓取推荐流。');
    const text = node => (node?.innerText || node?.textContent || '').trim().slice(0, 100000);
    const first = selector => selector && root ? root.querySelector(selector) : null;
    const meta = key => document.querySelector(`meta[property="${key}"]`)?.content || '';
    const images = [], seen = new Set();
    const add = (url, alt = '') => {
      if (!/^https?:\/\//.test(url) || seen.has(url) || images.length >= 100) return;
      seen.add(url); images.push({url, alt});
    };
    if (kind === 'pinterest') {
      const found = pinterestImages(document, location.href);
      found.images.forEach(item => add(item.url, item.alt));
      if (found.inferred) warnings.push('本页使用商品详情布局，按显著主图定位，仅保存这一张；请核对结果。');
    }
    if (root && kind !== 'pinterest') {
      const galleries = cfg.gallery ? [...root.querySelectorAll(cfg.gallery)] : [root];
      const nodes = [...new Set(galleries.flatMap(node => node.tagName === 'IMG' ? [node] : [...node.querySelectorAll('img')]))];
      for (const img of nodes) {
        if (img.closest('.comment-item,header,[data-testid="User-Name"],[data-testid="quoteTweet"],ul ul li')) continue;
        const url = imageUrl(img, kind);
        if (/avatar|profile_images|emoji|sticker|qrcode/i.test(url)) continue;
        if (Math.max(img.naturalWidth || 0, img.width || 0) < 180) continue;
        if (kind === 'instagram' && !/\.(cdninstagram\.com|fbcdn\.net)$/.test(new URL(url || location.href).hostname)) continue;
        add(url, img.alt || '');
      }
    }
    // Only use OG on a confirmed post route and when the metadata URL matches this post.
    const ogUrl = meta('og:url');
    let matchingMeta = false;
    try { matchingMeta = new URL(ogUrl).pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, ''); } catch (_) {}
    if (!images.length && matchingMeta && !(root && root.querySelector('video'))) {
      add(meta('og:image'));
      if (images.length) warnings.push('仅取得帖子分享图，不能据此确认轮播全部图片已保存。');
    }
    const canonical = new URL(location.href); canonical.hash = '';
    if (kind !== 'xhs') canonical.search = '';
    const payload = {canonical_url: canonical.href, page_title: text(first('h1,#detail-title')) || document.title,
      images, has_video: Boolean(root?.querySelector('video')), collection_mode: options.collection_mode || 'images', platform: kind, extraction_warnings: warnings};
    if(kind==='instagram' && root) {
      const owner=first('header a[href],h2 a[href]');
      try {
        const u=new URL(owner.href,location.href), name=u.pathname.match(/^\/([\w.]{1,30})\/?$/)?.[1];
        if(hostIs(u.hostname,'instagram.com') && name && !/^(p|reel|reels|explore|accounts)$/i.test(name))payload.author_handle=name.toLowerCase();
      } catch (_) {}
    }
    if (kind !== 'generic') warnings.push('仅采集已加载的正文图片；未加载的轮播请翻页后再次采集，同帖会合并去重。');
    if (payload.collection_mode === 'text') {
      const body = cfg.body ? first(cfg.body) : root;
      payload.body_text = text(body) || (matchingMeta ? meta('og:description') : '');
      payload.author_name = text(first(cfg.author)) || null;
      const time = first(cfg.time);
      payload.published_at = time?.getAttribute('datetime') || text(time) || null;
      payload.comments = [];
      payload.comments_requested = options.include_comments === true;
      payload.ocr_enabled = options.ocr_enabled !== false;
      if (payload.comments_requested && cfg.comments && root) {
        const unique = new Set();
        for (const node of root.querySelectorAll(cfg.comments)) {
          const body = text(node.querySelector(kind==='xhs' ? '.content .note-text,.content,.comment-content,.note-text' : cfg.commentBody));
          if (!body || unique.has(body) || payload.comments.length >= 100) continue;
          unique.add(body);
          payload.comments.push({text: body.slice(0, 10000), author: text(node.querySelector('[class*="author"],[class*="name"],a')) || null});
        }
      }
      payload.comments_status = !payload.comments_requested ? '未开启' : payload.comments.length ? `已读取 ${payload.comments.length} 条（仅已加载）` : !cfg.comments ? '当前平台未支持评论' : '未读取到评论（可能未加载、没有评论或页面结构不匹配）';
      if (payload.comments_requested) warnings.push(cfg.comments ? '评论只包含当前已加载且能识别的部分，不代表全部评论。' : '当前站点尚未适配评论提取，没有把其他帖子当成评论。');
      if (!options.include_images) payload.images = [];
      if (!payload.body_text && !payload.images.length) throw new Error('未识别到正文或正文图片，未保存空文档；请打开帖子详情并展开正文后再试。');
    }
    return payload;
  }
  globalThis.InspirationPlatforms = {platform, imageUrl, extract};
  if (typeof module !== 'undefined') module.exports = {platform, imageUrl, pinterestImages};
})();
