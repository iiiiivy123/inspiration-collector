"""Exercise HTTP authorization against an isolated server and synthetic data."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class ApiAuthTests(unittest.TestCase):
    server_entry = ['-m', 'uvicorn', 'server.app:app']
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        (Path(cls.temp.name) / 'data/inspiration/inbox').mkdir(parents=True)
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}'
        root = Path(__file__).resolve().parents[2]
        env = {**os.environ, 'LIBLIB_ROOT': cls.temp.name, 'PYTHONPATH': str(root / 'source'),
               'LIBLIB_COLLECTOR_PORT': str(port), 'PYTHONDONTWRITEBYTECODE': '1',
               'COLLECTOR_LAUNCHER_SECRET': 'isolated-test-secret'}
        cls.process = subprocess.Popen([sys.executable, *cls.server_entry,
            '--host', '127.0.0.1', '--port', str(port), '--log-level', 'error'],
            cwd=root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        def stop():
            if cls.process.poll() is None:
                cls.process.terminate()
            cls.process.wait(timeout=10)
        cls.addClassCleanup(stop)
        for _ in range(100):
            try:
                with urlopen(cls.base + '/health', timeout=.2) as response:
                    cls.health = json.load(response)
                assert cls.health['release'] == json.loads((root / 'source/extension/manifest.json').read_text(encoding='utf-8'))['version']
                assert cls.health['version'] == '0.5.0'
                break
            except (URLError, TimeoutError):
                if cls.process.poll() is not None:
                    raise RuntimeError('Isolated server failed to start')
                time.sleep(.1)
        else:
            raise RuntimeError('Isolated server readiness timed out')
        cls.folder = Path(cls.health['inbox']) / 'synthetic-auth-test'
        if not cls.folder.resolve().is_relative_to(Path(cls.temp.name).resolve()):
            raise RuntimeError('Test library escaped the isolated directory')
        cls.folder.mkdir(parents=True)
        cls.metadata = cls.folder / 'metadata.json'
        cls.metadata.write_text('{}', encoding='utf-8')

    def request(self, path, data=None, token=None):
        headers = {'Content-Type': 'application/json'}
        if token is not None:
            headers['X-Collector-Token'] = token
        request = Request(self.base + path, data=None if data is None else json.dumps(data).encode(), headers=headers)
        try:
            with urlopen(request, timeout=3) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_missing_and_wrong_tokens_cannot_read_status_or_classify(self):
        before = self.metadata.read_bytes()
        for token in (None, 'wrong'):
            self.assertEqual(self.request('/collect/status/unknown', token=token)[0], 403)
            self.assertEqual(self.request('/classify/synthetic-auth-test', {'theme': 'changed'}, token)[0], 403)
        self.assertEqual(self.metadata.read_bytes(), before)

    def test_authorized_request_preserves_normal_behavior(self):
        token = self.health['settings_token']
        self.assertEqual(self.request('/collect/status/unknown', token=token)[0], 404)
        self.assertEqual(self.request('/classify/synthetic-auth-test', {'theme': 'authorized'}, token)[0], 200)
        self.assertEqual(json.loads(self.metadata.read_text(encoding='utf-8'))['theme'], 'authorized')


if __name__ == '__main__':
    unittest.main()
