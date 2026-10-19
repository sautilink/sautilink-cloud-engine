// Local static preview only. Existing Cloudflare Pages Functions are not emulated.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("public");
const headers = await readFile(resolve(root, "_headers"), "utf8");
const policy = headers.match(/Content-Security-Policy: (.+)/)?.[1].trim();
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json" };

createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4184");
  if (url.pathname.startsWith("/api/")) {
    response.writeHead(501, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Static preview: live APIs are not proxied." }));
    return;
  }
  let file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
  if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = resolve(file, "index.html");
  } catch {
    if (!extname(file)) file += ".html";
  }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", ...(policy ? { "Content-Security-Policy": policy } : {}), "Cache-Control": "no-store" });
    response.end(bytes);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(4184, "127.0.0.1", () => console.log("Cloud Engine public icon preview: http://127.0.0.1:4184 (static UI only)"));
