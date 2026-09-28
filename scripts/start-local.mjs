#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  dependenciesNeedInstall,
  isSupportedNodeVersion,
  resolveNpmCli,
  versionAtLeast,
} from "./launcher-utils.mjs";

const MIN_NPM_VERSION = [10, 0, 0];
const DEFAULT_PORT = 5173;
const repoRoot = resolve(import.meta.dirname, "..");
const webRoot = resolve(repoRoot, "web");

function printHelp() {
  console.log(`Rixu local launcher

Usage: node scripts/start-local.mjs [options]

Options:
  --port <number>   Local port (default: ${DEFAULT_PORT})
  --no-open         Do not open the browser automatically
  --skip-install    Do not synchronize web dependencies
  --check           Check prerequisites, then exit
  --help            Show this help
`);
}

function fail(message) {
  console.error(`[ERROR] ${message}`);
  process.exit(1);
}

function parseOptions(args) {
  const options = { port: DEFAULT_PORT, open: true, install: true, check: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") return { ...options, help: true };
    if (argument === "--no-open") options.open = false;
    else if (argument === "--skip-install") options.install = false;
    else if (argument === "--check") options.check = true;
    else if (argument === "--port") {
      const value = Number(args[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) fail("--port must be between 1 and 65535.");
      options.port = value;
      index += 1;
    } else fail(`Unknown option: ${argument}. Run with --help for usage.`);
  }
  return options;
}

const options = parseOptions(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const currentNodeVersion = process.versions.node;
if (!isSupportedNodeVersion(currentNodeVersion)) {
  fail(`Unsupported Node.js version ${currentNodeVersion}. Use Node 20.19+ or 22.12+ (Node 21 is unsupported).`);
}

const npmCli = resolveNpmCli(process.execPath, process.env.npm_execpath, process.platform);
if (!npmCli) fail("npm was not found. Reinstall the Node.js LTS release.");

const npmVersion = spawnSync(process.execPath, [npmCli, "--version"], {
  cwd: webRoot,
  encoding: "utf8",
});
if (npmVersion.error?.code === "ENOENT") fail("npm was not found. Reinstall the Node.js LTS release.");
if (npmVersion.error) fail(`npm could not be executed (${npmVersion.error.code ?? npmVersion.error.message}).`);
if (npmVersion.status !== 0) fail("npm returned an error. Reinstall the Node.js LTS release.");

const currentNpmVersion = npmVersion.stdout.trim();
if (!versionAtLeast(currentNpmVersion, MIN_NPM_VERSION)) {
  fail(`npm ${MIN_NPM_VERSION.join(".")} or newer is required; current version is ${currentNpmVersion}.`);
}

console.log(`[OK] Node.js ${currentNodeVersion}; npm ${currentNpmVersion}.`);

if (options.install && dependenciesNeedInstall(webRoot, process.platform)) {
  console.log("[INFO] Installing or synchronizing web dependencies...");
  const install = spawnSync(process.execPath, [npmCli, "install"], {
    cwd: webRoot,
    stdio: "inherit",
  });
  if (install.error || install.status !== 0) {
    fail("npm install failed. Check the network and npm error output above.");
  }
} else if (options.install) {
  console.log("[OK] Web dependencies are up to date.");
}

if (options.check) {
  console.log("[OK] Prerequisite check completed.");
  process.exit(0);
}

const url = `http://localhost:${options.port}/`;
const viteCli = resolve(webRoot, "node_modules", "vite", "bin", "vite.js");
if (!existsSync(viteCli)) {
  fail("Vite is not installed. Run the launcher again without --skip-install.");
}

console.log(`[INFO] Starting ${url}`);
console.log("[INFO] Keep this window open; press Ctrl+C to stop.");

const viteArgs = [viteCli, "--host", "localhost", "--port", String(options.port), "--strictPort"];
if (options.open) viteArgs.push("--open");

const server = spawn(process.execPath, viteArgs, {
  cwd: webRoot,
  stdio: "inherit",
});

server.on("error", (error) => fail(`Unable to start the development server: ${error.message}`));
server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
