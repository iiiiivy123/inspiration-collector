// Pinterest-only snapshot. No changes to the XHS content listener or navigation.
(() => {
  const u = new URL(location.href), parts = u.pathname.split('/').filter(Boolean);
  const reserved = new Set(['pin','search','ideas','today','home','settings','business','_saved','_created']);
  if (!/(^|\.)pinterest\.(com|cn)$/.test(u.hostname) || parts.length < 2 || parts.length > 3 || parts.some(p => reserved.has(p))) return {error: '请打开具体 Board（画板），不是个人主页、搜索或 Pin 详情。'};
  const title = [...document.querySelectorAll('[data-test-id="board-name"], [data-test-id="board-header"] h1, main h1, h1')]
    .filter(n => n.getBoundingClientRect().width > 0)
    .map(n => n.innerText?.trim()).find(t => t && !/^(pinterest|home|首页)$/i.test(t));
  const root = document.querySelector('[data-test-id="board-feed"],[data-test-id="board-pins"],[data-test-id="board-grid"]');
  if (!title || !root) return {error: '没有确认画板标题和画板图片区域，已停止；不会把推荐图片当成画板内容。'};
  const urls = new Set();
  for (const a of root.querySelectorAll('a[href]')) {
    if (!a.querySelector('img') || a.closest('[data-test-id="related-pins"],[data-test-id="more-ideas"],[data-test-id="promoted-pin"]')) continue;
    const pin = new URL(a.href, location.href);
    if (pin.hostname !== u.hostname || !/^\/pin\/\d+\/?$/.test(pin.pathname)) continue;
    pin.search = ''; pin.hash = ''; urls.add(pin.href);
  }
  u.search = ''; u.hash = '';
  return {board_url: u.href.replace(/\/$/, ''), board_name: title, urls: [...urls]};
})();
