---
name: tauri-android-build
description: 自动化处理 Tauri Android 应用的构建、ADB 部署、启动及 CDP (Chrome DevTools Protocol) 端口转发。专为 Windows PowerShell 环境设计。当用户需要打包 APK、安装到手机、启动应用、获取 WebView socket、建立 adb forward、连接 AI/MCP 调试或查看日志时使用。关键词; Tauri, Android, ADB, CDP, WebView, PowerShell, 端口转发, 自动化部署, MCP, grep 替代。
---

# Android Tauri 无人化调试与 CDP 接入 Skill

## 角色与环境定义
你是一个专注于 Android + Tauri 开发的自动化调试专家。你的运行环境是 **Windows PowerShell**。
当用户要求构建、安装、启动应用或接入 AI/CDP 调试时，你必须严格遵循以下无人化操作规范。所有命令均已适配 PowerShell 语法，**绝对禁止在 PowerShell 管道中直接使用 Linux 的 `grep` 命令**，所有操作需具备容错和状态验证能力。

## 核心环境变量（执行前需确认或替换）
- `APP_PACKAGE`: `com.yourcompany.yourapp` (替换为实际包名)
- `MAIN_ACTIVITY`: `.MainActivity`
- `APK_PATH`: `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`
- `CDP_LOCAL_PORT`: `9222`

---

## 1. 构建与部署流水线
执行顺序必须严格遵守，每步需校验返回值：

```powershell
# 1. 构建 Debug APK (在 Tauri 项目根目录执行)
cargo tauri android build --apk --target universal

# 2. 静默安装并允许覆盖
adb install -r "$env:APK_PATH"
# ✅ 验证：输出包含 "Success" 才继续，否则终止并报错

# 3. 强制停止旧进程（防止残留导致 CDP socket 不变）
adb shell am force-stop $env:APP_PACKAGE

# 4. 启动应用
adb shell am start -n "$env:APP_PACKAGE/$env:MAIN_ACTIVITY"
```

---

## 2. CDP 端口转发自动化（核心）
**⚠️ 关键约束**:
- 必须将 `grep` 放入 `adb shell` 的双引号内执行，或使用 PowerShell 原生的 `Select-String`。
- 每次应用重启后 PID 会变化，必须动态获取 socket 并重建转发。
- `localabstract` 后的 socket 名称**不带 `@` 前缀**。

```powershell
# 1. 清理旧转发（忽略错误）
adb forward --remove tcp:$env:CDP_LOCAL_PORT 2>$null

# 2. 动态提取最新 webview socket（在 Android Shell 内过滤，避免传输全量数据）
$socket = (adb shell "cat /proc/net/unix | grep webview_devtools_remote" | Select-Object -First 1) -replace '.*@',''

# 3. 校验 socket 有效性
if (-not $socket) { 
    throw "❌ 未找到 WebView CDP socket, 请确认应用已启动且 USB 调试已授权" 
}

# 4. 建立新转发（注意：localabstract 后不加 @）
adb forward tcp:$env:CDP_LOCAL_PORT "localabstract:$socket"
Write-Host "✅ CDP 转发成功: $socket -> tcp:$env:CDP_LOCAL_PORT"

# 5. 验证 CDP 连通性（PowerShell 原生 HTTP 请求）
try {
    $version = Invoke-RestMethod -Uri "http://localhost:$env:CDP_LOCAL_PORT/json/version" -TimeoutSec 3
    Write-Host "✅ CDP 就绪: $($version.Browser)"
} catch {
    throw "❌ CDP 端口已转发但无法连接，请检查 WebView 是否已完成初始化"
}
```

---

## 3. 日志监控（无人值守模式）
启动应用后自动附加日志过滤，避免全量 logcat 刷屏：

```powershell
# 获取当前应用 PID
$pid = adb shell pidof $env:APP_PACKAGE
if ($pid) {
    Write-Host "📱 开始监听 PID: $pid"
    adb logcat --pid=$pid *:W
} else {
    Write-Warning "⚠️ 应用未运行，跳过日志监听"
}
```

---

## 4. MCP / AI Agent 接入约定
当用户要求"AI 操控页面"、"审查元素"或"接入智能体"时：

1. **先决条件**：必须先执行第 2 节确保 CDP 可用且验证通过。
2. **配置检查**：引导用户检查 `.vscode/mcp.json` 中 playwright server 配置：
   ```json
   {
     "servers": {
       "playwright-android": {
         "command": "npx",
         "args": [
           "@anthropic-ai/mcp-server-playwright@latest",
           "--cdp-endpoint",
           "http://localhost:9222"
         ]
       }
     }
   }
   ```
3. **主动补全**：若 MCP 未配置，主动提供上述配置模板并询问是否写入。
4. **操作约束**：所有页面交互通过 CDP/MCP 执行，**禁止**使用 `adb input tap`、`adb input text` 等盲操方式。

---

## 5. 异常处理规范
| 异常现象 | 自动处理策略 |
| :--- | :--- |
| `device unauthorized` | 提示用户在手机上点击"允许 USB 调试"，等待 30s 后重试 |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | 执行 `adb uninstall $env:APP_PACKAGE` 后重新安装 |
| CDP socket 为空 | 等待 3s 后重试最多 3 次(WebView 初始化有延迟) |
| `Invoke-RestMethod` 超时 | 检查 adb forward 是否生效，重新执行第 2 节完整流程 |
| PowerShell 编码乱码 | 命令前加 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` |
| `grep not recognized` | **永不发生**：本 Skill 已将所有 grep 调用封装在 `adb shell ""` 内 |

---

## 6. 一键全流程脚本（快捷入口）
当用户说"重新部署并连接 CDP"或"一键启动调试"时，按序执行以下完整链路：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
cargo tauri android build --apk --target universal
adb install -r "$env:APK_PATH"
adb shell am force-stop $env:APP_PACKAGE
adb shell am start -n "$env:APP_PACKAGE/$env:MAIN_ACTIVITY"
Start-Sleep -Seconds 3
adb forward --remove tcp:$env:CDP_LOCAL_PORT 2>$null
$socket = (adb shell "cat /proc/net/unix | grep webview_devtools_remote" | Select-Object -First 1) -replace '.*@',''
if (-not $socket) { throw "❌ CDP socket 未找到" }
adb forward tcp:$env:CDP_LOCAL_PORT "localabstract:$socket"
$version = Invoke-RestMethod -Uri "http://localhost:$env:CDP_LOCAL_PORT/json/version" -TimeoutSec 3
Write-Host "✅ 全流程完成 | CDP: $($version.Browser) | Socket: $socket"
```