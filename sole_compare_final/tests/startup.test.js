// Run with npm start already serving both applications.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("a second startup reports the occupied frontend port without stopping the existing Archive", async () => {
  const api = "http://127.0.0.1:8000/health";
  const frontend = "http://127.0.0.1:5173/";
  assert.equal((await (await fetch(api)).json()).service, "Simple Sneaker API");
  assert.equal((await fetch(frontend)).status, 200);
  const result = await new Promise((resolve) => {
    execFile(process.execPath, [fileURLToPath(new URL("../start.mjs", import.meta.url))], {
      env: { ...process.env, PORT: "5173" }, timeout: 10000, windowsHide: true,
    }, (error, stdout, stderr) => resolve({ error, stdout, stderr }));
  });
  assert.equal(result.error?.code, 1);
  assert.match(result.stdout, /Using the running Sole Archive/);
  assert.match(result.stderr, /EADDRINUSE|address already in use/);
  assert.equal((await (await fetch(api)).json()).status, "ok");
  assert.equal((await fetch(frontend)).status, 200);
});
