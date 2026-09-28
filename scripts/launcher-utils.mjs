import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function versionAtLeast(current, minimum) {
  const parsed = current.split(".").map((part) => Number(part));
  for (let index = 0; index < minimum.length; index += 1) {
    if ((parsed[index] ?? 0) > minimum[index]) return true;
    if ((parsed[index] ?? 0) < minimum[index]) return false;
  }
  return true;
}

export function isSupportedNodeVersion(current) {
  const [major, minor = 0, patch = 0] = current.split(".").map((part) => Number(part));
  if (major === 20) return versionAtLeast(`${major}.${minor}.${patch}`, [20, 19, 0]);
  if (major === 21) return false;
  return versionAtLeast(`${major}.${minor}.${patch}`, [22, 12, 0]);
}

export function dependenciesNeedInstall(webRoot, platform = process.platform) {
  const marker = resolve(webRoot, "node_modules", ".package-lock.json");
  const viteShim = resolve(webRoot, "node_modules", ".bin", platform === "win32" ? "vite.cmd" : "vite");
  const viteCli = resolve(webRoot, "node_modules", "vite", "bin", "vite.js");
  if (!existsSync(marker) || !existsSync(viteShim) || !existsSync(viteCli)) return true;

  const markerTime = statSync(marker).mtimeMs;
  return ["package.json", "package-lock.json"].some((file) => statSync(resolve(webRoot, file)).mtimeMs > markerTime);
}

export function resolveNpmCli(nodeExecutable, npmExecPath, platform = process.platform) {
  if (npmExecPath && existsSync(npmExecPath)) return npmExecPath;

  const nodeDirectory = dirname(nodeExecutable);
  const candidates = platform === "win32"
    ? [resolve(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js")]
    : [
        resolve(nodeDirectory, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
        resolve(nodeDirectory, "node_modules", "npm", "bin", "npm-cli.js"),
      ];
  return candidates.find((candidate) => existsSync(candidate));
}
