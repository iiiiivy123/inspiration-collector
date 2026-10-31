import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'source'))
from server.retention import prune_finished
from server.video import VideoDownloads
from unittest.mock import patch


class RetentionTests(unittest.TestCase):
    def test_bounded_results_preserve_running_and_paused_work(self):
        jobs = {str(i): {'status': 'completed', 'finished_at': i} for i in range(1000)}
        jobs.update(running={'status': 'running'}, paused={'status': 'paused'})
        prune_finished(jobs, now=1000)
        self.assertEqual(len(jobs), 102)
        self.assertIn('900', jobs)
        self.assertIn('999', jobs)
        self.assertIn('running', jobs)
        self.assertIn('paused', jobs)
        prune_finished(jobs, now=5000)
        self.assertEqual(set(jobs), {'running', 'paused'})

    def test_paused_download_resumes_and_stale_client_stops(self):
        downloads = VideoDownloads()
        downloads.jobs['one'] = dict(status='running', control='running', lease=100)
        with patch('server.video.time.monotonic', return_value=110):
            downloads.control('one', 'paused')
            self.assertTrue(downloads.busy())
            with patch('server.video.time.sleep', side_effect=lambda _: downloads.control('one', 'running')):
                downloads._point('one')
            self.assertEqual(downloads.jobs['one']['status'], 'running')
        with patch('server.video.time.monotonic', return_value=156):
            with self.assertRaises(InterruptedError):
                downloads._point('one')
        self.assertIn('one', downloads.jobs)
