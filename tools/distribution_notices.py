"""Required notices shared by source-runtime and Windows distributions."""
NOTICE_FILES = (
    'docs/third-party-notices.md',
    'docs/CAT-LOGUE-LICENSE.txt',
    'docs/third-party-media.md',
)


def required_notices(root):
    files = [(root / name, name) for name in NOTICE_FILES]
    for source, name in files:
        if not source.is_file() or not source.read_bytes().strip():
            raise ValueError(f'Missing or empty required distribution notice: {name}')
    return files
