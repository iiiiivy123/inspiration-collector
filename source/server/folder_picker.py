"""Windows native folder selection; never interpolate a path into shell code."""
import base64
import json
import os
import subprocess
import threading
from pathlib import Path

_lock = threading.Lock()


def choose_folder(initial: str) -> dict:
    if os.name != 'nt':
        raise ValueError('本机文件夹选择仅支持 Windows')
    if not _lock.acquire(blocking=False):
        raise ValueError('已有文件夹选择窗口，请先完成或取消')
    script = r'''
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Select capture folder / 选择本次保存文件夹'
$dialog.SelectedPath = $env:COLLECTOR_PICK_INITIAL
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
$owner.StartPosition = 'CenterScreen'
$owner.Width = 1
$owner.Height = 1
try {
  $owner.Show()
  $owner.Activate()
  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
    @{cancelled=$false; directory=$dialog.SelectedPath} | ConvertTo-Json -Compress
  } else { @{cancelled=$true} | ConvertTo-Json -Compress }
} finally { $dialog.Dispose(); $owner.Dispose() }
'''
    try:
        executable = Path(os.environ['SystemRoot']) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
        result = subprocess.run([str(executable), '-NoProfile', '-STA', '-EncodedCommand',
                                 base64.b64encode(script.encode('utf-16-le')).decode('ascii')],
                                env={**os.environ, 'COLLECTOR_PICK_INITIAL': initial},
                                capture_output=True, encoding='utf-8', timeout=120,
                                creationflags=subprocess.CREATE_NO_WINDOW, check=True)
        value = json.loads(result.stdout.lstrip('\ufeff'))
        if not value.get('cancelled') and not Path(value.get('directory', '')).is_dir():
            raise ValueError('所选文件夹不存在，原目录未改变')
        return value
    except subprocess.TimeoutExpired as exc:
        raise ValueError('选择文件夹超时，原目录未改变') from exc
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        raise ValueError('无法打开本机文件夹窗口，原目录未改变') from exc
    finally:
        _lock.release()
