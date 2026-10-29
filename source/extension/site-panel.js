(() => {
  function context(value) {
    let u; try { u = new URL(value); } catch (_) { return {site: '未知页面', bulk: null, current: '当前页'}; }
    const host = u.hostname;
    if (/(^|\.)bilibili\.com$/.test(host))return {site:'B站',bulk:host==='space.bilibili.com'?'author':null,current:'当前稿件',hint:'批量仅采UP主投稿视频；广告、推荐和其他UP主内容不保存'};
    if (/(^|\.)instagram\.com$/.test(host)) return {site:'Instagram',bulk:'author',current:'当前帖',hint:'打开作者主页的帖子或 Reels 列表；逐帖核对作者后采集'};
    if (/(^|\.)(x\.com|twitter\.com)$/.test(host)) return {site:'X',bulk:'author',current:'当前帖',hint:'打开作者主页的帖子页；按页面顺序采集本人帖子，不含转帖'};
    if (/(^|\.)xiaohongshu\.com$/.test(host)) return {site: '小红书', bulk: 'author', current: '当前帖', label: '作者全部图', hint: '打开作者主页后低频逐篇采集'};
    if (/(^|\.)pinterest\.(com|cn)$/.test(host)) return {site: 'Pinterest', bulk: 'board', current: '当前 Pin', label: '当前 Board 全部图', hint: '先打开具体画板；只采集画板内的 Pin'};
    if (/(^|\.)huaban\.com$/.test(host)) return {site: '花瓣', bulk: 'author', current: '当前采集', label: '批量图片', hint: '保留原有批量采集流程'};
    return {site: /instagram\.com$/.test(host) ? 'Instagram' : /(^|\.)(x\.com|twitter\.com)$/.test(host) ? 'X' : /weibo\.(com|cn)$/.test(host) ? '微博' : '网页', bulk: null, current: '当前帖', hint: '仅支持当前页采集'};
  }
  globalThis.CollectorSite = {context};
  if (typeof module !== 'undefined') module.exports = {context};
})();
