export type VideoEmbedProvider = "youtube" | "vimeo";

export interface VideoEmbedDescriptor {
  provider: VideoEmbedProvider;
  sourceUrl: string;
  embedUrl: string;
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function buildYouTubeDescriptor(url: URL): VideoEmbedDescriptor | null {
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

function buildVimeoDescriptor(url: URL): VideoEmbedDescriptor | null {
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

export function resolveVideoEmbed(value: string): VideoEmbedDescriptor | null {
  const url = safeUrl(value.trim());

  if (!url || !["http:", "https:"].includes(url.protocol)) {
    return null;
  }

  return buildYouTubeDescriptor(url) ?? buildVimeoDescriptor(url);
}
