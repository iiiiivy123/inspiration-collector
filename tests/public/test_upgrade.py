"""Real loopback handshake; synthetic busy state, no installed service touched."""
import json
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import test_api_auth


class DesktopShutdownTests(test_api_auth.ApiAuthTests):
    server_entry = ['-c', '''
import os, threading, time
from pathlib import Path
from server.app import active_urls
from server.desktop import main
active_urls['synthetic-worker'] = 'busy'
def complete():
    marker = Path(os.environ['LIBLIB_ROOT']) / 'finish-test-work'
    while not marker.exists():
        time.sleep(.05)
    active_urls.pop('synthetic-worker')
threading.Thread(target=complete, daemon=True).start()
main()
''']

    def test_z_shutdown_is_authenticated_and_idle_only(self):
        def shutdown(secret):
            request = Request(self.base + '/internal/prepare-upgrade', data=b'',
                              headers={'X-Launcher-Secret': secret})
            try:
                with urlopen(request, timeout=3) as response:
                    return response.status
            except HTTPError as error:
                return error.code
        self.assertEqual(shutdown('wrong'), 403)
        self.assertEqual(shutdown('isolated-test-secret'), 409)
        self.assertIsNone(self.process.poll(), 'Busy service must remain running')
        (Path(self.temp.name) / 'finish-test-work').touch()
        for _ in range(50):
            with urlopen(self.base + '/health', timeout=1) as response:
                if not json.load(response)['busy']:
                    break
            time.sleep(.05)
        self.assertEqual(shutdown('isolated-test-secret'), 200)
        self.assertEqual(self.process.wait(timeout=10), 0, 'Uvicorn should exit normally')
        self.assertTrue(self.metadata.is_file(), 'Shutdown must preserve saved data')
