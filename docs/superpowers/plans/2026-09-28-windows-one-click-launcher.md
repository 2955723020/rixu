# Windows One-Click Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Windows one-click launcher that works from both regular Windows paths and WSL UNC paths.

**Architecture:** An ASCII batch file invokes a UTF-8 PowerShell coordinator. The coordinator routes WSL paths into the correct distribution; a cross-platform Node launcher checks/install dependencies in `web/` and starts Vite without shell shims.

**Tech Stack:** Windows batch, PowerShell 5.1+, Node.js ES modules, Node test runner, Vite

**Spec:** `docs/superpowers/specs/2026-09-28-windows-one-click-launcher-design.md`

## Global Constraints

- Support Node.js `20.19+` or `22.12+`; reject Node.js 21.
- Keep the default URL at `http://localhost:5173/`.
- Never run Windows npm against dependencies stored in WSL.
- Preserve the Docker Compose deployment flow.

---

### Task 1: Testable launcher rules

**Files:**
- Create: `tests/scripts/start-local.test.js`
- Create: `scripts/launcher-utils.mjs`

**Interfaces:**
- Produces: `versionAtLeast(current, minimum)`, `isSupportedNodeVersion(current)`, `dependenciesNeedInstall(webRoot, platform)`, and `resolveNpmCli(nodeExecutable, npmExecPath, platform)`.

- [x] Write tests covering supported Node release boundaries, stale/missing web dependencies, and npm CLI resolution.
- [x] Run `node --test tests/scripts/start-local.test.js` and verify it fails because `scripts/launcher-utils.mjs` is missing.
- [x] Implement the four utility functions with filesystem checks rooted at `web/`.
- [x] Re-run `node --test tests/scripts/start-local.test.js` and verify all utility tests pass.

### Task 2: Cross-platform and Windows entry points

**Files:**
- Modify: `tests/scripts/start-local.test.js`
- Create: `scripts/start-local.mjs`
- Create: `scripts/start-windows.ps1`
- Create: `启动.bat`

**Interfaces:**
- Consumes: launcher utilities from Task 1.
- Produces: `node scripts/start-local.mjs --check --skip-install` and a double-clickable batch entry point.

- [x] Add a test that executes the Node launcher with `--check --skip-install` and expects a successful prerequisite message without starting a server.
- [x] Run the focused test and verify it fails because `scripts/start-local.mjs` is missing.
- [x] Implement argument parsing, Node/npm checks, `web/` dependency installation, and direct Vite startup.
- [x] Add the PowerShell coordinator with WSL UNC routing through `bash -lic`, and the ASCII batch wrapper.
- [x] Run `node --test tests/scripts/start-local.test.js` and `node scripts/start-local.mjs --check --skip-install`.

### Task 3: Beginner deployment guide and regression verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents: first run, everyday use, stopping, custom port, WSL behavior, local data, troubleshooting, manual fallback, and existing Docker deployment.

- [x] Replace the initial manual-only startup section with the Windows one-click guide and retain manual Linux/macOS commands.
- [x] Run `npm test` and `npm --prefix web test`.
- [x] Run `npm --prefix web run build`.
- [x] Run the launcher check command and inspect `git diff --check` and `git status --short`.
