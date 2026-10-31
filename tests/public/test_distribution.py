"""Offline distribution checks; no personal files or installed service needed."""
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from build_release import build
from distribution_notices import NOTICE_FILES, required_notices


class DistributionTests(unittest.TestCase):
    def test_archive_notices_and_no_personal_data(self):
        with tempfile.TemporaryDirectory() as directory:
            with zipfile.ZipFile(build('user', Path(directory))) as archive:
                for name in NOTICE_FILES:
                    self.assertEqual(archive.read(name), (ROOT / name).read_bytes())
                self.assertFalse(any('live-test.' in name or name.endswith(('.sqlite', '.log'))
                                     for name in archive.namelist()))

    def test_missing_or_empty_notice_stops_build_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for missing in NOTICE_FILES:
                for name in NOTICE_FILES:
                    path = root / name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text('notice' if name != missing else '')
                with self.assertRaisesRegex(ValueError, 'required distribution notice'):
                    required_notices(root)


if __name__ == '__main__':
    unittest.main()
