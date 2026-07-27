export type MediaEmbedProvider = "youtube" | "vimeo" | "twitter" | "instagram";

export interface MediaEmbedDescriptor {
  provider: MediaEmbedProvider;
  sourceUrl: string;
  embedUrl: string | null;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function buildYouTubeDescriptor(url: URL): MediaEmbedDescriptor | null {
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
    sourceUrl: url.toString(),
    embedUrl: `https://www.youtube.com/embed/${videoId}`
  };
}

function buildVimeoDescriptor(url: URL): MediaEmbedDescriptor | null {
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
    sourceUrl: url.toString(),
    embedUrl: `https://player.vimeo.com/video/${match[1]}`
  };
}

function buildTwitterDescriptor(url: URL): MediaEmbedDescriptor | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (!["twitter.com", "x.com", "mobile.twitter.com", "mobile.x.com"].includes(host)) {
    return null;
  }

  const match = url.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)(?:\/)?$/i);

  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  const author = match[1].trim();
  const statusId = match[2].trim();

  if (!author || !/^\d{6,}$/.test(statusId)) {
    return null;
  }

  return {
    provider: "twitter",
    sourceUrl: `https://twitter.com/${author}/status/${statusId}`,
    embedUrl: null
  };
}

function buildInstagramDescriptor(url: URL): MediaEmbedDescriptor | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (!["instagram.com", "instagr.am"].includes(host)) {
    return null;
  }

  const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]{5,})(?:\/)?$/i);

  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  const mediaType = match[1].toLowerCase();
  const mediaId = match[2].trim();

  return {
    provider: "instagram",
    sourceUrl: `https://www.instagram.com/${mediaType}/${mediaId}/`,
    embedUrl: null
  };
}

export function resolveVideoEmbed(value: string): MediaEmbedDescriptor | null {
  const url = safeUrl(value.trim());

  if (!url || !["http:", "https:"].includes(url.protocol)) {
    return null;
  }

  return buildYouTubeDescriptor(url) ?? buildVimeoDescriptor(url) ?? buildTwitterDescriptor(url) ?? buildInstagramDescriptor(url);
}

export function isTweetEmbed(value: string): boolean {
  return resolveVideoEmbed(value)?.provider === "twitter";
}

export function resolveTweetEmbedSource(value: string): string | null {
  const resolved = resolveVideoEmbed(value);
  return resolved?.provider === "twitter" ? resolved.sourceUrl : null;
}

export function isInstagramEmbed(value: string): boolean {
  return resolveVideoEmbed(value)?.provider === "instagram";
}

export function resolveInstagramEmbedSource(value: string): string | null {
  const resolved = resolveVideoEmbed(value);
  return resolved?.provider === "instagram" ? resolved.sourceUrl : null;
}
