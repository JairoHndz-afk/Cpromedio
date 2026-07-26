import { AuditLog } from "../models/AuditLog.js";

export async function writeAuditLog(req, payload) {
  try {
    await AuditLog.create({
      actor: payload.actor?._id ?? null,
      actorEmail: payload.actor?.email ?? payload.actorEmail ?? "",
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId ?? "",
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? "",
      details: payload.details ?? {}
    });
  } catch (error) {
    console.error("No fue posible guardar el audit log.");
    console.error(error);
  }
}
