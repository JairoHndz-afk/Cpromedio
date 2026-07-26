import { verifyAuthToken } from "../lib/auth.js";
import { User } from "../models/User.js";

function readToken(req) {
  const cookieToken = req.cookies?.[req.app.locals.cookieName];
  if (cookieToken) {
    return cookieToken;
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }

  return null;
}

export async function attachCurrentUser(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) {
      return next();
    }

    const payload = verifyAuthToken(token);
    if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
      return next();
    }

    const user = await User.findById(payload.sub);

    if (!user || user.status !== "active") {
      return next();
    }

    if (Number(user.sessionVersion ?? 0) !== Number(payload.ver ?? 0)) {
      return next();
    }

    req.user = user;
    next();
  } catch {
    next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: "Debes iniciar sesión."
    });
  }

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Debes iniciar sesión."
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "No tienes permisos para esta acción."
      });
    }

    next();
  };
}
