"""Optional local trimming/audio extraction. Never modifies its source file."""
import math
import os
import shutil
from pathlib import Path
from . import bilibili_media


def transform(source, target, value, checkpoint):
    executable = os.environ.get('COLLECTOR_GIF_FFMPEG') or shutil.which('ffmpeg')
    if not executable or not Path(executable).is_file():
        raise ValueError('缺少本地音频/剪裁组件')
    info = bilibili_media.inspect(source)
    duration = float(info.get('format', {}).get('duration', 0))
    length = duration - value.trim_start - value.trim_end
    if not math.isfinite(duration) or duration <= 0 or length <= .05:
        raise ValueError('跳过开头和结尾后没有有效区间，请减小剪裁时间')
    audio = value.output_format == 'audio'
    if audio and not any(s.get('codec_type') == 'audio' for s in info.get('streams', [])):
        raise ValueError('视频没有可提取的音轨')
    command = [str(executable), '-nostdin', '-v', 'error', '-n', '-protocol_whitelist', 'file', '-i', str(source)]
    # Even -ss 0 can drop the initial keyframe during stream copy. No trim means no seeking.
    if value.trim_start or value.trim_end:
        command += ['-ss', str(value.trim_start), '-t', str(length)]
    if audio:
        command += ['-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '192k', '-f', 'ipod']
    else:
        streams = info.get('streams', [])
        copy_video = not (value.trim_start or value.trim_end) and any(s.get('codec_type') == 'video' and s.get('codec_name') == 'h264' for s in streams)
        copy_audio = not (value.trim_start or value.trim_end) and all(s.get('codec_name') == 'aac' for s in streams if s.get('codec_type') == 'audio')
        command += ['-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'copy' if copy_video else 'libx264']
        if not copy_video:
            command += ['-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p']
        command += ['-c:a', 'copy' if copy_audio else 'aac', '-f', 'mp4']
    command += ['-movflags', '+faststart', str(target)]
    try:
        bilibili_media.run_local(command, checkpoint, timeout=10800)
        result = bilibili_media.inspect(target)
        actual = float(result.get('format', {}).get('duration', 0))
        if abs(actual - length) > max(.3, length * .01):
            raise ValueError('剪裁结果时长不完整')
        types = [s.get('codec_type') for s in result.get('streams', [])]
        if audio and types != ['audio'] or not audio and 'video' not in types:
            raise ValueError('输出轨道不符合所选类型')
        if not audio and any(s.get('codec_name') != ('h264' if s.get('codec_type') == 'video' else 'aac') for s in result.get('streams', [])):
            raise ValueError('输出编码不符合 H.264/AAC')
        return duration
    except BaseException:
        target.unlink(missing_ok=True)
        raise


def trimmed_cues(cues, start, end):
    result = []
    for cue in cues:
        left, right = max(float(cue['start']), start), min(float(cue['end']), end)
        if right > left:
            result.append({**cue, 'start': left-start, 'end': right-start})
    return result
