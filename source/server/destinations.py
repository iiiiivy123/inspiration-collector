"""One destination policy shared by images, downloaded videos and extracted frames."""
import hashlib
import re
import json
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qs

def safe(value):
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', '_', value).strip(' ._')[:80] or '未命名'
    return '_' + name if re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', name, re.I) else name

def source_key(url):
    u = urlsplit(url)
    if u.hostname in ('bilibili.com','www.bilibili.com') and re.fullmatch(r'/video/BV[\da-zA-Z]{10}/?',u.path):
        part=parse_qs(u.query).get('p',['1'])[0]
        if not part.isdigit() or not 1<=int(part)<=10000:raise ValueError('无效B站分P编号')
        return urlunsplit(('https','www.bilibili.com',u.path.rstrip('/'),'p='+str(int(part)) if int(part)>1 else '', ''))
    if (u.hostname or '').endswith('xiaohongshu.com'):
        note = re.search(r'/([a-f0-9]{24})/?$', u.path, re.I)
        if note: return 'https://www.xiaohongshu.com/explore/' + note[1]
    return urlunsplit((u.scheme, u.netloc, u.path.rstrip('/'), '', ''))

def resolve_destination(root, value):
    root = Path(value.destination).expanduser() if value.destination else Path(root)
    if not root.is_absolute(): raise ValueError('请使用完整的保存路径')
    root = root.resolve()
    board, author = (None, None) if value.capture_scope == 'single' else (value.board_url, value.author_url)
    if board and author: raise ValueError('不能同时指定画板和作者')
    key = source_key(value.canonical_url)
    page_id = hashlib.sha256(key.encode()).hexdigest()[:12]
    layout = value.layout
    if layout == 'direct':
        return root, True, page_id
    host = urlsplit(value.canonical_url).hostname or ''
    platform = next((name for domain, name in [('bilibili.com','B站'),('xiaohongshu.com','小红书'),('pinterest.com','Pinterest'),('pinterest.cn','Pinterest'),('instagram.com','Instagram'),('x.com','X'),('twitter.com','X'),('huaban.com','花瓣'),('weibo.com','微博'),('weibo.cn','微博')] if host == domain or host.endswith('.' + domain)), '其他网页')
    parent = root / platform if layout in ('platform', 'organized') else root
    organized = layout in ('organized', 'organized_flat')
    if organized and value.directory_schema == 'function-platform-v2':
        purpose = '批量' if board or author else {'text':'图文', 'images':'图片', 'video':'视频'}[value.capture_kind or value.collection_mode]
        parent = root / purpose / platform
    elif organized:
        parent = parent / (('图文' if value.collection_mode == 'text' else '图片') + ('批量' if board or author else '单帖'))
    if layout == 'legacy': parent = root / ('画板采集' if board else '作者采集' if author else '图文采集' if value.collection_mode == 'text' else '普通采集')
    group_url = board or author
    group_name = value.board_name if board else value.author_name if author else None
    identity = hashlib.sha256((source_key(group_url) if group_url else key).encode()).hexdigest()[:12]
    if value.md_only:
        # Separate from existing illustrated notes: never delete or inherit their attachments.
        directory = parent / (safe(group_name or value.page_title or '笔记') + '_纯文字_' + identity)
        if not directory.resolve().is_relative_to(root): raise ValueError('保存路径无效')
        directory.mkdir(parents=True, exist_ok=True)
        return directory, bool(group_url), page_id
    prefix = ('画板_' if board else '作者_' if author else '') if layout == 'legacy' else ''
    directory = next((p for p in parent.glob(f'*_{identity}') if p.is_dir()), None)
    if directory and board and directory.name.startswith('Pinterest_') and group_name and group_name.lower() != 'pinterest':
        directory = None  # Keep legacy files intact; corrected names apply to new captures.
    if not directory:
        for candidate in parent.glob('*'):
            marker = candidate / ('_原始资料' if value.collection_mode == 'text' and value.directory_schema != 'function-platform-v2' else '_来源记录') / 'identity.json'
            if not marker.exists(): marker = candidate / '_来源记录' / 'identity.json'
            try:
                if json.loads(marker.read_text(encoding='utf-8')).get('identity') == identity:
                    directory = candidate; break
            except (OSError, ValueError): pass
    if not directory:
        directory = parent / f'{prefix}{safe(group_name or value.page_title or "网页素材")}'
        if directory.exists(): directory = parent / f'{directory.name}_{identity[:6]}'
    if directory.resolve().parent != parent.resolve() or not directory.resolve().is_relative_to(root): raise ValueError('保存路径无效')
    marker = directory / ('_原始资料' if value.collection_mode == 'text' and value.directory_schema != 'function-platform-v2' else '_来源记录') / 'identity.json'
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(json.dumps({'identity': identity}, ensure_ascii=False), encoding='utf-8')
    return directory, bool(group_url), page_id

def text_assets(directory, value, page_id):
    parent = directory / '_原始资料'
    existing = next((p for p in parent.glob(f'*_{page_id}') if p.is_dir()), None)
    return existing or parent / f'{safe(value.page_title or "未命名笔记")}_{page_id}'
