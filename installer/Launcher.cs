using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;
using System.IO.Pipes;
using System.Security.Principal;
using System.Text.RegularExpressions;

internal static class Launcher {
 static Process service; static Mutex mutex;
 static string app=AppDomain.CurrentDomain.BaseDirectory;
#if ISOLATED_TEST
 static string state=Environment.GetEnvironmentVariable("COLLECTOR_TEST_STATE");
 static int port=18767;
 static string mutexName="Local\\InspirationCollectorLauncher-RemediationTest";
#else
 static string state=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"InspirationCollector");
 static int port=8766;
 static string mutexName="Local\\InspirationCollectorLauncher";
#endif
 static bool traySmoke;
 static string launcherSecret=Guid.NewGuid().ToString("N")+Guid.NewGuid().ToString("N");
 static string pipeName="InspirationCollectorUpgrade-"+WindowsIdentity.GetCurrent().User.Value;
 static bool MatchesRelease(string response){
  var version=Regex.Match(File.ReadAllText(Path.Combine(app,"extension","manifest.json")),"\"version\"\\s*:\\s*\"([0-9.]+)\"").Groups[1].Value;
  return version.Length>0&&response.Contains("\"release\":\""+version+"\"");
 }
 static volatile bool upgradeRequested;
 static int upgradeResult=12;
 static ManualResetEvent upgradeDone=new ManualResetEvent(false);
 sealed class LocalClient : WebClient {
  protected override WebRequest GetWebRequest(Uri address){var r=base.GetWebRequest(address);r.Timeout=3000;r.Proxy=null;return r;}
 }
 static string Health(){using(var w=new LocalClient()){return w.DownloadString("http://127.0.0.1:"+port+"/health");}}
 static bool Available(){try{var l=new TcpListener(IPAddress.Loopback,port);l.Start();l.Stop();return true;}catch(SocketException){return false;}}
 static void Start(){
  if(!Available())throw new Exception("本地端口已被占用。请先退出旧版灵感采集，再启动；不会停止其他程序。");
  Directory.CreateDirectory(state);
  var p=new ProcessStartInfo(Path.Combine(app,"runtime","pythonw.exe"),"-B -m server.desktop");
  p.WorkingDirectory=app;p.UseShellExecute=false;p.CreateNoWindow=true;p.RedirectStandardError=true;p.RedirectStandardOutput=true;
  p.EnvironmentVariables["LIBLIB_ROOT"]=state;p.EnvironmentVariables["LIBLIB_COLLECTOR_PORT"]=port.ToString();p.EnvironmentVariables["PYTHONUTF8"]="1";
  p.EnvironmentVariables["COLLECTOR_LAUNCHER_SECRET"]=launcherSecret;
  service=Process.Start(p);service.OutputDataReceived+=(s,e)=>{};service.ErrorDataReceived+=(s,e)=>{};service.BeginOutputReadLine();service.BeginErrorReadLine();
  for(int i=0;i<60;i++){if(service.HasExited)throw new Exception("服务启动失败。请运行安装目录中的诊断命令，或联系维护者。");try{if(Health().Contains("\"status\":\"ok\""))return;}catch(WebException){}Thread.Sleep(200);}
  throw new Exception("服务启动超时，请退出后重试。");
 }
 static int Stop(){
  if(service==null||service.HasExited)return 0;
  try{using(var w=new LocalClient()){
   w.Headers["X-Launcher-Secret"]=launcherSecret;
   w.UploadString("http://127.0.0.1:"+port+"/internal/prepare-upgrade","POST","");
  }}catch(WebException e){var r=e.Response as HttpWebResponse;return r!=null&&r.StatusCode==HttpStatusCode.Conflict?10:12;}
  return service.WaitForExit(15000)&&Available()?0:12;
 }
 static int PrepareUpgrade(){
  try{using(var pipe=new NamedPipeClientStream(".",pipeName,PipeDirection.InOut,PipeOptions.Asynchronous)){
   pipe.Connect(1000);pipe.WriteByte(1);pipe.Flush();var buffer=new byte[1];
   var read=pipe.BeginRead(buffer,0,1,null,null);
   if(!read.AsyncWaitHandle.WaitOne(20000))return 12;
   return pipe.EndRead(read)==1?buffer[0]:12;
  }}catch(TimeoutException){return 11;}catch(IOException){return 12;}
 }
 static void ListenForUpgrade(){
  var thread=new Thread(()=>{
   while(true){try{using(var pipe=new NamedPipeServerStream(pipeName,PipeDirection.InOut,1)){
    pipe.WaitForConnection();if(pipe.ReadByte()!=1)continue;
    upgradeDone.Reset();upgradeRequested=true;
    if(!upgradeDone.WaitOne(18000)){pipe.WriteByte(12);continue;}
    pipe.WriteByte((byte)upgradeResult);pipe.Flush();
   }}catch(IOException){}}
  });thread.IsBackground=true;thread.Start();
 }
 [STAThread] static int Main(string[] args){
#if ISOLATED_TEST
  pipeName+="-RemediationTest";
  if(String.IsNullOrEmpty(state))return 20;
#endif
  if(args.Length==1&&args[0]=="--prepare-upgrade")return PrepareUpgrade();
  if(args.Length==2&&args[0]=="--prepare-upgrade-smoke"){pipeName+="-test-"+int.Parse(args[1]);return PrepareUpgrade();}
  bool upgradeSmoke=args.Length==3&&args[0]=="--upgrade-smoke";
  bool smoke=upgradeSmoke||args.Length==3&&(args[0]=="--smoke"||args[0]=="--tray-smoke");
  traySmoke=smoke&&args[0]=="--tray-smoke";
  try{
   if(smoke){port=int.Parse(args[1]);state=Path.GetFullPath(args[2]);Start();var result=Health();if(traySmoke||upgradeSmoke){Application.EnableVisualStyles();if(upgradeSmoke){pipeName+="-test-"+port;ListenForUpgrade();}RunTray();}else Stop();File.WriteAllText(Path.Combine(state,"smoke-result.json"),"{\"release_ok\":"+MatchesRelease(result).ToString().ToLowerInvariant()+",\"service_stopped\":"+Available().ToString().ToLowerInvariant()+"}");return MatchesRelease(result)&&Available()?0:2;}
   bool created;mutex=new Mutex(true,mutexName,out created);
   if(!created){MessageBox.Show("灵感采集已在后台运行。请查看 Windows 右下角托盘图标（可能收在向上的小箭头里）；右键可打开使用说明或退出。");return 0;}
   Application.EnableVisualStyles();Start();ListenForUpgrade();
   RunTray();return 0;
  }catch(Exception e){Stop();if(smoke){Directory.CreateDirectory(state);File.WriteAllText(Path.Combine(state,"smoke-error.txt"),e.ToString());}else MessageBox.Show(e.Message,"灵感采集启动失败",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
  finally{Stop();if(mutex!=null)mutex.Dispose();}
 }
 static void OpenReadme(){Process.Start(new ProcessStartInfo("notepad.exe", "\""+Path.Combine(app,"README.txt")+"\""){UseShellExecute=true});}
 static void RunTray(){
  using(var tray=new NotifyIcon())using(var menu=new ContextMenuStrip())using(var check=new System.Windows.Forms.Timer()){
   tray.Icon=SystemIcons.Application;tray.Text="灵感采集 · 后台运行";tray.ContextMenuStrip=menu;tray.Visible=true;
   menu.Items.Add("使用说明（安装、保存与更新）",null,(s,e)=>OpenReadme());
   menu.Items.Add("打开扩展文件夹",null,(s,e)=>Process.Start(new ProcessStartInfo("explorer.exe","\""+Path.Combine(app,"extension")+"\""){UseShellExecute=true}));
   EventHandler copy=(s,e)=>{var data=new DataObject();data.SetData(DataFormats.UnicodeText,false,Path.Combine(app,"extension"));Clipboard.SetDataObject(data,true,5,100);};
   menu.Items.Add("复制扩展文件夹地址",null,copy);
   menu.Items.Add(new ToolStripSeparator());
   EventHandler exit=(s,e)=>{
    try{if(!service.HasExited&&Health().Contains("\"busy\":true")){MessageBox.Show("正在采集，请先在扩展中停止任务，再退出。","灵感采集");return;}}
    catch(WebException){}
    var stopped=Stop();if(stopped!=0){MessageBox.Show("后台仍有任务或尚未安全退出，请稍后重试。","灵感采集");return;}Application.ExitThread();
   };
   menu.Items.Add("退出灵感采集",null,exit);
   tray.DoubleClick+=(s,e)=>OpenReadme();
   if(traySmoke){bool copied=false;check.Interval=500;check.Tick+=(s,e)=>{try{if(Application.OpenForms.Count!=0||!tray.Visible)throw new Exception("Tray must run without a main window");if(!copied){copy(s,e);copied=true;return;}check.Stop();if(Clipboard.GetText()!=Path.Combine(app,"extension"))throw new Exception("Wrong extension directory");exit(s,e);}catch(Exception error){check.Stop();File.WriteAllText(Path.Combine(state,"tray-error.txt"),error.ToString());Stop();Application.ExitThread();}};check.Start();}
   else {check.Interval=250;check.Tick+=(s,e)=>{if(!upgradeRequested)return;upgradeRequested=false;upgradeResult=Stop();upgradeDone.Set();if(upgradeResult==0){check.Stop();var finish=new System.Windows.Forms.Timer();finish.Interval=500;finish.Tick+=(a,b)=>{finish.Stop();finish.Dispose();Application.ExitThread();};finish.Start();}};check.Start();}
   Application.Run();tray.Visible=false;
  }
 }
}
