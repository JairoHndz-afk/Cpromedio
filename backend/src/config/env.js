import dotenv from "dotenv";

dotenv.config();

function normalizeOrigin(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function normalizeHostname(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return trimmed
      .replace(/^\[|\]$/g, "")
      .replace(/:\d+$/, "")
      .toLowerCase();
  }
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  return value === "true";
}

function parseTrustProxy(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (!normalized) {
    return defaultValue;
  }

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  return String(value).trim();
}

function toList(value, fallback = "") {
  const source = value ?? fallback;

  if (typeof source !== "string" || !source.trim()) {
    return [];
  }

  return source
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);
}

function toHostList(value, fallback = "") {
  const source = value ?? fallback;

  if (typeof source !== "string" || !source.trim()) {
    return [];
  }

  return source
    .split(",")
    .map((item) => normalizeHostname(item))
    .filter(Boolean);
}

function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}

function isPlausibleEmail(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

const nodeEnv = String(process.env.NODE_ENV ?? "development")
  .trim()
  .toLowerCase();
const port = Math.max(Number(process.env.PORT ?? 4000), 1);
const defaultAdminPassword = "Admin#2026";
const defaultJournalistPassword = "Periodista#2026";
const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@periodico.local").toLowerCase();
const journalistEmail = (process.env.JOURNALIST_EMAIL ?? "periodista@periodico.local").toLowerCase();
const publicSiteUrl = normalizeOrigin(process.env.PUBLIC_SITE_URL ?? process.env.CLIENT_URL ?? "http://localhost:4200");
const declaredLocalEnv = ["development", "dev", "test", "local"].includes(nodeEnv);
const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
const fallbackLocalServerUrl = `http://localhost:${port}`;
const configuredPublicServerUrl = normalizeOrigin(
  process.env.PUBLIC_SERVER_URL ?? process.env.PUBLIC_API_URL ?? (declaredLocalEnv ? fallbackLocalServerUrl : "")
);
const isLocalPublicConfig = [publicSiteUrl, configuredPublicServerUrl].every((value) => !value || localHostnames.has(normalizeHostname(value)));
const isLocal = declaredLocalEnv && isLocalPublicConfig;
const isProduction = nodeEnv === "production";
const publicServerUrl = configuredPublicServerUrl || (isLocal ? fallbackLocalServerUrl : "");
const smtpHost = process.env.SMTP_HOST?.trim() ?? "";
const smtpPort = Math.max(Number(process.env.SMTP_PORT ?? 587), 1);
const smtpUser = process.env.SMTP_USER?.trim() ?? "";
const smtpPass = (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
const smtpFromEmail = (process.env.SMTP_FROM_EMAIL ?? smtpUser ?? adminEmail).trim().toLowerCase();
const smtpFromName = process.env.SMTP_FROM_NAME?.trim() ?? "Colombiano Promedio";
const smtpReplyTo = process.env.SMTP_REPLY_TO?.trim().toLowerCase() ?? "";
const smtpSecure = toBoolean(process.env.SMTP_SECURE, false);
const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? "";
const resendFromEmail = (process.env.RESEND_FROM_EMAIL ?? process.env.SMTP_FROM_EMAIL ?? "").trim().toLowerCase();
const resendReplyTo = process.env.RESEND_REPLY_TO?.trim().toLowerCase() ?? "";
const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);
const resendConfigured = Boolean(resendApiKey && resendFromEmail);
const mailProvider = resendConfigured ? "resend" : smtpConfigured ? "smtp" : "preview";
const mailFromEmail = (resendConfigured ? resendFromEmail : smtpFromEmail).trim().toLowerCase();
const mailReplyTo = (resendConfigured ? resendReplyTo || smtpReplyTo : smtpReplyTo).trim().toLowerCase();
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";
const cloudinaryFolder = process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() ?? "colombiano-promedio";
const cloudinaryConfigured = Boolean(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);
const newsletterRequireConfirm = toBoolean(process.env.NEWSLETTER_REQUIRE_CONFIRM, true);
const bootstrapOnStart = toBoolean(process.env.BOOTSTRAP_ON_START, isLocal);
const allowedOrigins = uniqueList(
  toList(
    process.env.FRONTEND_ORIGINS,
    isLocal ? "http://localhost:4200,http://127.0.0.1:4200" : publicSiteUrl
  )
);
const allowedHosts = uniqueList([
  ...toHostList(process.env.ALLOWED_HOSTS),
  normalizeHostname(publicSiteUrl),
  normalizeHostname(publicServerUrl),
  ...(isLocal ? ["localhost", "127.0.0.1", "::1"] : [])
]);
const jwtSecret = process.env.JWT_SECRET?.trim() ?? (isLocal ? "development-only-change-me" : "");

export const env = {
  nodeEnv,
  isProduction,
  isLocal,
  port,
  mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/periodico",
  publicSiteUrl,
  publicServerUrl,
  allowedOrigins,
  allowedHosts,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  cookieName: process.env.COOKIE_NAME ?? "periodico_session",
  cookieMaxAgeMs: Math.max(Number(process.env.COOKIE_MAX_AGE_MS ?? 1000 * 60 * 60 * 8), 60_000),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY, false),
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  smtpSecure,
  smtpFromEmail,
  smtpFromName,
  smtpReplyTo,
  smtpConfigured,
  resendApiKey,
  resendFromEmail,
  resendReplyTo,
  resendConfigured,
  mailProvider,
  mailConfigured: resendConfigured || smtpConfigured,
  mailFromEmail,
  mailReplyTo,
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  cloudinaryFolder,
  cloudinaryConfigured,
  newsletterRequireConfirm,
  bootstrapOnStart,
  bootstrapAdmin: {
    name: process.env.ADMIN_NAME ?? "Administrador",
    email: adminEmail,
    password: process.env.ADMIN_PASSWORD ?? defaultAdminPassword
  },
  bootstrapJournalist: {
    name: process.env.JOURNALIST_NAME ?? "Periodista Base",
    email: journalistEmail,
    password: process.env.JOURNALIST_PASSWORD ?? defaultJournalistPassword
  },
  buildPublicUrl(pathname) {
    const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return new URL(safePath, `${env.publicServerUrl}/`).toString();
  },
  isAllowedOrigin(origin) {
    return env.allowedOrigins.includes(normalizeOrigin(origin));
  },
  isAllowedHost(hostname) {
    return env.allowedHosts.includes(normalizeHostname(hostname));
  }
};

