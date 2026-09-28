# 日序 · Windows 一键启动
# 由根目录的「启动.bat」调用。检测 Node -> 安装 Web 依赖 -> 启动服务 -> 打开浏览器。
# 本文件以 UTF-8 with BOM 保存，确保 Windows PowerShell 5.1 正确显示中文。

param(
  [ValidateRange(1, 65535)]
  [int]$Port = 5173,
  [switch]$NoOpen,
  [switch]$SkipInstall,
  [switch]$Check
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$NodeRequirement = "20.19+ 或 22.12+（不支持 21）"
$AppUrl = "http://localhost:$Port/"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Write-Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Write-Ok($text) { Write-Host "    $text" -ForegroundColor Green }
function Write-Warn2($text) { Write-Host "    $text" -ForegroundColor Yellow }
function Write-Err($text) { Write-Host "    $text" -ForegroundColor Red }

function Stop-WithPause($code) {
  Write-Host ""
  Write-Host "按任意键关闭此窗口..." -ForegroundColor DarkGray
  try { $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") } catch { Start-Sleep -Seconds 10 }
  exit $code
}

function Update-PathFromRegistry {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ";"
}

function Get-NodeVersion {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { return $null }
  try {
    $raw = (& node -v 2>$null)
    if (-not $raw) { return $null }
    return [version]($raw.ToString().TrimStart("v").Trim())
  } catch { return $null }
}

function Test-SupportedNodeVersion([version]$version) {
  if (-not $version) { return $false }
  if ($version.Major -eq 20) { return $version -ge [version]"20.19.0" }
  if ($version.Major -eq 21) { return $false }
  if ($version.Major -eq 22) { return $version -ge [version]"22.12.0" }
  return $version.Major -ge 23
}

function Get-WslRepositoryInfo([string]$path) {
  $match = [regex]::Match($path, '^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\?(.*)$', 'IgnoreCase')
  if (-not $match.Success) { return $null }
  return @{
    Distro = $match.Groups[1].Value
    LinuxPath = "/" + ($match.Groups[2].Value -replace '\\', '/').TrimStart('/')
  }
}

Write-Host "======================================" -ForegroundColor White
Write-Host "  日序 · 本地启动" -ForegroundColor White
Write-Host "  数据全部保存在你自己的浏览器中" -ForegroundColor DarkGray
Write-Host "======================================" -ForegroundColor White

# WSL 的 node_modules 包含 Linux 符号链接和平台依赖，不能交给 Windows npm 修改。
$wslRepository = Get-WslRepositoryInfo $RepoRoot
if ($wslRepository) {
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Err "项目位于 WSL，但当前系统找不到 wsl.exe。"
    Stop-WithPause 1
  }

  Write-Step "检测到 WSL 项目，使用 $($wslRepository.Distro) 内的 Node.js"
  Write-Host "    Linux 路径：$($wslRepository.LinuxPath)" -ForegroundColor DarkGray

  $launcherCommand = "node scripts/start-local.mjs --port $Port"
  if ($NoOpen) { $launcherCommand += " --no-open" }
  if ($SkipInstall) { $launcherCommand += " --skip-install" }
  if ($Check) { $launcherCommand += " --check" }

  $wslArgs = @(
    "-d", $wslRepository.Distro,
    "--cd", $wslRepository.LinuxPath,
    "--", "bash", "-lic", $launcherCommand
  )

  & wsl.exe @wslArgs
  $launcherExitCode = $LASTEXITCODE
  if ($launcherExitCode -ne 0) {
    Write-Err "WSL 启动器执行失败（退出码 $launcherExitCode）。"
    Write-Host "    请在 WSL 终端进入 $($wslRepository.LinuxPath) 后安装 Node.js 22 LTS，再重新双击。" -ForegroundColor White
    Stop-WithPause $launcherExitCode
  }
  exit 0
}

Set-Location $RepoRoot

Write-Step "检查 Node.js（支持 $NodeRequirement）"
$nodeVersion = Get-NodeVersion

if (-not $nodeVersion) {
  Write-Warn2 "未检测到 Node.js。"
} elseif (-not (Test-SupportedNodeVersion $nodeVersion)) {
  Write-Warn2 "当前 Node.js $nodeVersion 不在项目支持范围（需要 $NodeRequirement）。"
} else {
  Write-Ok "Node.js $nodeVersion，符合要求。"
}

if (-not (Test-SupportedNodeVersion $nodeVersion)) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err "系统没有 winget，无法自动安装 Node.js。"
    Write-Host ""
    Write-Host "    请从 https://nodejs.org/ 下载 LTS 版本，保持默认选项安装后重新双击。" -ForegroundColor White
    Stop-WithPause 1
  }

  Write-Step "使用 winget 安装 Node.js LTS（如弹出权限确认，请允许）"
  try {
    winget install --id OpenJS.NodeJS.LTS --exact --source winget `
      --accept-package-agreements --accept-source-agreements
  } catch {
    Write-Err "winget 安装过程出错。"
  }

  Update-PathFromRegistry
  $nodeVersion = Get-NodeVersion
  if (-not $nodeVersion) {
    Write-Warn2 "Node.js 可能已安装，但当前窗口尚未识别。请关闭窗口后重新双击「启动.bat」。"
    Stop-WithPause 0
  }
  if (-not (Test-SupportedNodeVersion $nodeVersion)) {
    Write-Err "安装后的版本仍是 $nodeVersion，不在支持范围（需要 $NodeRequirement）。"
    Stop-WithPause 1
  }
  Write-Ok "Node.js $nodeVersion 安装完成。"
}

Write-Step "检查依赖并准备本地服务 $AppUrl"
$launcherArgs = @("scripts/start-local.mjs", "--port", "$Port")
if ($NoOpen) { $launcherArgs += "--no-open" }
if ($SkipInstall) { $launcherArgs += "--skip-install" }
if ($Check) { $launcherArgs += "--check" }

& node @launcherArgs
$launcherExitCode = $LASTEXITCODE
if ($launcherExitCode -ne 0) {
  Write-Err "启动器执行失败（退出码 $launcherExitCode）。"
  Write-Host ""
  Write-Host "    常见原因与处理：" -ForegroundColor White
  Write-Host "    - 网络不通：检查代理后重新双击" -ForegroundColor White
  Write-Host "    - 端口占用：在终端运行「启动.bat -Port 5174」" -ForegroundColor White
  Write-Host "    - Windows 路径异常：把整个项目移动到 C:\\rixu 等短路径" -ForegroundColor White
  Stop-WithPause $launcherExitCode
}

exit 0
