"""Opt-in, bounded, read-only discovery of this collector's sidecars."""
import json
import os
from pathlib import Path


def scan(directory):
    root=Path(directory).expanduser()
    if not root.is_absolute() or not root.is_dir(): raise ValueError('请选择存在的采集目录')
    root=root.resolve(); records=[]; errors=0; visited=0
    def walk_error(_error):
        nonlocal errors
        errors+=1
    for folder, dirs, files in os.walk(root, followlinks=False, onerror=walk_error):
        dirs[:]=[d for d in dirs if not (Path(folder)/d).is_symlink() and (Path(folder)/d).resolve().is_relative_to(root)]
        visited+=len(files)+1
        if visited>20000: return records,errors,True
        for name in files:
            if not (name=='来源记录.json' or name=='metadata.json' or name.startswith('metadata_') and name.endswith('.json')): continue
            path=Path(folder)/name
            try:
                if path.stat().st_size>5*1024*1024: raise ValueError('oversize')
                data=json.loads(path.read_text(encoding='utf-8'))
                base=path.parent
                if name=='来源记录.json' and base.parent.name=='_原始资料':base=base.parent.parent
                elif base.name=='_来源记录':base=base.parent
                if data.get('sources'):
                    sources=[(s.get('source_url'),s.get('page_title'),s.get('files',[])) for s in data['sources'].values()]
                else:
                    names=[i['file'] for i in data.get('images',[]) if i.get('file')]
                    if data.get('reading_file'):names.append(data['reading_file'])
                    sources=[(data.get('source_url'),data.get('page_title'),names)]
                for url,title,names in sources:
                    if not url or not url.startswith(('https://','http://')):continue
                    checked=[str((base/n).resolve().relative_to(base.resolve())) for n in names if (base/n).resolve().is_relative_to(base.resolve()) and (base/n).is_file()]
                    if checked:records.append((url,title,data.get('author_name') or data.get('board_name'),data.get('collection_mode','images'),str(base),checked,{}))
            except (OSError,ValueError,TypeError,KeyError,AttributeError):errors+=1
            if len(records)>=5000:return records,errors,True
    return records,errors,False