if (!publicSiteUrl) {
  throw new Error("PUBLIC_SITE_URL debe configurarse con una URL valida.");
}

if (!isLocal && !publicServerUrl) {
  throw new Error("PUBLIC_SERVER_URL es obligatorio fuera de entornos locales.");
}

if (!isLocal && env.allowedOrigins.length === 0) {
  throw new Error("FRONTEND_ORIGINS debe definir al menos un origen permitido fuera de entornos locales.");
}

if (!isLocal && env.allowedHosts.length === 0) {
  throw new Error("ALLOWED_HOSTS o las URLs publicas deben definir al menos un host permitido.");
}

if (!isLocal && !env.jwtSecret) {
  throw new Error("JWT_SECRET es obligatorio fuera de entornos locales.");
}

if (env.mailProvider === "resend" && !isPlausibleEmail(env.resendFromEmail)) {
  throw new Error("RESEND_FROM_EMAIL debe ser un correo completo, por ejemplo boletin@colombianopromedio.co.");
}

if (env.mailProvider === "resend" && env.resendReplyTo && !isPlausibleEmail(env.resendReplyTo)) {
  throw new Error("RESEND_REPLY_TO debe ser un correo valido cuando se configura en produccion.");
}

if (env.mailProvider === "smtp" && !isPlausibleEmail(env.smtpFromEmail)) {
  throw new Error("SMTP_FROM_EMAIL debe ser un correo valido cuando se usa SMTP.");
}

if (env.mailProvider === "smtp" && env.smtpReplyTo && !isPlausibleEmail(env.smtpReplyTo)) {
  throw new Error("SMTP_REPLY_TO debe ser un correo valido cuando se usa SMTP.");
}

if (
  !isLocal &&
  env.bootstrapOnStart &&
  (env.bootstrapAdmin.password === defaultAdminPassword || env.bootstrapJournalist.password === defaultJournalistPassword)
) {
  throw new Error("BOOTSTRAP_ON_START requiere credenciales seguras para ADMIN_PASSWORD y JOURNALIST_PASSWORD.");
}
