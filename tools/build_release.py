"""Build user/dev distributions from an explicit code allowlist; never include local data."""
import argparse
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build(channel, output):
    version = json.loads((ROOT/'source/extension/manifest.json').read_text(encoding='utf-8'))['version']
    output.mkdir(parents=True, exist_ok=True)
    target = output / f'inspiration-collector-{version}-{channel}.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for folder, extensions in [('extension', {'.js','.html','.css','.json','.png'}), ('server', {'.py','.txt','.ps1'})]:
            for file in sorted((ROOT/'source'/folder).iterdir()):
                if not file.is_file() or file.suffix not in extensions: continue
                if channel == 'user' and file.name.startswith('live-test.'): continue
                data = file.read_bytes()
                if channel == 'dev' and file.name == 'manage.html' and (ROOT/'source/extension/live-test.html').exists():
                    data = data.decode('utf-8').replace('<!-- LOCAL_DEV_TOOLS -->', '<button id="live-test">Chrome 实测助手</button>').encode('utf-8')
                archive.writestr(f'{folder}/{file.name}', data)
        archive.write(ROOT/'docs/usage.md', '使用说明.md')
        archive.write(ROOT/'DISCLAIMER.md', 'DISCLAIMER.md')
        archive.writestr('PACKAGE-NOTE.txt', 'Source runtime package: requires Python and dependencies. Windows users should download Windows-x64-Setup.exe from Releases instead.\n')
    return target

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--channel', choices=['user','dev'], required=True)
    parser.add_argument('--output', type=Path, default=ROOT/'dist')
    args=parser.parse_args()
    print(build(args.channel,args.output))
