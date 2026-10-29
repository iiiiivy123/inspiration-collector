// Read only media belonging to the open post from already-loaded page state.
// CAT-LOGUE's pure parsers are used under MIT; no network hooks or requests.
(() => {
  const host = location.hostname, path = location.pathname;
  const xhs = /(^|\.)xiaohongshu\.com$/.test(host);
  const ins = /(^|\.)instagram\.com$/.test(host);
  const x = /(^|\.)(x\.com|twitter\.com)$/.test(host);
  const id = xhs ? path.match(/\/([a-f0-9]{24})\/?$/i)?.[1] : ins ? path.match(/^\/(?:p|reels?)\/([\w-]+)/)?.[1] : x ? path.match(/\/status\/(\d+)/)?.[1] : null;
  if (!id) return {media: []};
  const roots = [];
  if (xhs) {
    const map = window.__INITIAL_STATE__?.note?.noteDetailMap;
    if (map?.[id]) roots.push(map[id]);
  }
  let bytes = 0;
  for (const node of document.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
    const body = node.textContent || '';
    bytes += body.length;
    if (bytes > 4000000) break;
    try { roots.push(JSON.parse(body)); } catch (_) {}
  }
  const stack = roots, seen = new WeakSet();
  let best = [], visits = 0, author_handle;
  while (stack.length && visits++ < 5000) {
    const value = stack.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    let record;
    try {
      // Match identity before invoking a media parser, never collect recommendations.
      if (xhs && String(value.noteId || value.note_id || value.id || '') === id) record = globalThis.XEagleXhs.xhsRecord(value);
      if (ins && String(value.code || value.shortcode || '') === id) {
        record = globalThis.XEagleInstagram.instagramRecord(value);
        const username=value.owner?.username || value.user?.username;
        if(typeof username==='string' && /^[\w.]{1,30}$/.test(username))author_handle=username.toLowerCase();
      }
      if (x && String(value.rest_id || value.id_str || '') === id) record = globalThis.XEagleMedia.tweetRecord(value);
    } catch (_) {}
    if (record?.media?.length > best.length) best = record.media;
    const children = Object.values(value);
    for (let i = 0; i < Math.min(children.length, 500); i++) if (children[i] && typeof children[i] === 'object') stack.push(children[i]);
  }
  return {postId: id, author_handle, media: best.slice(0, 100).filter(item => {
    try {
      const url = new URL(item.url);
      return url.protocol === 'https:' && /(^|\.)(xhscdn\.com|xhscdn\.net|xhsimg\.com|cdninstagram\.com|fbcdn\.net|twimg\.com)$/.test(url.hostname);
    } catch (_) { return false; }
  })};
})();
