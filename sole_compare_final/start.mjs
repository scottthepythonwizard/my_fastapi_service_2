import { spawn, spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const compareRoot = fileURLToPath(new URL(".", import.meta.url));
const archiveRoot = fileURLToPath(new URL("../my_fastapi_service_sole_list/", import.meta.url));
const api = "http://127.0.0.1:8000";
const children = new Set();
let stopping = false;

function stop(code, message) {
  if (stopping) return;
  stopping = true;
  if (message) console.error(message);
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else child.kill("SIGTERM");
  }
  process.exit(code);
}

function run(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: "inherit", windowsHide: true });
  children.add(child);
  child.once("error", (error) => stop(1, `Unable to start server: ${error.message}`));
  child.once("exit", (code) => {
    children.delete(child);
    stop(code || 1, "A local server stopped. Run npm start again after resolving the error above.");
  });
}

async function archiveReady() {
  let response;
  try { response = await fetch(`${api}/health`, { signal: AbortSignal.timeout(3000) }); }
  catch { return false; }
  if (response.status === 503) throw new Error("Sole Archive cannot reach Supabase. Check the private .env and database connectivity.");
  const health = await response.json();
  if (!response.ok || health.status !== "ok" || health.service !== "Simple Sneaker API") {
    throw new Error(`Port 8000 is not serving Sole Archive. Check ${api}/health before restarting.`);
  }
  return true;
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

try {
  if (!await archiveReady()) {
    const python = join(archiveRoot, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    try { await access(python); }
    catch { throw new Error(`Archive Python environment is missing. Create .venv and install requirements.txt in ${archiveRoot}. See README.md.`); }
    console.log(`Starting Sole Archive from ${archiveRoot}`);
    const envFile = join(archiveRoot, "..", ".env");
    const envArgs = existsSync(envFile) ? ["--env-file", envFile] : [];
    run(python, ["-m", "uvicorn", "api.index:app", "--host", "127.0.0.1", "--port", "8000", ...envArgs], archiveRoot);
    const deadline = Date.now() + 15000;
    while (!await archiveReady()) {
      if (Date.now() > deadline) throw new Error("Sole Archive did not become ready within 15 seconds. Check its startup output above.");
      await delay(250);
    }
  } else console.log(`Using the running Sole Archive at ${api}`);

  const origin = `http://127.0.0.1:${process.env.PORT || 5173}`;
  const preflight = await fetch(`${api}/api/v1/catalog`, { method: "OPTIONS", signal: AbortSignal.timeout(3000), headers: {
    Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-api-key",
  } });
  if (!preflight.ok || preflight.headers.get("access-control-allow-origin") !== origin) {
    throw new Error(`Archive CORS does not allow ${origin}. Add this origin to SOLE_CORS_ORIGINS and restart the Archive API.`);
  }
  console.log(`Archive ready: ${api}/archive\nStarting sole_compare_final. Keep this terminal open; Ctrl+C stops servers started here.`);
  run(process.execPath, [join(compareRoot, "server.mjs")], compareRoot);
} catch (error) { stop(1, error.message); }
