"""Build an offline per-user Windows installer from fresh, allowlisted inputs."""
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile
import argparse
from pathlib import Path
from build_release import build, ROOT
from distribution_notices import required_notices

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--work', type=Path, default=ROOT/'build-windows')
parser.add_argument('--output', type=Path, default=ROOT/'dist')
parser.add_argument('--isolated-test', action='store_true', help='Separate test AppId, mutex, pipe and port; never distribute')
args = parser.parse_args()
args.work = args.work.resolve()
args.output = args.output.resolve()
version = json.loads((ROOT/'source/extension/manifest.json').read_text(encoding='utf-8'))['version']
notices = required_notices(ROOT)

payload = args.work / 'payload'
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
archive = build('user', args.output)
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        if name.startswith(('extension/', 'server/')):
            z.extract(name, payload)
runtime = payload / 'runtime'
with zipfile.ZipFile(ROOT / 'build-tools/python-3.13.17-embed-amd64.zip') as z:
    z.extractall(runtime)
(runtime / 'python313._pth').write_text('python313.zip\n.\n..\nLib/site-packages\nimport site\n', encoding='ascii')
subprocess.run([sys.executable, '-m', 'pip', 'install', '--no-compile', '--disable-pip-version-check', '--only-binary=:all:', '--platform', 'win_amd64', '--python-version', '3.13', '--implementation', 'cp', '--target', str(runtime/'Lib/site-packages'), '-r', str(ROOT/'source/server/requirements.txt')], check=True)
shutil.copy2(ROOT/'README.md', payload/'README.md')
shutil.copy2(ROOT/'README_EN.md', payload/'README_EN.md')
(payload/'README.txt').write_text((ROOT/'docs/quick-start.txt').read_text(encoding='utf-8'), encoding='utf-8-sig')
for name in ('usage.md', 'usage-en.md', 'quick-start.txt', 'use-cases.md', 'use-cases-en.md', 'rights-and-privacy.md', 'brand-guide.md', 'press-kit.md', 'launch-copy.md', 'publishing.md', 'demo-script.md', 'remediation-2026-10.md'):
    (payload/'docs').mkdir(exist_ok=True)
    shutil.copy2(ROOT/'docs'/name, payload/'docs'/name)
(payload/'docs/assets').mkdir(exist_ok=True)
for name in ('saved-markdown.png', 'local-capture.gif', 'chrome-loaded.png'):
    shutil.copy2(ROOT/'docs/assets'/name, payload/'docs/assets'/name)
shutil.copy2(ROOT/'DISCLAIMER.md', payload/'DISCLAIMER.md')
for source, name in notices:
    destination = payload / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
subprocess.run([r'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe', '/nologo', '/target:winexe', '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll', *(['/define:ISOLATED_TEST'] if args.isolated_test else []), '/out:'+str(payload/'InspirationCollector.exe'), str(ROOT/'installer/Launcher.cs')], check=True)
files={str(p.relative_to(payload)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in payload.rglob('*') if p.is_file()}
assert not any('live-test.' in p or '.sqlite' in p or 'collector-settings.json' in p for p in files)
for source, name in notices:
    if files.get(name) != hashlib.sha256(source.read_bytes()).hexdigest():
        raise SystemExit('Distribution notice differs: '+name)
if not (runtime/'LICENSE.txt').is_file():
    raise SystemExit('Missing Python runtime license')
(args.work/'payload-sha256.json').write_text(json.dumps(files, indent=2), encoding='utf-8')
label = 'NOT-FOR-DISTRIBUTION-test' if args.isolated_test else f'InspirationCollector-{version}-Windows-x64'
subprocess.run([str(ROOT/'build-tools/inno/ISCC.exe'), '/DAppVersion='+version, '/DPayloadDir='+str(payload), '/O'+str(args.output), '/F'+label+'-Setup', *(['/DIsolatedTest'] if args.isolated_test else []), str(ROOT/'installer/setup.iss')], check=True)
portable = args.output/(label+'-NoInstall.zip')
with zipfile.ZipFile(portable, 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(files):
        archive.write(payload/name, name)
    archive.writestr('NO-INSTALL.txt', 'Run InspirationCollector.exe, then load the extension folder in Chrome. Settings/history are stored in LOCALAPPDATA/InspirationCollector, not beside this executable. This is not a zero-footprint portable build. Never run alongside an installed copy.\n')
artifacts = [args.output/(label+'-Setup.exe'), portable]
(args.output/('SHA256SUMS-'+version+('-test' if args.isolated_test else '')+'.txt')).write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in artifacts), encoding='utf-8')
print('Installer built. Must smoke-test install, service and uninstall before sharing.')
