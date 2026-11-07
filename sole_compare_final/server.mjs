import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const assets = new Map([
  ["/", ["index.html", "text/html"]], ["/index.html", ["index.html", "text/html"]],
  ["/archive.css", ["archive.css", "text/css"]], ["/style.css", ["style.css", "text/css"]],
  ...["app.js", "components.js", "core.js"].map((name) => [`/${name}`, [name, "text/javascript"]]),
]);
const config = {
  apiOrigin: process.env.SOLE_ARCHIVE_ORIGIN || "http://127.0.0.1:8000",
  apiKey: process.env.SOLE_API_KEY || "student-api-key-123",
  fitOrigin: process.env.SOLE_FIT_ORIGIN || "http://127.0.0.1:8002",
};
const port = Number(process.env.PORT || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
const server = createServer(async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  let asset;
  let pathname;
  try { pathname = new URL(request.url, "http://localhost").pathname; }
  catch { response.writeHead(400).end("Bad request"); return; }
  if (pathname === "/config.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : `window.SOLE_COMPARE_CONFIG = Object.freeze(${JSON.stringify(config)});`);
    return;
  }
  asset = assets.get(pathname);
  if (!asset) { response.writeHead(404).end("Not found"); return; }
  try {
    const bytes = await readFile(new URL(asset[0], import.meta.url));
    response.writeHead(200, { "Content-Type": `${asset[1]}; charset=utf-8`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch { response.writeHead(500).end("Unable to read application asset"); }
});
server.on("error", (error) => { console.error(`Unable to start Sole Compare: ${error.message}`); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`Sole Compare: http://127.0.0.1:${port}`));
