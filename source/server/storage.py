from __future__ import annotations

import hashlib
import base64
import json
import mimetypes
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .config import Settings
from .models import ClassifyRequest, CollectRequest, ImageItem
from .destinations import resolve_destination, text_assets
from .ocr import recognize
from .catalog import Catalog, fingerprint
import shutil


def now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def safe(value: str, fallback: str = "untitled") -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", value).strip(" ._")
    if re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', value, re.I): value = '_' + value
    return value[:80] or fallback


class Storage:
    def __init__(self, settings: Settings):
        self.settings = settings
        if settings.library_configured:
            settings.inbox.mkdir(parents=True, exist_ok=True)
        self.catalog = Catalog(settings.root)
        self._collect_lock = threading.Lock()

    def collect(self, request: CollectRequest, progress=lambda _p, _m: None) -> dict[str, object]:
        # Requests for the same author share one index; serialize index updates.
        with self._collect_lock:
            return self._collect(request, progress)

    def _collect(self, request: CollectRequest, progress) -> dict[str, object]:
        if request.md_only:
            return self._collect_markdown_only(request, progress)
        progress(5, "读取网页图片")
        if request.author_url and request.board_url:
            raise ValueError('不能同时指定作者和画板')
        if request.collection_mode == 'text' and not request.body_text.strip() and not request.images:
            raise ValueError('没有可保存的正文或图片')
        page_dir, flat_media, page_id = resolve_destination(self.settings.inbox, request)
        author_dir = page_dir if flat_media else None
        image_dir = page_dir if author_dir else page_dir / "images"
        per_post = request.layout == 'direct' or (flat_media and request.collection_mode == 'text')
        metadata_path = page_dir / (f'metadata_{page_id}.json' if per_post else 'metadata.json')
        if request.collection_mode == 'text':
            asset_dir = text_assets(page_dir, request, page_id)
            image_dir = asset_dir / '图片'
            metadata_path = asset_dir / '来源记录.json'
        elif flat_media:
            metadata_path = page_dir / '_来源记录' / metadata_path.name
            metadata_path.parent.mkdir(parents=True, exist_ok=True)
        existing = self._load(metadata_path, {})
        if not existing and flat_media and request.collection_mode != 'text':
            legacy_path = page_dir / (f'metadata_{page_id}.json' if request.layout == 'direct' else 'metadata.json')
            existing = self._load(legacy_path, {})
        known_images = {item.get("sha256"): item for item in existing.get("images", [])}
        confirmed_files = set()
        saved, warnings = [], list(request.extraction_warnings)
        with ThreadPoolExecutor(max_workers=6) as pool:
            def load(item):
                cached = self.catalog.cached(item.url) if request.duplicate_policy != 'refresh' and not item.data_base64 else None
                return (cached.read_bytes(), cached.suffix) if cached else self._download(item)
            futures = {pool.submit(load, item): item for item in request.images[:100]}
            total = max(len(futures), 1)
            for done, future in enumerate(futures, 1):
                item = futures[future]
                try:
                    data, suffix = future.result()
                    digest = hashlib.sha256(data).hexdigest()
                    if digest in known_images and (page_dir / known_images[digest]['file']).is_file() and fingerprint(page_dir / known_images[digest]['file']) == digest:
                        confirmed_files.add(known_images[digest]["file"])
                        continue
                    filename = f"{page_id}_{digest[:16]}{suffix}" if author_dir else f"{len(known_images) + 1:03d}_{digest[:10]}{suffix}"
                    if item.source_kind == 'video_frame' and item.frame_time is not None:
                        filename = f"frame_{round(item.frame_time * 1000):09d}ms_{digest[:10]}{suffix}"
                    path = image_dir / filename
                    path.parent.mkdir(parents=True, exist_ok=True)
                    if path.exists() and fingerprint(path) != digest:
                        from uuid import uuid4
                        path = path.with_name(path.stem + '_' + uuid4().hex[:8] + path.suffix)
                    if shutil.disk_usage(path.parent).free < len(data) + request.min_free_mb * 1048576:
                        raise OSError('磁盘剩余空间不足，图片未写入')
                    temporary = path.with_suffix(path.suffix + '.part')
                    temporary.write_bytes(data)
                    temporary.replace(path)
                    record = {"file": str(path.relative_to(page_dir)), "sha256": digest, "url": item.url, "alt": item.alt}
                    if item.source_kind == 'video_frame':
                        record.update(source_kind='video_frame', frame_time=item.frame_time)
                    saved.append(record)
                    known_images[digest] = record
                    self.catalog.register_asset(item.url, path, digest)
                    confirmed_files.add(record["file"])
                except Exception as exc:
                    warnings.append(f"{item.url}: {exc}")
                progress(10 + int(done / total * 80), f"保存图片 {done}/{total}")
        merged_images = list(known_images.values())
        metadata = {
            **existing,
            "collection_mode": request.collection_mode,
            "source_url": request.canonical_url,
            "page_title": request.page_title,
            "selected_text": request.selected_text,
            "collected_at": existing.get("collected_at") or now(),
            "updated_at": now(),
            "theme": existing.get("theme") or request.selected_text or request.page_title,
            "classification_status": existing.get("classification_status", "pending"),
            "style_tags": existing.get("style_tags", []),
            "visual_tags": existing.get("visual_tags", []),
            "suitable_for": existing.get("suitable_for", []),
            "images": merged_images,
            "warnings": warnings,
        }
        if author_dir and request.collection_mode != 'text':
            sources = existing.get("sources", {})
            previous = sources.get(page_id, {})
            sources[page_id] = {"source_url": request.canonical_url, "page_title": request.page_title,
                "selected_text": request.selected_text, "updated_at": now(),
                "files": sorted(set(previous.get("files", [])) | confirmed_files)}
            metadata['sources'] = sources
            if request.author_url:
                metadata.update(author_url=request.author_url, author_name=request.author_name,
                    source_url=request.author_url, page_title=request.author_name,
                    theme=existing.get("theme") or request.author_name)
            if request.board_url:
                metadata.pop('author_url', None)
                metadata.pop('author_name', None)
                metadata.update(board_url=request.board_url, board_name=request.board_name,
                    source_url=request.board_url, page_title=request.board_name,
                    theme=existing.get('theme') or request.board_name)
        self._write(metadata_path, metadata)
        markdown_name = f'source_{page_id}.md' if per_post else 'source.md'
        if request.collection_mode == 'text':
            # Incremental comments; toggling comments off must not erase earlier captures.
            comments = { (c.get('author'), c['text']): c for c in existing.get('comments', []) }
            for comment in request.comments:
                comments[(comment.author, comment.text)] = comment.model_dump()
            metadata.update(collection_mode='text', platform=request.platform,
                body_text=request.body_text or existing.get('body_text', ''),
                author_name=request.author_name or existing.get('author_name'),
                published_at=request.published_at or existing.get('published_at'),
                comments=list(comments.values()), comments_status=request.comments_status if request.comments_status != 'not_requested' else existing.get('comments_status', '未开启'))
            for index, image in enumerate(merged_images, 1):
                if request.ocr_enabled and image.get('ocr', {}).get('status') != 'completed':
                    progress(92, f'识别图片文字 {index}/{len(merged_images)}')
                    image['ocr'] = recognize(page_dir / image['file'])
            metadata['ocr_status'] = ('completed' if all(i.get('ocr', {}).get('status') == 'completed' for i in merged_images) else 'partial') if request.ocr_enabled else 'disabled'
            valid_media = set(existing.get('media_files', []))
            for name in request.media_files:
                candidate = (page_dir / name).resolve()
                if candidate.is_relative_to(page_dir.resolve()) and candidate.is_file(): valid_media.add(str(candidate.relative_to(page_dir)))
            metadata['media_files'] = sorted(valid_media)
            markdown_name = existing.get('reading_file') or safe(request.page_title or '未命名笔记') + '.md'
            if not existing.get('reading_file') and (page_dir / markdown_name).exists(): markdown_name = safe(request.page_title or '未命名笔记') + '_' + page_id[:6] + '.md'
            metadata['reading_file'] = markdown_name
            previous_doc = page_dir / markdown_name
            if previous_doc.is_file() and (request.duplicate_policy == 'refresh' or not existing.get('reading_sha256') or fingerprint(previous_doc) != existing.get('reading_sha256')):
                # Preserve an edited or untracked document, rather than overwrite it.
                from uuid import uuid4
                markdown_name = safe(request.page_title or '未命名笔记') + '_' + uuid4().hex[:8] + '.md'
                metadata['reading_file'] = markdown_name
            self._write(metadata_path, metadata)
            self._write_markdown(page_dir, metadata, markdown_name)
            metadata['reading_sha256'] = fingerprint(page_dir / markdown_name)
            self._write(metadata_path, metadata)
        elif existing.get('body_text') or existing.get('comments'):
            self._write_markdown(page_dir, metadata, markdown_name)
        if request.images and not confirmed_files and request.collection_mode != 'text':
            raise RuntimeError(f"图片下载全部失败（{len(warnings)} 张）；请重新加载扩展后重试。{warnings[0] if warnings else ''}")
        progress(100, "保存完成")
        result = {"directory": str(page_dir), "author_directory": str(author_dir) if author_dir else None, "new_images": len(saved), "total_images": len(confirmed_files) if author_dir else len(merged_images), "warnings": warnings}
        result['duplicate_images'] = max(0, len(confirmed_files) - len(saved))
        result['failed_images'] = len(warnings) - len(request.extraction_warnings)
        if request.collection_mode == 'text':
            result['comments_status'] = metadata['comments_status']
            result['ocr_status'] = metadata['ocr_status']
            result['warnings'].append('评论：' + metadata['comments_status'])
            if metadata['ocr_status'] == 'partial': result['warnings'].append('部分图片文字识别未完成，原图保留；请检查 Windows OCR 语言包或查看原图。')
        result['files'] = sorted(confirmed_files)
        if request.collection_mode == 'text':
            result['message'] = f"图文已保存：{markdown_name}\n新增 {len(saved)} 张图片，累计 {len(metadata['comments'])} 条已加载评论\n{page_dir}"
        if warnings:
            result['message'] = str(result.get('message') or f'新增 {len(saved)} 张图片，累计 {len(merged_images)} 张') + '\n提示：' + '\n'.join(warnings)
        if request.collection_mode != 'text':
            result['message'] = f"新增 {len(saved)} 张 · 重复 {result['duplicate_images']} 张 · 失败 {result['failed_images']} 张\n保存位置：{page_dir}"
        coverage = {'images': bool(request.images) and all(i.source_kind=='image' for i in request.images) and result['failed_images'] == 0,
                    'text': request.collection_mode == 'text',
                    'comments': request.comments_requested and bool(metadata.get('comments')),
                    'ocr': request.collection_mode == 'text' and metadata.get('ocr_status') == 'completed'}
        coverage['category'] = 'batch' if request.capture_scope == 'batch' or request.capture_scope is None and (request.author_url or request.board_url) else request.capture_kind or request.collection_mode
        files = list(confirmed_files)
        if request.collection_mode == 'text': files.append(markdown_name)
        try:
            self.catalog.record(request.canonical_url, request.page_title, request.author_name or request.board_name,
                request.collection_mode, page_dir, files, coverage)
        except Exception as exc:
            raise RuntimeError(f'文件已保存，但采集记录写入失败；请勿盲目重采：{exc}') from exc
        return result

    def _collect_markdown_only(self, request, progress):
        if request.collection_mode != 'text' or not request.body_text.strip():
            raise ValueError('纯文字模式没有可保存正文，未生成空文件')
        # Ignore unexpected media fields at the storage boundary, not just in the UI.
        request = request.model_copy(update={'images': [], 'media_files': [], 'ocr_enabled': False, 'capture_kind': 'text'})
        directory, grouped, page_id = resolve_destination(self.settings.inbox, request)
        index_key = hashlib.sha256((str(directory.resolve()) + request.canonical_url).encode()).hexdigest()
        metadata_path = self.settings.root / 'data/inspiration/md-only' / (index_key + '.json')
        old = self._load(metadata_path, {})
        filename = old.get('reading_file') or safe(request.page_title or '笔记') + '_' + page_id + '.md'
        target = directory / filename
        if target.exists() and (not old.get('reading_sha256') or fingerprint(target) != old['reading_sha256']):
            from uuid import uuid4
            filename = safe(request.page_title or '笔记') + '_' + uuid4().hex[:8] + '.md'
        data = {'page_title': request.page_title, 'source_url': request.canonical_url,
                'author_name': request.author_name, 'published_at': request.published_at,
                'body_text': request.body_text, 'images': [], 'warnings': request.extraction_warnings,
                'comments': [c.model_dump() for c in request.comments] if request.comments_requested else [],
                'comments_status': request.comments_status, 'md_only': True,
                'comments_requested': request.comments_requested}
        if shutil.disk_usage(directory).free < len(json.dumps(data).encode()) + request.min_free_mb * 1048576:
            raise ValueError('磁盘剩余空间不足，未保存文档')
        self._write_markdown(directory, data, filename)
        self._write(metadata_path, {'reading_file': filename, 'reading_sha256': fingerprint(directory/filename)})
        self.catalog.record(request.canonical_url, request.page_title, request.author_name, 'text', directory,
                            [filename], {'text': True, 'md_only': True, 'comments': request.comments_requested,
                            'category': 'batch' if grouped else 'text'})
        progress(100, '纯文字已保存')
        return {'directory': str(directory), 'files': [filename], 'new_images': 0, 'total_images': 0,
                'failed_images': 0, 'duplicate_images': 0, 'warnings': list(request.extraction_warnings),
                'message': '纯文字已保存：' + filename}

    @staticmethod
    def _write_markdown(directory: Path, data: dict, filename='source.md') -> None:
        import html
        # Escape page text so Markdown cannot turn captured HTML into active content.
        def plain(value):
            text = html.escape(str(value or ''), quote=False)
            return re.sub(r'([\\`*_{}\[\]()#!|>])', r'\\\1', text)
        lines = [f"# {plain(data.get('page_title'))}", '',
            '来源：' + plain(data['source_url']), '',
            '作者：' + plain(data.get('author_name') or '未识别'), '',
            '发布时间：' + plain(data.get('published_at') or '未识别'), '',
            '## 正文', '', plain(data.get('body_text')), '',
            '## 已加载评论', '', f"已保存 {len(data.get('comments', []))} 条；本次状态：{plain(data.get('comments_status', 'unknown'))}。仅包含已加载内容，不代表全部评论。", '']
        for item in data.get('comments', []):
            lines.extend([f"- {plain(item.get('author') or '未识别作者')}：{plain(item['text'])}", ''])
        if data.get('md_only') and not data.get('comments_requested'):
            lines = lines[:lines.index('## 已加载评论')]
        if not data.get('md_only'):
            lines.extend(['## 图片识别文字', '', '以下为本地 OCR 结果，可能有错字或漏字，请对照原图。', ''])
        for i, item in enumerate(data['images'], 1):
            relative = Path(item['file']).as_posix()
            from urllib.parse import quote
            ocr = item.get('ocr', {})
            lines.extend([f'### 图片 {i}', '', plain(ocr.get('text') or ('未检测到文字' if ocr.get('status') == 'completed' else '文字识别未完成或未启用，请查看原图')), '', f'[查看原图]({quote(relative)})', ''])
        from urllib.parse import quote
        for name in data.get('media_files', []):
            lines.extend([f'[视频附件]({quote(name)})', ''])
        lines.extend(['## 采集提示', '', *[plain(w) for w in data['warnings']]])
        temporary = directory / (filename + '.tmp')
        temporary.write_text('\n'.join(lines), encoding='utf-8')
        temporary.replace(directory / filename)

    def classify(self, folder: str, classification: ClassifyRequest) -> dict[str, object]:
        page_dir = (self.settings.inbox / folder).resolve()
        if self.settings.inbox.resolve() not in page_dir.parents:
            raise ValueError("invalid folder")
        path = page_dir / "metadata.json"
        if (page_dir / '_来源记录' / 'metadata.json').is_file(): path = page_dir / '_来源记录' / 'metadata.json'
        metadata = self._load(path, None)
        if metadata is None:
            raise FileNotFoundError(folder)
        metadata.update(classification.model_dump(), classification_status="classified", updated_at=now())
        self._write(path, metadata)
        return metadata

    def _download(self, item: ImageItem) -> tuple[bytes, str]:
        if item.data_base64:
            if len(item.data_base64) > 40 * 1024 * 1024:
                raise ValueError('image exceeds 30MB')
            data = base64.b64decode(item.data_base64, validate=True)
            suffix = mimetypes.guess_extension(item.content_type or "") or Path(urlparse(item.url).path).suffix or ".jpg"
            return data, ".jpg" if suffix == ".jpe" else suffix.lower()
        if item.source_kind == 'video_frame':
            raise ValueError('video frame data missing')
        request = Request(item.url, headers={"User-Agent": "Mozilla/5.0", "Referer": item.url})
        with urlopen(request, timeout=self.settings.timeout) as response:
            if not response.headers.get_content_type().startswith('image/'):
                raise ValueError('响应不是图片，可能是登录或验证页面，未保存为图片')
            data = response.read(30 * 1024 * 1024 + 1)
            if len(data) > 30 * 1024 * 1024:
                raise ValueError("image exceeds 30MB")
            content_type = response.headers.get_content_type()
        suffix = mimetypes.guess_extension(content_type) or Path(urlparse(item.url).path).suffix or ".jpg"
        if suffix == ".jpe":
            suffix = ".jpg"
        return data, suffix.lower()

    @staticmethod
    def _load(path: Path, default):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return default

    @staticmethod
    def _write(path: Path, value: object) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
        temp.replace(path)
