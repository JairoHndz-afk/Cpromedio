import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 4200);
const host = process.env.HOST ?? "localhost";
const distDir = join(process.cwd(), "dist", "periodico-frontend");
const rootDir = existsSync(join(distDir, "browser")) ? join(distDir, "browser") : distDir;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function resolveFilePath(urlPath) {
  const safePath = normalize(decodeURIComponent(urlPath))
    .replace(/^[/\\]+/, "")
    .replace(/^(\.\.[/\\])+/, "");
  const candidate = join(rootDir, safePath);

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  if (extname(safePath)) {
    return null;
  }

  return join(rootDir, "index.html");
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = resolveFilePath(pathname);

  if (!filePath) {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    response.end("Not found");
    return;
  }

  const extension = extname(filePath).toLowerCase();

  response.writeHead(200, {
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=600",
    "Content-Type": contentTypes[extension] ?? "application/octet-stream",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff"
  });

  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Frontend listo en http://${host}:${port}`);
});
