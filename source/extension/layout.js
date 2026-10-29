// Primary actions first; only the compact task status remains sticky.
(() => {
  const q=s=>document.querySelector(s),body=document.body;
  const header=document.createElement('header');header.className='app-header';
  body.prepend(header);header.append(q('h1'));
  const language=document.createElement('select');language.id='ui-language';language.setAttribute('aria-label','Interface language');
  language.innerHTML='<option value="zh">中文</option><option value="en">English</option>';
  header.append(language);
  const status=q('.status-card');header.after(status);status.append(q('#controls'));
  q('#diagnostics summary').textContent='结果详情';
  const options=q('#task-options');
  const current=q('#collect-current'),bulk=q('#collect-author');
  options.before(current,bulk);
  const group=document.createElement('details');group.className='options';group.id='capture-options';
  const summary=document.createElement('summary');summary.textContent='采集选项';group.append(summary);
  options.prepend(group);group.append(q('#batch-options'),q('#text-options'));
  const ocr=document.createElement('label');ocr.className='toggle';ocr.innerHTML='<input id="ocr-enabled" type="checkbox" checked>图片文字识别（本地）';q('#text-options').append(ocr);
  const reset=q('#reset');q('#diagnostics').append(reset);
  q('.subtitle').remove();
})();
