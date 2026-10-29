// Keep native selects as value/event sources; render the menu inside the extension.
(() => {
  const controls=[];
  for(const select of document.querySelectorAll('select')) {
    if(select.hidden)continue;
    const wrap=document.createElement('span');wrap.className='rounded-select';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='select-trigger';
    trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    const menu=document.createElement('span');menu.className='select-menu';menu.hidden=true;menu.setAttribute('role','listbox');
    menu.id=(select.id||select.name||'select-'+controls.length)+'-menu';trigger.setAttribute('aria-controls',menu.id);
    select.before(wrap);wrap.append(select,trigger,menu);select.hidden=true;
    const buttons=[...select.options].map(option=>{
      const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.textContent=option.textContent;
      b.addEventListener('click',()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close();refresh();trigger.focus();});menu.append(b);return b;
    });
    function close(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');}
    function refresh(){
      const label=select.selectedOptions[0]?.textContent||'请选择';if(trigger.textContent!==label)trigger.textContent=label;
      const parent=select.closest('label')?.cloneNode(true);parent?.querySelectorAll('select,input,button,.rounded-select').forEach(e=>e.remove());
      const name=select.getAttribute('aria-label')||parent?.textContent.trim()||select.name||select.id;
      trigger.setAttribute('aria-label',name+': '+label);menu.setAttribute('aria-label',name);
      trigger.disabled=select.disabled||Boolean(select.closest('fieldset:disabled'));
      buttons.forEach((b,i)=>{b.disabled=select.options[i].disabled;if(b.textContent!==select.options[i].textContent)b.textContent=select.options[i].textContent;b.setAttribute('aria-selected',String(select.options[i].selected));});
      if(trigger.disabled)close();
    }
    trigger.addEventListener('click',e=>{e.preventDefault();const opening=menu.hidden;controls.forEach(c=>c.close());if(opening){refresh();if(trigger.disabled)return;menu.hidden=false;menu.style.top='calc(100% + 5px)';menu.style.bottom='auto';const boundary=select.closest('main')?.getBoundingClientRect();const box=menu.getBoundingClientRect();if(box.bottom>(boundary?.bottom||innerHeight)&&wrap.getBoundingClientRect().top-box.height>(boundary?.top||0)){menu.style.top='auto';menu.style.bottom='calc(100% + 5px)';}trigger.setAttribute('aria-expanded','true');const selected=buttons[select.selectedIndex];(selected&&!selected.disabled?selected:buttons.find(b=>!b.disabled))?.focus();}});
    wrap.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();close();trigger.focus();return;}
      if(menu.hidden&&e.target===trigger&&['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();trigger.click();return;}
      if(!menu.hidden&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
        e.preventDefault();const enabled=buttons.filter(b=>!b.disabled);if(!enabled.length)return;
        const i=enabled.indexOf(document.activeElement);enabled[e.key==='Home'?0:e.key==='End'?enabled.length-1:(i+(e.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length].focus();
      }
    });
    wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))close();});
    document.addEventListener('click',e=>{if(!wrap.contains(e.target))close();});
    select.addEventListener('change',refresh);controls.push({close,refresh});refresh();
  }
  globalThis.refreshSelects=()=>controls.forEach(c=>c.refresh());
})();
