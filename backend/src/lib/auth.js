import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      ver: Number(user.sessionVersion ?? 0)
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn
    }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function buildCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: env.isProduction,
    path: "/",
    maxAge: env.cookieMaxAgeMs
  };
}

export function buildClearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: env.isProduction,
    path: "/"
  };
}
