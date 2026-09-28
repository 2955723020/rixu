import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";
import {
  dependenciesNeedInstall,
  isSupportedNodeVersion,
  resolveNpmCli,
  versionAtLeast,
} from "../../scripts/launcher-utils.mjs";

const execFileAsync = promisify(execFile);

test("accepts exactly the Node release lines supported by Vite", () => {
  assert.equal(isSupportedNodeVersion("20.18.9"), false);
  assert.equal(isSupportedNodeVersion("20.19.0"), true);
  assert.equal(isSupportedNodeVersion("21.7.3"), false);
  assert.equal(isSupportedNodeVersion("22.11.0"), false);
  assert.equal(isSupportedNodeVersion("22.12.0"), true);
  assert.equal(isSupportedNodeVersion("23.0.0"), true);
  assert.equal(isSupportedNodeVersion("24.0.0"), true);
});

test("compares npm semantic versions", () => {
  assert.equal(versionAtLeast("9.9.9", [10, 0, 0]), false);
  assert.equal(versionAtLeast("10.0.0", [10, 0, 0]), true);
  assert.equal(versionAtLeast("10.9.8", [10, 0, 0]), true);
});

test("reinstalls dependencies when the platform Vite shim is missing", async () => {
  const webRoot = await mkdtemp(join(tmpdir(), "rixu-launcher-"));
  await mkdir(join(webRoot, "node_modules", ".bin"), { recursive: true });
  await mkdir(join(webRoot, "node_modules", "vite", "bin"), { recursive: true });
  await writeFile(join(webRoot, "package.json"), "{}");
  await writeFile(join(webRoot, "package-lock.json"), "{}");
  await writeFile(join(webRoot, "node_modules", ".package-lock.json"), "{}");
  await writeFile(join(webRoot, "node_modules", ".bin", "vite"), "#!/bin/sh\n");
  await writeFile(join(webRoot, "node_modules", "vite", "bin", "vite.js"), "");

  assert.equal(dependenciesNeedInstall(webRoot, "win32"), true);

  await writeFile(join(webRoot, "node_modules", ".bin", "vite.cmd"), "@echo off\r\n");
  assert.equal(dependenciesNeedInstall(webRoot, "win32"), false);
});

test("finds npm's JavaScript CLI without invoking a shell", async () => {
  const root = await mkdtemp(join(tmpdir(), "rixu-npm-cli-"));
  const npmCli = join(root, "npm-cli.js");
  await writeFile(npmCli, "");

  assert.equal(resolveNpmCli("C:\\Program Files\\nodejs\\node.exe", npmCli, "win32"), npmCli);
});

test("checks prerequisites without starting the development server", async () => {
  const result = await execFileAsync(process.execPath, ["scripts/start-local.mjs", "--check", "--skip-install"], {
    cwd: process.cwd(),
  });

  assert.match(result.stdout, /Prerequisite check completed/);
});
