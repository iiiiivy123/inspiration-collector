import io
import socket
import sys
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'source'))
from server.image_download import validate_url, SafeImageRedirect, download_image, PublicHTTPConnection, PublicHTTPSConnection
from urllib.request import Request


def addresses(ip):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, 443))]


class ImageDownloadTests(unittest.TestCase):
    def test_connection_pins_checked_address_and_rejects_rebinding(self):
        with patch('server.image_download.socket.getaddrinfo', side_effect=[addresses('8.8.8.8'), addresses('127.0.0.1')]), patch('server.image_download.socket.socket') as socket_factory:
            validate_url('http://example.com/a')
            with self.assertRaises(ValueError):
                PublicHTTPConnection('example.com').connect()
            socket_factory.assert_not_called()
        with patch('server.image_download.socket.getaddrinfo', return_value=addresses('8.8.8.8')), patch('server.image_download.socket.socket') as socket_factory:
            context = MagicMock()
            connection = PublicHTTPSConnection('example.com', context=context)
            connection.connect()
            socket_factory.return_value.connect.assert_called_once_with(('8.8.8.8', 443))
            context.wrap_socket.assert_called_once_with(socket_factory.return_value, server_hostname='example.com')
    def test_non_public_destinations_rejected(self):
        for ip in ('127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '192.168.1.1', '0.0.0.0'):
            with self.subTest(ip=ip), patch('server.image_download.socket.getaddrinfo', return_value=addresses(ip)):
                with self.assertRaises(ValueError):
                    validate_url('https://example.com/image.png')

    def test_schemes_credentials_and_ports_rejected_before_dns(self):
        with patch('server.image_download.socket.getaddrinfo') as dns:
            for url in ('file:///etc/passwd', 'ftp://example.com/a', 'http://u:p@example.com/a', 'http://example.com:8766/a'):
                with self.subTest(url=url), self.assertRaises(ValueError):
                    validate_url(url)
            dns.assert_not_called()

    def test_redirect_to_localhost_rejected(self):
        with patch('server.image_download.socket.getaddrinfo', return_value=addresses('127.0.0.1')):
            with self.assertRaises(ValueError):
                SafeImageRedirect().redirect_request(Request('https://example.com/a'), None, 302, '', {}, 'http://localhost/a')

    def test_response_validation(self):
        for mime, size, data, success in (
            ('image/png', '3', b'png', True), ('text/html', '3', b'abc', False),
            ('image/png', '4', b'png', False), ('image/png', '31457281', b'', False),
            ('image/png', None, b'', False),
        ):
            with self.subTest(mime=mime, size=size):
                response = MagicMock()
                response.__enter__.return_value = response
                response.status = 200
                response.headers = Message()
                response.headers['Content-Type'] = mime
                if size is not None:
                    response.headers['Content-Length'] = size
                response.read.return_value = data
                with patch('server.image_download.socket.getaddrinfo', return_value=addresses('8.8.8.8')), patch('server.image_download.build_opener') as opener:
                    opener.return_value.open.return_value = response
                    if success:
                        self.assertEqual(download_image('https://example.com/a', 1), (data, mime))
                    else:
                        with self.assertRaises(ValueError):
                            download_image('https://example.com/a', 1)


if __name__ == '__main__':
    unittest.main()
