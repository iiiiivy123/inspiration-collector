"""Public single-work metadata via yt-dlp; no browser cookies or user config."""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

def canonical(value):
    u = urlsplit(value)
    if u.scheme != 'https' or u.username or u.password or u.port not in (None,443):
        raise ValueError('仅接受公开作品的HTTPS地址')
    if u.hostname in ('youtube.com','www.youtube.com','m.youtube.com','youtu.be'):
        identity = u.path.strip('/') if u.hostname == 'youtu.be' else parse_qs(u.query).get('v',[''])[0] if u.path == '/watch' else u.path.removeprefix('/shorts/').strip('/')
        if not re.fullmatch(r'[\w-]{11}', identity):
            raise ValueError('请打开具体YouTube视频或Shorts；不采集频道/播放列表')
        return 'https://www.youtube.com/watch?v='+identity, 'youtube'
    match = re.fullmatch(r'(/\w+/status/\d+)(?:/video/[1-4])?/?',u.path)
    if u.hostname in ('x.com','www.x.com','twitter.com','www.twitter.com') and match:
        return 'https://x.com'+match[1], 'x'
    raise ValueError('成熟解析器目前仅接入X主帖和YouTube单视频')

def pick(data, url, platform):
    from .segmented_media import register
    entries=data.get('entries') or [data]
    sources=[]
    for item in entries[:20]:
        if not item or item.get('has_drm') or item.get('is_live'):
            raise ValueError('不采集受保护内容或正在直播的视频')
        streams=item.get('requested_formats') or [item]
        videos=[s for s in streams if s.get('vcodec') != 'none']
        if len(videos)!=1:raise ValueError('未找到单个可下载视频轨道')
        video=videos[0];audio=next((s for s in streams if s.get('vcodec')=='none' and s.get('acodec') not in ('none',None)),None)
        token = register({**item, 'requested_formats': [video]+([audio] if audio else [])}, url, platform)
        sources.append({'url':video['url'],'resolver_id':token,
                        'media_kind':'resolved',
                        'quality':f"{video.get('width','?')}×{video.get('height','?')}",'kind':item.get('collector_kind','video'),'canonical_url':url,'page_title':item.get('title') or data.get('title'),
                        'author_name':item.get('uploader') or data.get('uploader')})
    if not sources:raise ValueError('当前作品没有可用视频')
    return {'media':sources}

def resolve(value, subtitle_language='auto', captions=True, quality='best'):
    url,platform=canonical(value)
    if quality not in ('best','1080','720','480'):raise ValueError('不支持的清晰度')
    package=Path(os.environ.get('COLLECTOR_YTDLP_PATH',''))
    if not (package/'yt_dlp/__main__.py').is_file():raise ValueError('本机媒体解析组件未就绪，请更新本机后台')
    node=os.environ.get('COLLECTOR_NODE') or shutil.which('node')
    command=[sys.executable,'-X','utf8',str(Path(__file__).with_name('resolve_public_media.py')),str(package),url,node or '',quality]
    env={**os.environ,'PYTHONPATH':str(package),'PYTHONUTF8':'1'}
    try:result=subprocess.run(command,capture_output=True,timeout=100,env=env,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    except subprocess.TimeoutExpired as exc:raise ValueError('作品解析超时，可稍后重试；未开始下载') from exc
    if result.returncode:
        message=result.stderr.decode('utf-8','replace')
        if re.search(r'sign in|login|cookies|private|age.restrict',message,re.I):raise ValueError('站点要求登录或限制访问；当前解析器不导出浏览器登录信息')
        if re.search(r'Requested format.*not available|No video formats',message,re.I):raise ValueError('该作品没有符合清晰度要求的可下载源；可选择最高可用后再试')
        if re.search(r'HTTP Error (403|429)',message,re.I):raise ValueError('站点拒绝或限制当前解析请求（HTTP 403/429），未取得可下载源')
        if re.search(r'timed? ?out|connection|proxy|resolve|network',message,re.I):raise ValueError('媒体解析网络连接失败；浏览器能播放不代表本地解析器能连接该站点')
        if re.search(r'not found|unavailable|deleted',message,re.I):raise ValueError('作品不可用、已删除或限制当前解析器访问')
        raise ValueError('媒体解析失败；解析组件未识别此作品的播放数据')
    data = json.loads(result.stdout)
    result = pick(data,url,platform)
    if platform == 'youtube' and captions:
        from .youtube_captions import fetch
        cues, origin, warning = fetch(data, subtitle_language)
        for source in result['media']:
            source.update(subtitle_cues=cues, subtitle_source=origin, subtitle_warning=warning)
    return result
