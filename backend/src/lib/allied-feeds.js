import { calculateReadingTime, resolveVideoEmbedSource, sanitizeContentBlocks, sanitizeParagraphs, sanitizeTags, sanitizeText, sanitizeEditorialMediaUrl } from "../utils/content.js";

const maxFeedXmlLength = 1_500_000;
const tokenPattern = /<figure\b[\s\S]*?<\/figure>|<blockquote\b[\s\S]*?<\/blockquote>|<h2\b[\s\S]*?<\/h2>|<h3\b[\s\S]*?<\/h3>|<p\b[\s\S]*?<\/p>|<iframe\b[\s\S]*?<\/iframe>|<img\b[^>]*\/?>/gi;
const alliedNoisePattern = /^(compartir|guardar|reportar|resumen|cerrar|comentar|escuchar|continuar|siguiente|anterior|newsletter|suscribete|suscr[ií]bete|publicidad|anuncio|lea tambi[eé]n|leer tambi[eé]n|relacionados?)$/i;
const alliedNoisePrefixPattern = /^(ingrese o reg[ií]strese|este resumen fue construido con ayuda de ia|sigue toda la informaci[oó]n|reciba .*newsletter|escucha .*art[ií]culo)/i;
const namedEntities = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " "
};

function safeUrl(value, baseUrl = undefined) {
  try {
    return new URL(value, baseUrl);
  } catch {
    return null;
  }
}

function normalizeHostValue(value) {
  const normalized = sanitizeText(value, 255).toLowerCase();

  if (!normalized) {
    return "";
  }

  const fromUrl = safeUrl(normalized)?.hostname || safeUrl(`https://${normalized}`)?.hostname;
  return sanitizeText(fromUrl ?? normalized, 255).toLowerCase();
}

function decodeHtmlEntities(value) {
  return String(value ?? "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = String(entity ?? "").toLowerCase();

    if (normalized in namedEntities) {
      return namedEntities[normalized];
    }

    if (normalized.startsWith("#x")) {
      const parsed = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    }

    if (normalized.startsWith("#")) {
      const parsed = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : match;
    }

    return match;
  });
}

function stripCdata(value) {
  return String(value ?? "")
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "");
}

