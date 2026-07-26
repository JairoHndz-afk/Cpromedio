import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../config/env.js";
import { sanitizeText } from "../utils/content.js";
import { imageUploadSchema } from "../validators/upload.validator.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(currentDir, "..", "..", "uploads", "news");
const allowedMimeTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"]
]);
const maxImageBytes = 5 * 1024 * 1024;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildPublicUrl(relativePath) {
  return env.buildPublicUrl(relativePath);
}

function detectImageMimeType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 6) {
    const gifSignature = buffer.subarray(0, 6).toString("ascii");

    if (gifSignature === "GIF87a" || gifSignature === "GIF89a") {
      return "image/gif";
    }
  }

  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  if (buffer.length >= 16 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brandSegment = buffer.subarray(8, Math.min(buffer.length, 32)).toString("ascii");

    if (brandSegment.includes("avif") || brandSegment.includes("avis")) {
      return "image/avif";
    }
  }

  return "";
}

function assertMimeMatchesSignature(buffer, mimeType) {
  const detectedMimeType = detectImageMimeType(buffer);

  if (!detectedMimeType) {
    throw createHttpError(400, "La imagen cargada no coincide con un formato seguro permitido.");
  }

  if (detectedMimeType !== mimeType) {
    throw createHttpError(400, "La imagen cargada no coincide con el formato declarado.");
  }
}

function safeFileStem(filename) {
  return (
    sanitizeText(filename.replace(/\.[^.]+$/, ""), 80)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "imagen"
  );
}

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);

  if (!match) {
    throw createHttpError(400, "La imagen cargada no tiene un formato permitido.");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const extension = allowedMimeTypes.get(mimeType);

  if (!extension) {
    throw createHttpError(400, "El tipo de imagen no esta permitido.");
  }

  const buffer = Buffer.from(base64, "base64");

  if (!buffer.byteLength) {
    throw createHttpError(400, "No fue posible leer la imagen cargada.");
  }

  if (buffer.byteLength > maxImageBytes) {
    throw createHttpError(413, "La imagen supera el limite permitido de 5 MB.");
  }

  assertMimeMatchesSignature(buffer, mimeType);

  return {
    mimeType,
    extension,
    buffer
  };
}

export async function uploadArticleImage(req, res, next) {
  try {
    const payload = imageUploadSchema.parse(req.body);
    const { extension, buffer } = decodeDataUrl(payload.dataUrl);
    const year = String(new Date().getFullYear());
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const folder = path.join(uploadsRoot, year, month);
    const fileStem = safeFileStem(payload.filename);
    const filename = `${Date.now()}-${crypto.randomUUID()}-${fileStem}.${extension}`;

    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, filename), buffer, {
      flag: "wx",
      mode: 0o600
    });

    const relativePath = `/uploads/news/${year}/${month}/${filename}`;

    res.status(201).json({
      url: buildPublicUrl(relativePath),
      alt: sanitizeText(payload.alt ?? "", 140),
      filename
    });
  } catch (error) {
    next(error);
  }
}
