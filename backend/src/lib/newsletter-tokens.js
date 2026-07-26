import crypto from "node:crypto";

export function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token) {
  return crypto.createHash("sha256").update(String(token ?? "")).digest("hex");
}

export function createExpiringToken(hoursValid = 72) {
  const token = createOpaqueToken();

  return {
    token,
    hash: hashOpaqueToken(token),
    expiresAt: new Date(Date.now() + hoursValid * 60 * 60 * 1000)
  };
}
