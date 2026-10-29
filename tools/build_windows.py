"""Build an offline per-user Windows installer from fresh, allowlisted inputs."""
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from build_release import build, ROOT

payload = ROOT / 'build-windows/payload'
if payload.exists():
    raise SystemExit('Payload already exists; use a clean reviewed build directory, never merge stale contents.')
media = ROOT/'build-tools/media-minimal'
required = ('ffmpeg.exe','ffprobe.exe','COPYING.LGPLv2.1','LICENSE.md','build-config.txt','ffmpeg-source-611cec792a.zip','MinGW-COPYRIGHT.txt','toolchain-packages.txt')
if not all((media/name).is_file() for name in required):
    raise SystemExit('Missing reviewed minimal media build and corresponding source.')
if hashlib.sha256((media/'ffmpeg-source-611cec792a.zip').read_bytes()).hexdigest() != '52416bfdf2fd346ce2f14e0ac922985d6df4701538e5ee9ddba6d52f6c8a2f4a':
    raise SystemExit('Media source hash mismatch.')
target_media = payload/'media-tools'
target_media.mkdir(parents=True)
for name in required:
    shutil.copy2(media/name,target_media/name)
shutil.copy2(ROOT/'tools/build_media.sh',target_media/'build_media.sh')
shutil.copy2(ROOT/'docs/third-party-media.md',target_media/'README.md')
archive = build('user', ROOT / 'dist')
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        if name.startswith(('extension/', 'server/')):
            z.extract(name, payload)
runtime = payload / 'runtime'
with zipfile.ZipFile(ROOT / 'build-tools/python-3.13.17-embed-amd64.zip') as z:
    z.extractall(runtime)
(runtime / 'python313._pth').write_text('python313.zip\n.\n..\nLib/site-packages\nimport site\n', encoding='ascii')
subprocess.run([sys.executable, '-m', 'pip', 'install', '--no-compile', '--disable-pip-version-check', '--only-binary=:all:', '--platform', 'win_amd64', '--python-version', '3.13', '--implementation', 'cp', '--target', str(runtime/'Lib/site-packages'), '-r', str(ROOT/'source/server/requirements.txt')], check=True)
shutil.copy2(ROOT/'docs/usage.md', payload/'README.md')
(payload/'README.txt').write_text((ROOT/'docs/usage.md').read_text(encoding='utf-8'), encoding='utf-8-sig')
shutil.copy2(ROOT/'DISCLAIMER.md', payload/'DISCLAIMER.md')
subprocess.run([r'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe', '/nologo', '/target:winexe', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', '/out:'+str(payload/'InspirationCollector.exe'), str(ROOT/'installer/Launcher.cs')], check=True)
files={str(p.relative_to(payload)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in payload.rglob('*') if p.is_file()}
assert not any('live-test.' in p or '.sqlite' in p or 'collector-settings.json' in p for p in files)
(ROOT/'build-windows/payload-sha256.json').write_text(json.dumps(files, indent=2), encoding='utf-8')
subprocess.run([str(ROOT/'build-tools/inno/ISCC.exe'), str(ROOT/'installer/setup.iss')], check=True)
print('Installer built. Must smoke-test install, service and uninstall before sharing.')
