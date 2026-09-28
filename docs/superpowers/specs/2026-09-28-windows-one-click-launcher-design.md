# Windows One-Click Launcher Design

## Goal

让 Windows 用户无论从普通磁盘路径还是 `\\wsl.localhost\\Ubuntu\\...` 路径打开项目，都可以双击根目录的 `启动.bat` 启动日序，并自动打开浏览器。

## Behavior

- 默认固定使用 `http://localhost:5173/`，保持与现有 Vite 启动方式相同的浏览器存储来源。
- 普通 Windows 路径使用 Windows Node.js；项目位于 WSL UNC 路径时，转交对应 WSL 发行版中的登录 shell 执行，避免 Windows npm 修改 Linux `node_modules`。
- Node.js 缺失或版本过旧时，Windows 侧通过 `winget` 安装 LTS；WSL 侧给出明确的安装提示。
- 首次运行或 `web/package*.json` 更新后自动执行 `npm install`，其余时间直接启动。
- 直接调用 Vite 的 JavaScript CLI，避免 Windows shell 对 UNC 路径和 npm shim 的兼容问题。
- 保留 `-Port`、`-NoOpen`、`-SkipInstall` 和 `-Check` 参数用于排障。

## Files

- `启动.bat`：ASCII 批处理入口，只负责调用 PowerShell 并保留错误窗口。
- `scripts/start-windows.ps1`：Windows/WSL 路由、Node 检测和中文提示。
- `scripts/start-local.mjs`：跨平台依赖检查、安装和 Vite 启动。
- `scripts/launcher-utils.mjs`：可测试的版本、依赖和 npm CLI 判断。
- `tests/scripts/start-local.test.js`：启动器核心逻辑和无服务检查测试。
- `README.md`：首次部署、日常启动、停止和故障处理教程。

## Constraints

- 支持 Vite 8 要求的 Node.js `20.19+` 或 `22.12+`；不支持 Node.js 21。
- 不更换应用端口，不迁移或删除浏览器 `localStorage` 数据。
- 不改变现有 Docker Compose 部署流程。
