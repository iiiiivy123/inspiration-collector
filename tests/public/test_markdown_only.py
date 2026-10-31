import tempfile
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'source'))
from unittest.mock import patch
from server.config import Settings
from server.storage import Storage
from server.models import CollectRequest, ImageItem, CommentItem


class MarkdownOnlyTests(unittest.TestCase):
    def test_only_md_comments_and_preservation(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Storage(Settings(Path(tmp)))
            req = CollectRequest(canonical_url='https://x.com/fixture/status/123', page_title='纯文字',
                collection_mode='text', md_only=True, body_text='正文\n第二段 ![图](https://example.test/a.png)',
                images=[ImageItem(url='https://example.test/ad.png')], comments=[CommentItem(text='评论')],
                directory_schema='function-platform-v2', capture_scope='single', min_free_mb=0)
            with patch.object(store, '_download', side_effect=AssertionError('must not download')):
                result = store.collect(req)
            folder = Path(result['directory'])
            self.assertEqual([p.suffix for p in folder.rglob('*') if p.is_file()], ['.md'])
            doc = folder/result['files'][0]
            self.assertNotIn('## 已加载评论', doc.read_text(encoding='utf-8'))
            self.assertNotIn('## 图片识别文字', doc.read_text(encoding='utf-8'))
            self.assertNotIn('![图](', doc.read_text(encoding='utf-8'))
            result2 = store.collect(req.model_copy(update={'comments_requested': True, 'comments_status': '已加载'}))
            self.assertEqual(result['files'], result2['files'])
            self.assertIn('评论', doc.read_text(encoding='utf-8'))
            doc.write_text('用户修改', encoding='utf-8')
            result3 = store.collect(req)
            self.assertNotEqual(result['files'], result3['files'])
            self.assertEqual(doc.read_text(encoding='utf-8'), '用户修改')
            self.assertTrue(all(p.suffix=='.md' for p in folder.rglob('*') if p.is_file()))
            self.assertTrue(store.catalog.search(category='text'))
            with self.assertRaisesRegex(ValueError, '正文'):
                store.collect(req.model_copy(update={'body_text': ''}))

if __name__ == '__main__':
    unittest.main()
