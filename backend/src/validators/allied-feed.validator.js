import { z } from "zod";

const privateIpv4Pattern =
  /^(?:127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isPublicHttpUrl(value) {
  const url = safeUrl(value);

  if (!url || !["http:", "https:"].includes(url.protocol)) {
    return false;
  }

  const hostname = url.hostname.trim().toLowerCase();

  if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) {
    return false;
  }

  if (privateIpv4Pattern.test(hostname)) {
    return false;
  }

  return true;
}

function normalizeHostEntry(value) {
  const input = String(value ?? "").trim();

  if (!input) {
    return "";
  }

  const directUrl = safeUrl(input);
  if (directUrl) {
    return directUrl.hostname.trim().toLowerCase();
  }

  const wrappedUrl = safeUrl(`https://${input}`);
  if (!wrappedUrl) {
    return "";
  }

  return wrappedUrl.hostname.trim().toLowerCase();
}

export const alliedFeedInputSchema = z.object({
  name: z.string().min(3, "El nombre del medio aliado debe tener al menos 3 caracteres.").max(80, "El nombre del medio aliado no puede superar 80 caracteres."),
  feedUrl: z.string().refine((value) => isPublicHttpUrl(value), "La URL del feed debe ser pública y usar HTTP o HTTPS."),
  siteUrl: z.string().optional().default("").refine((value) => !value || isPublicHttpUrl(value), "La URL del sitio debe ser pública y usar HTTP o HTTPS."),
  attributionLabel: z.string().max(80, "La atribución no puede superar 80 caracteres.").optional().default(""),
  logoUrl: z.string().optional().default("").refine((value) => !value || isPublicHttpUrl(value), "El logo debe usar una URL pública HTTP o HTTPS."),
  allowedMediaHosts: z.array(z.string()).max(20, "No puedes registrar más de 20 hosts multimedia por fuente.").optional().default([]),
  defaultTags: z.array(z.string().max(40, "Cada etiqueta no puede superar 40 caracteres.")).max(10, "No puedes registrar más de 10 etiquetas base.").optional().default([]),
  defaultCategoryId: z.string().optional().nullable().default(null),
  importMode: z.enum(["draft", "review", "published"]).optional().default("draft"),
  maxItemsPerSync: z.coerce.number().min(1, "Debes importar al menos un artículo por sincronización.").max(20, "No puedes importar más de 20 artículos por sincronización."),
  permissionNote: z.string().max(240, "La nota de permisos no puede superar 240 caracteres.").optional().default(""),
  isActive: z.boolean().optional().default(true)
});

export const alliedFeedHostEntrySchema = z
  .string()
  .transform((value) => normalizeHostEntry(value))
  .refine((value) => Boolean(value), "Cada host permitido debe ser válido.");
