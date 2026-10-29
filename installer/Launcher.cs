using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
using System.Drawing;

internal static class Launcher {
 static Process service; static Mutex mutex;
 static string app=AppDomain.CurrentDomain.BaseDirectory;
 static string state=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"InspirationCollector");
 static int port=8766;
 static bool traySmoke;
 static string Health(){using(var w=new WebClient()){return w.DownloadString("http://127.0.0.1:"+port+"/health");}}
 static bool Available(){try{var l=new TcpListener(IPAddress.Loopback,port);l.Start();l.Stop();return true;}catch(SocketException){return false;}}
 static void Start(){
  if(!Available())throw new Exception("本地端口已被占用。请先退出旧版灵感采集，再启动；不会停止其他程序。");
  Directory.CreateDirectory(state);
  var p=new ProcessStartInfo(Path.Combine(app,"runtime","pythonw.exe"),"-B -m uvicorn server.app:app --host 127.0.0.1 --port "+port+" --no-access-log");
  p.WorkingDirectory=app;p.UseShellExecute=false;p.CreateNoWindow=true;p.RedirectStandardError=true;p.RedirectStandardOutput=true;
  p.EnvironmentVariables["LIBLIB_ROOT"]=state;p.EnvironmentVariables["LIBLIB_COLLECTOR_PORT"]=port.ToString();p.EnvironmentVariables["PYTHONUTF8"]="1";
  service=Process.Start(p);service.OutputDataReceived+=(s,e)=>{};service.ErrorDataReceived+=(s,e)=>{};service.BeginOutputReadLine();service.BeginErrorReadLine();
  for(int i=0;i<60;i++){if(service.HasExited)throw new Exception("服务启动失败。请运行安装目录中的诊断命令，或联系维护者。");try{if(Health().Contains("\"status\":\"ok\""))return;}catch(WebException){}Thread.Sleep(200);}
  throw new Exception("服务启动超时，请退出后重试。");
 }
 static void Stop(){if(service!=null&&!service.HasExited){service.Kill();service.WaitForExit(5000);}}
 [STAThread] static int Main(string[] args){
  bool smoke=args.Length==3&&(args[0]=="--smoke"||args[0]=="--tray-smoke");
  traySmoke=smoke&&args[0]=="--tray-smoke";
  try{
   if(smoke){port=int.Parse(args[1]);state=Path.GetFullPath(args[2]);Start();var result=Health();if(traySmoke){Application.EnableVisualStyles();RunTray();}else Stop();File.WriteAllText(Path.Combine(state,"smoke-result.json"),"{\"release_ok\":"+result.Contains("\"release\":\"0.5.13\"").ToString().ToLowerInvariant()+",\"service_stopped\":"+Available().ToString().ToLowerInvariant()+"}");return result.Contains("\"release\":\"0.5.13\"")&&Available()?0:2;}
   bool created;mutex=new Mutex(true,"Local\\InspirationCollectorLauncher",out created);
   if(!created){MessageBox.Show("灵感采集已在后台运行。请查看 Windows 右下角托盘图标（可能收在向上的小箭头里）；右键可打开使用说明或退出。");return 0;}
   Application.EnableVisualStyles();Start();
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
    Stop();Application.ExitThread();
   };
   menu.Items.Add("退出灵感采集",null,exit);
   tray.DoubleClick+=(s,e)=>OpenReadme();
   if(traySmoke){bool copied=false;check.Interval=500;check.Tick+=(s,e)=>{try{if(Application.OpenForms.Count!=0||!tray.Visible)throw new Exception("Tray must run without a main window");if(!copied){copy(s,e);copied=true;return;}check.Stop();if(Clipboard.GetText()!=Path.Combine(app,"extension"))throw new Exception("Wrong extension directory");exit(s,e);}catch(Exception error){check.Stop();File.WriteAllText(Path.Combine(state,"tray-error.txt"),error.ToString());Stop();Application.ExitThread();}};check.Start();}
   Application.Run();tray.Visible=false;
  }
 }
}
