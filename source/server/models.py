from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from urllib.parse import urlparse
from typing import Literal


class ImageItem(BaseModel):
    url: str
    alt: str | None = None
    data_base64: str | None = None
    content_type: str | None = None
    source_kind: Literal['image', 'video_frame'] = 'image'
    frame_time: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class CommentItem(BaseModel):
    text: str = Field(max_length=10000)
    author: str | None = Field(default=None, max_length=1000)


class CollectRequest(BaseModel):
    md_only: bool = False
    directory_schema: Literal['four-categories-v1', 'function-platform-v2'] = 'four-categories-v1'
    capture_scope: Literal['single', 'batch'] | None = None
    capture_kind: Literal['images', 'text', 'video'] | None = None
    duplicate_policy: Literal['fill', 'skip', 'refresh'] = 'fill'
    min_free_mb: int = Field(default=256, ge=0, le=1048576)
    ocr_enabled: bool = True
    comments_status: str = 'not_requested'
    media_files: list[str] = Field(default_factory=list, max_length=100)
    layout: Literal['legacy', 'platform', 'flat', 'direct', 'organized', 'organized_flat'] = 'organized'
    destination: str | None = None
    collection_mode: Literal['images', 'text'] = 'images'
    platform: str = Field(default='generic', max_length=50)
    body_text: str = Field(default='', max_length=100000)
    published_at: str | None = Field(default=None, max_length=1000)
    comments: list[CommentItem] = Field(default_factory=list, max_length=100)
    comments_requested: bool = False
    extraction_warnings: list[str] = Field(default_factory=list, max_length=20)
    save_directory: str | None = None
    canonical_url: str
    page_title: str | None = None
    selected_text: str | None = None
    author_url: str | None = None
    author_name: str | None = None
    board_url: str | None = None
    board_name: str | None = None
    images: list[ImageItem] = Field(default_factory=list)

    @field_validator("canonical_url")
    @classmethod
    def valid_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme == 'local-video' and len(parsed.netloc) == 64 and all(c in '0123456789abcdef' for c in parsed.netloc) and not parsed.path:
            return value
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("canonical_url must be http(s)")
        return value

    @field_validator("author_url")
    @classmethod
    def valid_author_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cls.valid_url(value)
        parsed = urlparse(value)
        return parsed._replace(query="", fragment="", path=parsed.path.rstrip("/")).geturl()

    @field_validator('board_url')
    @classmethod
    def valid_board_url(cls, value):
        if value is None:
            return None
        parsed = urlparse(value)
        host = parsed.hostname or ''
        parts = [p for p in parsed.path.split('/') if p]
        if parsed.scheme != 'https' or not any(host == d or host.endswith('.' + d) for d in ('pinterest.com', 'pinterest.cn')) or len(parts) not in (2, 3) or parts[0] in ('pin', 'search', 'ideas'):
            raise ValueError('invalid Pinterest board URL')
        return parsed._replace(query='', fragment='', path=parsed.path.rstrip('/')).geturl()


class ClassifyRequest(BaseModel):
    theme: str
    style_tags: list[str] = Field(default_factory=list)
    visual_tags: list[str] = Field(default_factory=list)
    suitable_for: list[str] = Field(default_factory=list)


class DirectoryRequest(BaseModel):
    directory: str


class VideoDownloadRequest(CollectRequest):
    audio_url: str | None = None
    media_kind: Literal['ordinary','bilibili-dash','bilibili-file'] = 'ordinary'
    quality: str | None = None
    max_video_mb: int = Field(default=512, ge=1, le=512)
    approved_bytes: int | None = Field(default=None, ge=0)
    url: str
    canonical_url: str
    page_title: str | None = None
    save_directory: str

    @field_validator('canonical_url')
    @classmethod
    def valid_source(cls, value):
        parsed = urlparse(value)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc:
            raise ValueError('需要原始网页来源')
        return value


class VideoControlRequest(BaseModel):
    action: Literal['running', 'paused', 'stopped']


class CaptureDefaults(BaseModel):
    layout: Literal['organized','organized_flat'] = 'organized'
    collection_mode: Literal['images','text'] = 'images'
    limit: int = Field(default=20, ge=1, le=500)
    video_action: Literal['skip','save','frames'] = 'skip'
    duplicate_policy: Literal['fill','skip','refresh'] = 'fill'
    include_images: bool = True
    include_comments: bool = True
    ocr_enabled: bool = True
    strategy: Literal['slides','interval'] = 'slides'
    interval: float = Field(default=1, ge=0.5, le=60, allow_inf_nan=False)
    min_free_mb: int = Field(default=256, ge=0, le=1048576)
    max_video_mb: int = Field(default=512, ge=1, le=512)


class HistoryLookup(BaseModel):
    url: str = Field(max_length=4000)
    required: list[Literal['images','text','comments','ocr','videos','frames']] = Field(default_factory=list, max_length=6)


class VideoProbe(BaseModel):
    duplicate_policy: Literal['fill','skip','refresh'] = 'fill'
    urls: list[str] = Field(default_factory=list, max_length=100)
    destination: str | None = None