function stripHtml(value) {
  return decodeHtmlEntities(
    String(value ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|figure)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function sanitizePlainText(value, maxLength = 6000) {
  return sanitizeText(stripHtml(value), maxLength);
}

function absolutizeUrl(value, baseUrl) {
  const normalized = sanitizeText(value, 1200);

  if (!normalized) {
    return "";
  }

  const url = safeUrl(normalized, baseUrl);

  if (!url || !["http:", "https:"].includes(url.protocol)) {
    return "";
  }

  url.hash = "";
  return url.toString();
}

function normalizeHtmlDocument(html) {
  return String(html ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");
}

function extractTagValue(fragment, tagNames = []) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
    const match = fragment.match(pattern);

    if (match?.[1]) {
      return stripCdata(match[1]).trim();
    }
  }

  return "";
}

function extractTagAttribute(fragment, tagNames = [], attributeName) {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${tagName}\\b[^>]*\\b${attributeName}\\s*=\\s*(['"])(.*?)\\1[^>]*>`, "i");
    const match = fragment.match(pattern);

    if (match?.[2]) {
      return stripCdata(match[2]).trim();
    }
  }

  return "";
}

function extractFirstLink(fragment, baseUrl) {
  const atomHref = extractTagAttribute(fragment, ["link"], "href");

  if (atomHref) {
    return absolutizeUrl(atomHref, baseUrl);
  }

  return absolutizeUrl(extractTagValue(fragment, ["link"]), baseUrl);
}

function extractEntryCategories(fragment) {
  const categories = [];
  const categoryPattern = /<category\b([^>]*)>([\s\S]*?)<\/category>|<category\b([^>]*)\/>/gi;

  for (const match of fragment.matchAll(categoryPattern)) {
    const attributes = match[1] || match[3] || "";
    const termMatch = attributes.match(/\bterm\s*=\s*(['"])(.*?)\1/i);
    const content = stripHtml(match[2] ?? "");
    const value = sanitizeText(termMatch?.[2] || content, 40).toLowerCase();

    if (value) {
      categories.push(value);
    }
  }

  return sanitizeTags(categories);
}

function extractImageData(fragment, baseUrl, allowedMediaHosts) {
  const srcMatch = fragment.match(/\bsrc\s*=\s*(['"])(.*?)\1/i);
  const dataSrcMatch = fragment.match(/\bdata-(?:src|lazy-src|original)\s*=\s*(['"])(.*?)\1/i);
  const candidateUrl = absolutizeUrl(srcMatch?.[2] || dataSrcMatch?.[2] || "", baseUrl);
  const url = sanitizeEditorialMediaUrl(candidateUrl, { allowedExternalHosts: allowedMediaHosts });

  if (!url) {
    return null;
  }

  const altMatch = fragment.match(/\balt\s*=\s*(['"])(.*?)\1/i);
  const captionMatch = fragment.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);

  return {
    url,
    alt: sanitizeText(decodeHtmlEntities(altMatch?.[2] ?? ""), 140),
    caption: sanitizeText(stripHtml(captionMatch?.[1] ?? ""), 220)
  };
}

function anchorHtmlToMarkdown(html, baseUrl) {
  return String(html ?? "").replace(/<a\b[^>]*href\s*=\s*(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_match, _quote, href, innerText) => {
    const absoluteUrl = absolutizeUrl(href, baseUrl);
    const label = sanitizeText(stripHtml(innerText), 160);

    if (!absoluteUrl) {
      return label;
    }

    return label ? `[${label}](${absoluteUrl})` : absoluteUrl;
  });
}

function inlineHtmlToParagraphText(html, baseUrl) {
  const withLinks = anchorHtmlToMarkdown(html, baseUrl);
  const normalized = decodeHtmlEntities(
    withLinks
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  return sanitizeText(normalized, 4000);
}

function extractEmbedData(fragment, baseUrl) {
  const url = absolutizeUrl(
    fragment.match(/\bsrc\s*=\s*(['"])(.*?)\1/i)?.[2] ?? fragment.match(/\bhref\s*=\s*(['"])(.*?)\1/i)?.[2] ?? "",
    baseUrl
  );
  const resolved = resolveVideoEmbedSource(url);

  if (!resolved) {
    return null;
  }

  return {
    url: resolved.sourceUrl,
    provider: resolved.provider,
    title: ""
  };
}

function htmlToEditorialBlocks(html, options = {}) {
  const baseUrl = options.baseUrl || "";
  const allowedMediaHosts = options.allowedMediaHosts || [];
  const normalizedHtml = normalizeHtmlDocument(html);
  const blocks = [];

  for (const match of normalizedHtml.matchAll(tokenPattern)) {
    const fragment = match[0] ?? "";
    const lowerFragment = fragment.trim().toLowerCase();

    if (lowerFragment.startsWith("<h2")) {
      const text = sanitizeText(stripHtml(fragment), 220);

      if (text) {
        blocks.push({
          type: "heading",
          heading: {
            text,
            align: "center",
            level: "h2"
          }
        });
      }

      continue;
    }

    if (lowerFragment.startsWith("<h3")) {
      const text = sanitizeText(stripHtml(fragment), 220);

      if (text) {
        blocks.push({
          type: "heading",
          heading: {
            text,
            align: "left",
            level: "h3"
          }
        });
      }

      continue;
    }

    if (lowerFragment.startsWith("<figure") || lowerFragment.startsWith("<img")) {
      const image = extractImageData(fragment, baseUrl, allowedMediaHosts);

      if (image) {
        blocks.push({
          type: "image",
          image
        });
      }

      continue;
    }

    if (lowerFragment.startsWith("<iframe")) {
      const embed = extractEmbedData(fragment, baseUrl);

      if (embed) {
        blocks.push({
          type: "embed",
          embed
        });
      }

      continue;
    }

    if (lowerFragment.startsWith("<blockquote")) {
      const quote = sanitizeText(stripHtml(fragment), 1200);

      if (quote) {
        blocks.push({
          type: "quote",
          quote: {
            text: quote,
            attribution: ""
          }
        });
      }

      continue;
    }

    if (lowerFragment.startsWith("<p")) {
      const paragraph = inlineHtmlToParagraphText(fragment, baseUrl);
      const standaloneEmbed = resolveVideoEmbedSource(paragraph);

      if (standaloneEmbed && paragraph === standaloneEmbed.sourceUrl) {
        blocks.push({
          type: "embed",
          embed: {
            url: standaloneEmbed.sourceUrl,
            provider: standaloneEmbed.provider,
            title: ""
          }
        });
        continue;
      }

      if (paragraph) {
        blocks.push({
          type: "paragraph",
          text: paragraph
        });
      }
    }
  }

  if (blocks.length > 0) {
    return blocks;
  }

  return sanitizeParagraphs(stripHtml(normalizedHtml)).map((text) => ({
    type: "paragraph",
    text
  }));
}

function extractFeedItems(xml) {
  const rssItems = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  if (rssItems.length > 0) {
    return rssItems;
  }

  return xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
}

function normalizeDate(value) {
  const candidate = sanitizeText(decodeHtmlEntities(stripCdata(value)), 120);

  if (!candidate) {
    return null;
  }

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractRawMediaUrls(fragment, baseUrl) {
  const candidates = [
    extractTagAttribute(fragment, ["media:content", "media:thumbnail", "enclosure"], "url"),
    extractTagAttribute(fragment, ["content"], "url"),
    ...Array.from(fragment.matchAll(/<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/gi)).map((match) => match[2] ?? "")
  ];

  return candidates
    .map((value) => absolutizeUrl(value, baseUrl))
    .filter(Boolean);
}

function extractMetaContent(html, attributeName, attributeValue) {
  const escapedValue = String(attributeValue ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const directPattern = new RegExp(
    `<meta\\b[^>]*${attributeName}\\s*=\\s*(['"])${escapedValue}\\1[^>]*content\\s*=\\s*(['"])([\\s\\S]*?)\\2[^>]*>`,
    "i"
  );
  const reversedPattern = new RegExp(
    `<meta\\b[^>]*content\\s*=\\s*(['"])([\\s\\S]*?)\\1[^>]*${attributeName}\\s*=\\s*(['"])${escapedValue}\\3[^>]*>`,
    "i"
  );

  const directMatch = html.match(directPattern);

  if (directMatch?.[3]) {
    return stripCdata(directMatch[3]).trim();
  }

  const reversedMatch = html.match(reversedPattern);
  return reversedMatch?.[2] ? stripCdata(reversedMatch[2]).trim() : "";
}

function extractTitleTag(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? stripCdata(match[1]).trim() : "";
}

function collectStructuredDataNodes(value, bucket) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStructuredDataNodes(entry, bucket);
    }

    return;
  }

  if (typeof value !== "object") {
    return;
  }

  bucket.push(value);

  if (Array.isArray(value["@graph"])) {
    collectStructuredDataNodes(value["@graph"], bucket);
  }
}

function parseJsonSafely(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isStructuredArticleType(typeValue) {
  const values = Array.isArray(typeValue) ? typeValue : [typeValue];
  return values.some((value) => /article/i.test(String(value ?? "")));
}

function extractStructuredDataArticle(html, baseUrl, allowedMediaHosts) {
  const scriptPattern = /<script\b[^>]*type\s*=\s*(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
  const nodes = [];

  for (const match of html.matchAll(scriptPattern)) {
    const parsed = parseJsonSafely(stripCdata(match[2] ?? "").trim());

    if (parsed) {
      collectStructuredDataNodes(parsed, nodes);
    }
  }

  const articleNode = nodes.find((node) => isStructuredArticleType(node?.["@type"]));

  if (!articleNode) {
    return null;
  }

  const imageValue = Array.isArray(articleNode.image) ? articleNode.image[0] : articleNode.image;
  const imageUrl = sanitizeEditorialMediaUrl(
    absolutizeUrl(
      typeof imageValue === "string"
        ? imageValue
        : imageValue?.url || imageValue?.["@id"] || "",
      baseUrl
    ),
    { allowedExternalHosts: allowedMediaHosts }
  );
  const authorValue = Array.isArray(articleNode.author) ? articleNode.author[0] : articleNode.author;
  const authorName = sanitizeText(
    typeof authorValue === "string" ? authorValue : authorValue?.name || "",
    120
  );

  return {
    title: sanitizeText(stripHtml(articleNode.headline ?? articleNode.name ?? ""), 180),
    description: sanitizeText(stripHtml(articleNode.description ?? ""), 320),
    articleBody: sanitizePlainText(articleNode.articleBody ?? "", 12000),
    imageUrl,
    publishedAt: normalizeDate(articleNode.datePublished ?? articleNode.dateCreated ?? articleNode.dateModified ?? ""),
    authorName
  };
}

function extractArticleContainerHtml(html) {
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);

  if (articleMatch?.[1]) {
    return articleMatch[1];
  }

  const selectorPatterns = [
    /<(main|section|div)\b[^>]*(?:id|class)\s*=\s*(['"])[^"']*(?:article-body|article__body|story-body|content-body|post-content|entry-content|article-content|contenido-nota|cuerpo-nota|news-content)[^"']*\2[^>]*>([\s\S]*?)<\/\1>/i
  ];

  for (const pattern of selectorPatterns) {
    const match = html.match(pattern);

    if (match?.[3]) {
      return match[3];
    }
  }

  return "";
}

function paragraphBlocksFromText(value) {
  return sanitizeParagraphs(value).map((text) => ({
    type: "paragraph",
    text
  }));
}

function isEditorialNoiseText(value) {
  const text = sanitizeText(value, 4000);

  if (!text) {
    return true;
  }

  if (/^https?:\/\//i.test(text)) {
    return true;
  }

  if (alliedNoisePattern.test(text) || alliedNoisePrefixPattern.test(text)) {
    return true;
  }

  if (/^(00:)?\d{1,2}:\d{2}$/.test(text) || /^[123]x$/i.test(text)) {
    return true;
  }

  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= 3 && text.length <= 32 && !/[.!?:;]$/.test(text)) {
    return true;
  }

  return false;
}

function cleanAlliedEditorialBlocks(blocks = []) {
  const cleaned = [];

  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!block || typeof block !== "object") {
      continue;
    }

    if (block.type === "paragraph") {
      const text = sanitizeText(block.text ?? "", 4000);

      if (text && !isEditorialNoiseText(text)) {
        cleaned.push({
          type: "paragraph",
          text
        });
      }

      continue;
    }

    if (block.type === "heading") {
      const text = sanitizeText(block.heading?.text ?? "", 220);

      if (text && !isEditorialNoiseText(text)) {
        cleaned.push({
          type: "heading",
          heading: {
            text,
            align: block.heading?.align === "center" ? "center" : "left",
            level: block.heading?.level === "h3" ? "h3" : "h2"
          }
        });
      }

      continue;
    }

    if (block.type === "quote") {
      const text = sanitizeText(block.quote?.text ?? "", 1200);

      if (text && !isEditorialNoiseText(text)) {
        cleaned.push({
          type: "quote",
          quote: {
            text,
            attribution: sanitizeText(block.quote?.attribution ?? "", 140)
          }
        });
      }
    }
  }

  return cleaned;
}

function splitStructuredArticleBody(value) {
  const text = String(value ?? "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    return [];
  }

  const explicitParagraphs = text
    .split(/\n{2,}/)
    .map((item) => sanitizeText(item, 4000))
    .filter((item) => item && !isEditorialNoiseText(item));

  if (explicitParagraphs.length >= 2) {
    return explicitParagraphs;
  }

  const normalized = sanitizeText(text, 20000);

  if (!normalized) {
    return [];
  }

  const sentences = normalized.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [normalized];
  const paragraphs = [];
  let buffer = "";
  let sentenceCount = 0;

  for (const sentence of sentences) {
    const chunk = sanitizeText(sentence, 1200);

    if (!chunk || isEditorialNoiseText(chunk)) {
      continue;
    }

    buffer = buffer ? `${buffer} ${chunk}` : chunk;
    sentenceCount += 1;

    if (buffer.length >= 320 || sentenceCount >= 3) {
      paragraphs.push(buffer);
      buffer = "";
      sentenceCount = 0;
    }
  }

  if (buffer) {
    paragraphs.push(buffer);
  }

  return sanitizeParagraphs(paragraphs);
}

function scoreEditorialBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : []).reduce((score, block) => {
    if (block.type === "paragraph") {
      return score + Math.min(500, sanitizeText(block.text ?? "", 4000).length);
    }

    if (block.type === "quote") {
      return score + Math.min(240, sanitizeText(block.quote?.text ?? "", 1200).length);
    }

    if (block.type === "heading") {
      return score + Math.min(120, sanitizeText(block.heading?.text ?? "", 220).length);
    }

    return score;
  }, 0);
}

export function buildAllowedFeedHosts(source) {
  const values = [
    ...(Array.isArray(source?.allowedMediaHosts) ? source.allowedMediaHosts : []),
    source?.feedUrl ?? "",
    source?.siteUrl ?? ""
  ];

  return [...new Set(values.map((value) => normalizeHostValue(value)).filter(Boolean))];
}

export function parseAlliedArticleDocument(html, source, originalUrl = "") {
  const rawHtml = String(html ?? "").trim();

  if (!rawHtml) {
    return null;
  }

  const allowedMediaHosts = buildAllowedFeedHosts(source);
  const baseUrl = originalUrl || source?.siteUrl || source?.feedUrl || "";
  const structuredData = extractStructuredDataArticle(rawHtml, baseUrl, allowedMediaHosts);
  const normalizedHtml = normalizeHtmlDocument(rawHtml);
  const articleHtml = extractArticleContainerHtml(normalizedHtml);
  const htmlBlocks = cleanAlliedEditorialBlocks(
    articleHtml ? htmlToEditorialBlocks(articleHtml, { baseUrl, allowedMediaHosts }) : []
  );
  const structuredBlocks = paragraphBlocksFromText(splitStructuredArticleBody(structuredData?.articleBody ?? ""));
  const htmlScore = scoreEditorialBlocks(htmlBlocks);
  const structuredScore = scoreEditorialBlocks(structuredBlocks);
  const preferredBlocks =
    structuredScore > 0 && (structuredScore >= htmlScore || htmlScore < 400)
      ? structuredBlocks
      : htmlBlocks;
  const sanitizedContent = sanitizeContentBlocks(preferredBlocks, {
    allowedExternalHosts: allowedMediaHosts
  });
  const contentBlocks = sanitizedContent.blocks;
  const body = sanitizedContent.paragraphs;
  const fallbackTitle =
    extractMetaContent(normalizedHtml, "property", "og:title") ||
    extractMetaContent(normalizedHtml, "name", "twitter:title") ||
    extractTitleTag(normalizedHtml);
  const fallbackDescription =
    extractMetaContent(normalizedHtml, "property", "og:description") ||
    extractMetaContent(normalizedHtml, "name", "description") ||
    structuredData?.description ||
    body[0] ||
    "";
  const coverFromMeta = sanitizeEditorialMediaUrl(
    absolutizeUrl(
      extractMetaContent(normalizedHtml, "property", "og:image") ||
        extractMetaContent(normalizedHtml, "name", "twitter:image") ||
        structuredData?.imageUrl ||
        "",
      baseUrl
    ),
    { allowedExternalHosts: allowedMediaHosts }
  );

  return {
    title: sanitizeText(stripHtml(structuredData?.title || fallbackTitle), 180),
    excerpt: sanitizeText(stripHtml(fallbackDescription), 320),
    body,
    contentBlocks,
    cover: {
      url: coverFromMeta,
      alt: sanitizeText(stripHtml(structuredData?.title || fallbackTitle), 140),
      type: "image",
      positionX: 50,
      positionY: 0
    },
    publishedAt:
      structuredData?.publishedAt ||
      normalizeDate(
        extractMetaContent(normalizedHtml, "property", "article:published_time") ||
          extractMetaContent(normalizedHtml, "name", "publish-date")
      ),
    readingTime: calculateReadingTime(body),
    authorName:
      structuredData?.authorName ||
      sanitizeText(
        stripHtml(
          extractMetaContent(normalizedHtml, "name", "author") ||
            extractMetaContent(normalizedHtml, "property", "article:author")
        ),
        120
      ),
    allowedMediaHosts
  };
}

export function parseAlliedFeedDocument(xml, source) {
  const rawXml = String(xml ?? "").trim();

  if (!rawXml) {
    throw new Error("El feed remoto no devolvió contenido.");
  }

  if (rawXml.length > maxFeedXmlLength) {
    throw new Error("El feed remoto excede el tamaño máximo permitido para importación.");
  }

  const allowedMediaHosts = buildAllowedFeedHosts(source);
  const baseUrl = source?.siteUrl || source?.feedUrl || "";
  const items = extractFeedItems(rawXml);

  return items.map((fragment) => {
    const title = sanitizeText(decodeHtmlEntities(stripHtml(extractTagValue(fragment, ["title"]))), 180);
    const link = extractFirstLink(fragment, baseUrl);
    const guid = sanitizeText(decodeHtmlEntities(stripHtml(extractTagValue(fragment, ["guid", "id"]))), 240) || link;
    const authorName = sanitizeText(
      decodeHtmlEntities(stripHtml(extractTagValue(fragment, ["dc:creator", "author", "creator", "name"]))),
      120
    );
    const descriptionHtml = stripCdata(extractTagValue(fragment, ["content:encoded", "content", "description", "summary"]));
    const rawMediaUrls = extractRawMediaUrls(fragment, baseUrl);
    const blocksSource = htmlToEditorialBlocks(descriptionHtml, {
      baseUrl,
      allowedMediaHosts
    });
    const sanitizedContent = sanitizeContentBlocks(blocksSource, {
      allowedExternalHosts: allowedMediaHosts
    });
    const contentBlocks = sanitizedContent.blocks;
    const body = sanitizedContent.paragraphs;
    const plainDescription = sanitizePlainText(descriptionHtml, 320);
    const excerpt = sanitizeText(plainDescription || body[0] || title, 320);
    const coverFromBlocks = contentBlocks.find((block) => block.type === "image")?.image?.url ?? "";
    const coverFromFeed = rawMediaUrls
      .map((candidate) => sanitizeEditorialMediaUrl(candidate, { allowedExternalHosts: allowedMediaHosts }))
      .find(Boolean) ?? "";
    const publishedAt = normalizeDate(
      extractTagValue(fragment, ["pubDate", "published", "updated", "dc:date"])
    );

    return {
      title,
      originalUrl: link,
      originalGuid: guid,
      authorName,
      tags: sanitizeTags([
        ...extractEntryCategories(fragment),
        ...(Array.isArray(source?.defaultTags) ? source.defaultTags : [])
      ]),
      excerpt,
      body,
      contentBlocks,
      cover: {
        url: coverFromBlocks || coverFromFeed,
        alt: sanitizeText(title, 140),
        type: "image",
        positionX: 50,
        positionY: 0
      },
      publishedAt,
      readingTime: calculateReadingTime(body),
      allowedMediaHosts
    };
  }).filter((item) => item.title && (item.contentBlocks.length > 0 || item.cover.url || item.excerpt));
}
