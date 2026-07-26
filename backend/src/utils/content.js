import path from "node:path";

import { env } from "../config/env.js";

const uploadsNewsPathPattern = /^\/uploads\/news\/[a-zA-Z0-9/_\-.]+$/;
const uploadsNewsRootPath = "/uploads/news/";
const allowedOwnedMediaOrigins = new Set(
  [env.publicServerUrl, env.publicSiteUrl]
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean)
);

export function sanitizeText(value, maxLength = 5000) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeParagraphs(input) {
  const items = Array.isArray(input) ? input : String(input ?? "").split(/\n{2,}/);

  return items
    .map((item) => sanitizeText(item, 4000))
    .filter(Boolean)
    .slice(0, 80);
}

export function sanitizeContentBlocks(input) {
  const items = Array.isArray(input) ? input : [];
  const blocks = [];
  const paragraphs = [];

  for (const item of items.slice(0, 120)) {
    if (typeof item === "string") {
      const text = sanitizeText(item, 4000);

      if (text) {
        blocks.push({
          type: "paragraph",
          text
        });
        paragraphs.push(text);
      }

      continue;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    if (item.type === "image") {
      const url = sanitizeOwnedMediaUrl(item.image?.url ?? "");

      if (!url) {
        continue;
      }

      blocks.push({
        type: "image",
        image: {
          url,
          alt: sanitizeText(item.image?.alt ?? "", 140),
          caption: sanitizeText(item.image?.caption ?? "", 220)
        }
      });
      continue;
    }

    if (item.type === "embed") {
      const embed = resolveVideoEmbedSource(sanitizeText(item.embed?.url ?? "", 1200));

      if (!embed) {
        continue;
      }

      blocks.push({
        type: "embed",
        embed: {
          url: embed.sourceUrl,
          provider: embed.provider,
          title: sanitizeText(item.embed?.title ?? "", 160)
        }
      });
      continue;
    }

    const text = sanitizeText(item.text ?? "", 4000);

    if (text) {
      blocks.push({
        type: "paragraph",
        text
      });
      paragraphs.push(text);
    }
  }

  return {
    blocks,
    paragraphs
  };
}

export function paragraphBlocksFromBody(paragraphs) {
  return sanitizeParagraphs(paragraphs).map((text) => ({
    type: "paragraph",
    text
  }));
}

export function sanitizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((item) => sanitizeText(item, 40).toLowerCase()).filter(Boolean))].slice(0, 10);
}

export function calculateReadingTime(paragraphs) {
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeOwnedUploadsPath(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const normalizedPath = path.posix.normalize(value.startsWith("/") ? value : `/${value}`);

  if (!normalizedPath.startsWith(uploadsNewsRootPath) || normalizedPath === uploadsNewsRootPath) {
    return "";
  }

  if (!uploadsNewsPathPattern.test(normalizedPath)) {
    return "";
  }

  return normalizedPath;
}

function buildYouTubeEmbed(url) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let videoId = "";

  if (host === "youtu.be") {
    videoId = url.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") ?? "";
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.replace("/embed/", "").split("/")[0] ?? "";
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.replace("/shorts/", "").split("/")[0] ?? "";
    }
  }

  if (!/^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
    return null;
  }

  return {
    provider: "youtube",
    sourceUrl: url.toString()
  };
}

function buildVimeoEmbed(url) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host !== "vimeo.com" && host !== "player.vimeo.com") {
    return null;
  }

  const match = url.pathname.match(/\/(?:video\/)?(\d{5,})/);

  if (!match?.[1]) {
    return null;
  }

  return {
    provider: "vimeo",
    sourceUrl: url.toString()
  };
}

export function resolveVideoEmbedSource(value) {
  if (!value) {
    return null;
  }

  const url = safeUrl(value);

  if (!url || !["http:", "https:"].includes(url.protocol)) {
    return null;
  }

  return buildYouTubeEmbed(url) ?? buildVimeoEmbed(url);
}

export function sanitizeOwnedMediaUrl(value) {
  const normalized = sanitizeText(value, 1200);

  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("/")) {
    return normalizeOwnedUploadsPath(normalized);
  }

  const url = safeUrl(normalized);

  if (!url || !["http:", "https:"].includes(url.protocol)) {
    return "";
  }

  const normalizedPath = normalizeOwnedUploadsPath(url.pathname);

  if (!normalizedPath || !allowedOwnedMediaOrigins.has(url.origin)) {
    return "";
  }

  return new URL(normalizedPath, `${url.origin}/`).toString();
}

export function isOwnedMediaUrl(value) {
  return Boolean(sanitizeOwnedMediaUrl(value));
}

export function slugify(value) {
  const normalized = sanitizeText(value, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "articulo";
}

export function isValidUrl(value) {
  return isOwnedMediaUrl(value);
}
