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

function buildCloudinaryFolder(year, month) {
  return [env.cloudinaryFolder, "news", year, month]
    .map((item) => sanitizeText(item ?? "", 80))
    .filter(Boolean)
    .map((item) => item.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function createCloudinarySignature(params) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${payload}${env.cloudinaryApiSecret}`)
    .digest("hex");
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

async function uploadToCloudinary({ buffer, mimeType, extension, fileStem, year, month }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = buildCloudinaryFolder(year, month);
  const publicId = `${Date.now()}-${crypto.randomUUID()}-${fileStem}`;
  const signature = createCloudinarySignature({
    folder,
    public_id: publicId,
    timestamp
  });
  const formData = new FormData();

  formData.append("file", new Blob([buffer], { type: mimeType }), `${fileStem}.${extension}`);
  formData.append("api_key", env.cloudinaryApiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("folder", folder);
  formData.append("public_id", publicId);
  formData.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/upload`, {
    method: "POST",
    body: formData
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.secure_url) {
    const message =
      payload?.error?.message
      || payload?.message
      || "Cloudinary rechazo la carga de la imagen.";

    throw createHttpError(502, message);
  }

  return {
    url: payload.secure_url,
    filename: payload.public_id ?? `${folder}/${publicId}`
  };
}

export async function uploadArticleImage(req, res, next) {
  try {
    const payload = imageUploadSchema.parse(req.body);
    const { extension, buffer, mimeType } = decodeDataUrl(payload.dataUrl);
    const year = String(new Date().getFullYear());
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const fileStem = safeFileStem(payload.filename);
    let uploaded;

    if (env.cloudinaryConfigured) {
      uploaded = await uploadToCloudinary({
        buffer,
        mimeType,
        extension,
        fileStem,
        year,
        month
      });
    } else {
      const folder = path.join(uploadsRoot, year, month);
      const filename = `${Date.now()}-${crypto.randomUUID()}-${fileStem}.${extension}`;

      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(path.join(folder, filename), buffer, {
        flag: "wx",
        mode: 0o600
      });

      const relativePath = `/uploads/news/${year}/${month}/${filename}`;
      uploaded = {
        url: buildPublicUrl(relativePath),
        filename
      };
    }

    res.status(201).json({
      url: uploaded.url,
      alt: sanitizeText(payload.alt ?? "", 140),
      filename: uploaded.filename
    });
  } catch (error) {
    next(error);
  }
}
