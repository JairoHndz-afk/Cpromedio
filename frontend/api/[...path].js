const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "transfer-encoding",
  "accept-encoding",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-vercel-id",
  "x-vercel-ip-city",
  "x-vercel-ip-country",
  "x-vercel-ip-country-region",
  "x-vercel-ip-latitude",
  "x-vercel-ip-longitude"
]);

function normalizeBackendOrigin() {
  const rawValue = String(process.env.BACKEND_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");

  if (!rawValue) {
    throw new Error("BACKEND_PUBLIC_URL no está configurada en Vercel.");
  }

  return rawValue;
}

function readRequestBody(req) {
  if (req.body === undefined || req.body === null) {
    return Promise.resolve(undefined);
  }

  if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "object") {
    return Promise.resolve(JSON.stringify(req.body));
  }

  return Promise.resolve(String(req.body));
}

function buildForwardHeaders(req) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers ?? {})) {
    const normalizedKey = key.toLowerCase();

    if (HOP_BY_HOP_HEADERS.has(normalizedKey)) {
      continue;
    }

    if (Array.isArray(value)) {
      headers.set(normalizedKey, value.join(", "));
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      headers.set(normalizedKey, value);
    }
  }

  const forwardedHost = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").trim();
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "https").trim() || "https";

  if (forwardedHost && !headers.has("origin")) {
    headers.set("origin", `${forwardedProto}://${forwardedHost}`);
  }

  if (forwardedHost && !headers.has("referer")) {
    headers.set("referer", `${forwardedProto}://${forwardedHost}/`);
  }

  return headers;
}

function setResponseHeaders(res, upstreamResponse) {
  upstreamResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }

    res.setHeader(key, value);
  });

  const setCookie = typeof upstreamResponse.headers.getSetCookie === "function"
    ? upstreamResponse.headers.getSetCookie()
    : upstreamResponse.headers.get("set-cookie");

  if (Array.isArray(setCookie) && setCookie.length > 0) {
    res.setHeader("set-cookie", setCookie);
  } else if (typeof setCookie === "string" && setCookie.trim()) {
    res.setHeader("set-cookie", setCookie);
  }
}

export default async function handler(req, res) {
  try {
    const backendOrigin = normalizeBackendOrigin();
    const pathSegments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
    const pathname = pathSegments.join("/");
    const queryIndex = req.url.indexOf("?");
    const queryString = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
    const upstreamUrl = `${backendOrigin}/api/${pathname}${queryString}`;
    const method = String(req.method ?? "GET").toUpperCase();
    const headers = buildForwardHeaders(req);
    const body = method === "GET" || method === "HEAD" ? undefined : await readRequestBody(req);

    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: "manual"
    });

    const payload = Buffer.from(await upstreamResponse.arrayBuffer());
    setResponseHeaders(res, upstreamResponse);
    res.status(upstreamResponse.status).send(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible conectar con el backend.";
    res.status(502).json({
      message
    });
  }
}
