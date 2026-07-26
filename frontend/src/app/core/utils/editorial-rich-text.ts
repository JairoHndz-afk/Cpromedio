function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHref(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("mailto:")) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function renderAutoLinkedHtml(segment: string): string {
  const urlPattern = /((?:https?:\/\/|mailto:)[^\s<>"')\]]+)/g;
  let html = "";
  let lastIndex = 0;

  for (const match of segment.matchAll(urlPattern)) {
    const [rawUrl] = match;
    const matchIndex = match.index ?? 0;
    const safeHref = sanitizeHref(rawUrl);

    html += escapeHtml(segment.slice(lastIndex, matchIndex));

    if (safeHref) {
      html += `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(rawUrl)}</a>`;
    } else {
      html += escapeHtml(rawUrl);
    }

    lastIndex = matchIndex + rawUrl.length;
  }

  html += escapeHtml(segment.slice(lastIndex));
  return html;
}

export function renderEditorialText(value: string): string {
  const source = String(value ?? "");
  const markdownLinkPattern = /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g;
  let html = "";
  let lastIndex = 0;

  for (const match of source.matchAll(markdownLinkPattern)) {
    const [rawMatch, rawLabel, rawHref] = match;
    const matchIndex = match.index ?? 0;
    const safeHref = sanitizeHref(rawHref);

    html += renderAutoLinkedHtml(source.slice(lastIndex, matchIndex));

    if (safeHref) {
      html += `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(rawLabel.trim() || rawHref)}</a>`;
    } else {
      html += escapeHtml(rawMatch);
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  html += renderAutoLinkedHtml(source.slice(lastIndex));
  return html;
}
