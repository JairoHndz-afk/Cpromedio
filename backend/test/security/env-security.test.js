import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envModuleUrl = pathToFileURL(path.resolve(currentDir, "..", "..", "src", "config", "env.js")).href;

function importEnv(variables) {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `await import(${JSON.stringify(envModuleUrl)});`
    ],
    {
      cwd: os.tmpdir(),
      env: {
        ...process.env,
        ...variables
      },
      encoding: "utf8"
    }
  );
}

test("falla fuera de local si falta JWT_SECRET", () => {
  const result = importEnv({
    NODE_ENV: "staging",
    PUBLIC_SITE_URL: "https://frontend.example",
    PUBLIC_SERVER_URL: "https://api.example",
    FRONTEND_ORIGINS: "https://frontend.example",
    ALLOWED_HOSTS: "frontend.example,api.example",
    JWT_SECRET: ""
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /JWT_SECRET/i);
});

test("permite una configuracion endurecida sin bootstrap automatico", () => {
  const result = importEnv({
    NODE_ENV: "staging",
    PUBLIC_SITE_URL: "https://frontend.example",
    PUBLIC_SERVER_URL: "https://api.example",
    FRONTEND_ORIGINS: "https://frontend.example",
    ALLOWED_HOSTS: "frontend.example,api.example",
    JWT_SECRET: "super-secreto-para-pruebas",
    BOOTSTRAP_ON_START: "false"
  });

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
});
