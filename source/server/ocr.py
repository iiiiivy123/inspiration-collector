"""Local Windows OCR; images never leave the computer."""
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageOps

def recognize(path):
    if os.name != 'nt': return {'status':'unavailable','text':'','error':'Windows OCR is unavailable on this system'}
    try:
        with tempfile.TemporaryDirectory(prefix='inspiration-ocr-') as folder:
            prepared = Path(folder) / 'input.png'
            with Image.open(path) as original:
                image = ImageOps.exif_transpose(original).convert('RGB')
                image.thumbnail((2400, 2400))
                image.save(prepared)
            result = subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-File',str(Path(__file__).with_suffix('.ps1')),'-ImagePath',str(prepared)], capture_output=True, encoding='utf-8', errors='replace', timeout=40, creationflags=subprocess.CREATE_NO_WINDOW)
            if result.returncode: raise RuntimeError(result.stderr[:500])
            value = json.loads(result.stdout.lstrip('\ufeff').strip())
            value['text'] = re.sub(r'(?<=[\u4e00-\u9fff]) +(?=[\u4e00-\u9fff])', '', value.get('text', ''))
            return value
    except Exception as error:
        return {'status':'failed','text':'','error':str(error)[:500]}
