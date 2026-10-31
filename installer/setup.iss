#ifndef AppVersion
  #error Build using tools/build_windows.py, which supplies the manifest release version.
#endif
#ifndef PayloadDir
  #define PayloadDir "..\build-windows\payload"
#endif
#ifdef IsolatedTest
  #define ProductId "{{3E8D7E7F-9575-4D0E-96DC-3B5CB58DE7A1}"
  #define ProductName "Inspiration Collector Remediation Test"
  #define LauncherMutex "Local\InspirationCollectorLauncher-RemediationTest"
#else
  #define ProductId "{{293CFEA9-3205-4D70-96E6-A5F7491438CC}"
  #define ProductName "Inspiration Collector"
  #define LauncherMutex "Local\InspirationCollectorLauncher"
#endif
[Setup]
AppId={#ProductId}
AppName={#ProductName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\InspirationCollector
DefaultGroupName={#ProductName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\dist
OutputBaseFilename=InspirationCollector-{#AppVersion}-Windows-x64-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; PrepareToInstall performs idle-only shutdown before checking the same mutex.
UninstallDisplayIcon={app}\InspirationCollector.exe
CloseApplications=no
DisableProgramGroupPage=yes
[Files]
Source: "{#PayloadDir}\InspirationCollector.exe"; DestName: "UpgradeHelper.exe"; Flags: dontcopy
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Excludes: "*.pyc,__pycache__\*,Scripts\*,bin\*"; Flags: ignoreversion recursesubdirs createallsubdirs
[Tasks]
Name: "desktopicon"; Description: "Create desktop shortcut"
[Icons]
#ifndef IsolatedTest
Name: "{userdesktop}\灵感采集"; Filename: "{app}\InspirationCollector.exe"; Tasks: desktopicon
Name: "{group}\灵感采集"; Filename: "{app}\InspirationCollector.exe"
Name: "{group}\使用说明"; Filename: "{sys}\notepad.exe"; Parameters: """{app}\README.txt"""
#endif
[InstallDelete]
Type: files; Name: "{app}\开始使用.html"
Type: files; Name: "{group}\首次安装引导.lnk"
[Run]
Filename: "{sys}\notepad.exe"; Parameters: """{app}\README.txt"""; Description: "Read instructions"; Flags: nowait postinstall skipifsilent
Filename: "{app}\InspirationCollector.exe"; Description: "Start Inspiration Collector"; Flags: nowait postinstall skipifsilent

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code, Attempt: Integer;
begin
  Result := '';
  if not CheckForMutexes('{#LauncherMutex}') then Exit;
  ExtractTemporaryFile('UpgradeHelper.exe');
  if not Exec(ExpandConstant('{tmp}\UpgradeHelper.exe'), '--prepare-upgrade', '', SW_HIDE, ewWaitUntilTerminated, Code) then
  begin
    Result := '无法请求后台安全退出。请在系统托盘退出灵感采集后重试。';
    Exit;
  end;
  if Code = 10 then
    Result := '正在采集或处理请求。请在扩展中结束任务，等待保存完成后重试。'
  else if Code = 11 then
    Result := '旧版（包括 0.5.13）不支持自动安全退出。请在 Windows 右下角托盘右键选择“退出灵感采集”，再重试；无需卸载。'
  else if Code <> 0 then
    Result := '后台尚未确认安全退出，本次未覆盖文件。请在托盘退出后重试。';
  if Result <> '' then Exit;
  for Attempt := 1 to 30 do
  begin
    if not CheckForMutexes('{#LauncherMutex}') then Exit;
    Sleep(100);
  end;
  Result := '后台尚未完全退出，请稍后重试。';
end;

function InitializeUninstall(): Boolean;
begin
  Result := not CheckForMutexes('{#LauncherMutex}');
  if not Result then
    MsgBox('请先在 Windows 托盘退出灵感采集，再卸载。素材库和个人配置将保留。', mbInformation, MB_OK);
end;
