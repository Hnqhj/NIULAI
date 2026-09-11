// 启动改造版 Codex —— 静默启动器
// 双击后以隐藏窗口运行同目录（或内置路径）下的 start-modified-codex.ps1，
// 由脚本负责：同步侧栏适配器 → 确保 Skill Console 服务 → 拉起注入器 →
// 以调试端口启动 Store 版 Codex。若 Codex 已在运行且未开调试端口，脚本会弹窗确认后关闭重启。
using System;
using System.Diagnostics;
using System.IO;

internal static class Launcher
{
    // 项目根目录（脚本链的安装位置；release 打包后可整体拷走，放同目录 scripts 优先）
    private static readonly string[] CandidateRoots = new[]
    {
        "", // 占位：exe 同目录
    };

    [STAThread]
    private static int Main()
    {
        string exeDir = AppDomain.CurrentDomain.BaseDirectory;
        string script = null;
        string workDir = null;

        foreach (var root in CandidateRoots)
        {
            var candidateRoot = root.Length == 0 ? exeDir : root;
            var candidate = Path.Combine(candidateRoot, "scripts", "start-modified-codex.ps1");
            if (File.Exists(candidate))
            {
                script = candidate;
                workDir = candidateRoot;
                break;
            }
        }

        if (script == null)
        {
            NativeError("未找到 start-modified-codex.ps1。请将牛来.exe放在项目根目录，或从项目目录重新构建。");
            return 1;
        }

        var psi = new ProcessStartInfo
        {
            FileName = Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe"),
            Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + script + "\"",
            WorkingDirectory = workDir ?? exeDir,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        Process.Start(psi);
        return 0;
    }

    private static void NativeError(string message)
    {
        MessageBox(message);
    }

    private static void MessageBox(string message)
    {
        // 直接调用 user32，避免引入 WinForms 依赖
        Interop.MessageBoxW(IntPtr.Zero, message, "牛来", 0x10 /* MB_ICONERROR */);
    }

    private static class Interop
    {
        [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
        public static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);
    }
}
