import { env } from "../config/env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const TRUSTED_FETCH_SITES = new Set(["same-origin", "same-site", "none"]);

function extractOriginFromReferer(referer) {
  if (!referer) {
    return "";
  }

  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

function normalizeFetchSite(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

export function requireTrustedHost(req, res, next) {
  if (env.isAllowedHost(req.hostname)) {
    return next();
  }

  return res.status(400).json({
    message: "Host no permitido."
  });
}

export function rejectDisallowedOrigin(req, res, next) {
  const origin = req.get("origin");

  if (!origin || env.isAllowedOrigin(origin)) {
    return next();
  }

  return res.status(403).json({
    message: "Origen no permitido."
  });
}

export function requireTrustedMutation(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const fetchSite = normalizeFetchSite(req.get("sec-fetch-site"));

  if (fetchSite && !TRUSTED_FETCH_SITES.has(fetchSite)) {
    return res.status(403).json({
      message: "Solicitud bloqueada por contexto de navegación no confiable."
    });
  }

  if (req.get("x-requested-with") !== "XMLHttpRequest") {
    return res.status(403).json({
      message: "Solicitud bloqueada por protección de sesión."
    });
  }

  const origin = req.get("origin");
  const refererOrigin = extractOriginFromReferer(req.get("referer"));

  if (origin && !env.isAllowedOrigin(origin)) {
    return res.status(403).json({
      message: "Origen no permitido."
    });
  }

  if (!origin && refererOrigin && !env.isAllowedOrigin(refererOrigin)) {
    return res.status(403).json({
      message: "Origen no permitido."
    });
  }

  next();
}
