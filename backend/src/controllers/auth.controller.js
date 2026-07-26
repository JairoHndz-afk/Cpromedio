import bcrypt from "bcryptjs";

import { buildClearCookieOptions, buildCookieOptions, signAuthToken } from "../lib/auth.js";
import { writeAuditLog } from "../lib/audit.js";
import { User } from "../models/User.js";
import { loginSchema } from "../validators/auth.validator.js";

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt
  };
}

export async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await User.findOne({ email: payload.email }).select("+passwordHash");

    if (!user || user.status !== "active") {
      await writeAuditLog(req, {
        action: "auth.login_failed",
        targetType: "user",
        targetId: payload.email,
        actorEmail: payload.email
      });

      return res.status(401).json({
        message: "Credenciales inválidas."
      });
    }

    const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);

    if (!passwordMatches) {
      await writeAuditLog(req, {
        action: "auth.login_failed",
        targetType: "user",
        targetId: user._id.toString(),
        actorEmail: user.email
      });

      return res.status(401).json({
        message: "Credenciales inválidas."
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signAuthToken(user);
    res.cookie(req.app.locals.cookieName, token, buildCookieOptions());

    await writeAuditLog(req, {
      actor: user,
      action: "auth.login_success",
      targetType: "user",
      targetId: user._id.toString()
    });

    res.json({
      user: serializeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.user) {
      await writeAuditLog(req, {
        actor: req.user,
        action: "auth.logout",
        targetType: "user",
        targetId: req.user._id.toString()
      });
    }

    res.clearCookie(req.app.locals.cookieName, buildClearCookieOptions());
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getSession(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Sesión no iniciada."
      });
    }

    res.json({
      user: serializeUser(req.user)
    });
  } catch (error) {
    next(error);
  }
}
