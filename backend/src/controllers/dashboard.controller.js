import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import { buildCookieOptions, signAuthToken } from "../lib/auth.js";
import { writeAuditLog } from "../lib/audit.js";
import { dispatchPublishedArticleBulletin } from "./public.controller.js";
import {
  clearFeaturedArticleSelection,
  clearSiteCommunication,
  getActiveSiteCommunication,
  saveSiteCommunication,
  serializeSiteCommunication,
  setFeaturedArticleSelection
} from "../lib/site-settings.js";
import { buildAllowedFeedHosts, parseAlliedArticleDocument, parseAlliedFeedDocument } from "../lib/allied-feeds.js";
import { AlliedFeedSource } from "../models/AlliedFeedSource.js";
import { Article } from "../models/Article.js";
import { ArticleComment } from "../models/ArticleComment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Category } from "../models/Category.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { calculateReadingTime, isValidUrl, paragraphBlocksFromBody, sanitizeContentBlocks, sanitizeEditorialMediaUrl, sanitizeOwnedMediaUrl, sanitizeParagraphs, sanitizeTags, sanitizeText, slugify } from "../utils/content.js";
import { readBoundedPositiveInt } from "../utils/request.js";
import { alliedFeedHostEntrySchema, alliedFeedInputSchema } from "../validators/allied-feed.validator.js";
import { articleInputSchema, moderationSchema } from "../validators/article.validator.js";
import { commentModerationSchema } from "../validators/comment.validator.js";
import { categoryInputSchema } from "../validators/category.validator.js";
import { communicationInputSchema } from "../validators/site-setting.validator.js";
import { passwordChangeSchema, profileUpdateSchema, subscriptionUpdateSchema, userCreateSchema, userUpdateSchema } from "../validators/user.validator.js";

const readerNameChangeWindowMs = 7 * 24 * 60 * 60 * 1000;

function clampCoverPosition(value, fallback = 50) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(numericValue * 10) / 10));
}

function visibleArticleFilter(filters = {}) {
  return {
    ...filters,
    deletedAt: null
  };
}

function serializeCover(cover = {}) {
  return {
    url: sanitizeOwnedMediaUrl(cover?.url ?? ""),
    alt: cover?.alt ?? "",
    type: cover?.type ?? "image",
    positionX: clampCoverPosition(cover?.positionX, 50),
    positionY: clampCoverPosition(cover?.positionY, 50)
  };
}

function serializeSyndication(article) {
  const sourceType = article?.syndication?.sourceType === "allied_rss" ? "allied_rss" : "original";
  const allowedMediaHosts = Array.isArray(article?.syndication?.allowedMediaHosts)
    ? article.syndication.allowedMediaHosts.filter(Boolean)
    : [];

  return {
    sourceType,
    sourceName: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.sourceName ?? "", 80) : "",
    sourceUrl: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.sourceUrl ?? "", 500) : "",
    originalUrl: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.originalUrl ?? "", 500) : "",
    originalGuid: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.originalGuid ?? "", 240) : "",
    authorName: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.authorName ?? "", 120) : "",
    attributionLabel: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.attributionLabel ?? "", 80) : "",
    importedAt: article?.syndication?.importedAt ?? null,
    allowedMediaHosts
  };
}

function serializeAlliedFeedSource(source) {
  return {
    id: source._id.toString(),
    name: source.name,
    slug: source.slug,
    feedUrl: source.feedUrl,
    siteUrl: source.siteUrl,
    attributionLabel: source.attributionLabel,
    logoUrl: source.logoUrl,
    allowedMediaHosts: Array.isArray(source.allowedMediaHosts) ? source.allowedMediaHosts : [],
    defaultTags: Array.isArray(source.defaultTags) ? source.defaultTags : [],
    defaultCategoryId: source.defaultCategory?._id?.toString?.() ?? source.defaultCategory?.toString?.() ?? "",
    defaultCategoryName: source.defaultCategory?.name ?? "",
    importMode: source.importMode,
    maxItemsPerSync: source.maxItemsPerSync,
    permissionNote: source.permissionNote,
    isActive: source.isActive,
    lastFetchedAt: source.lastFetchedAt ?? null,
    lastImportedAt: source.lastImportedAt ?? null,
    lastImportCount: Number(source.lastImportCount ?? 0),
    lastSkippedCount: Number(source.lastSkippedCount ?? 0),
    lastError: source.lastError ?? "",
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  };
}

function serializeArticle(article) {
  const rawContentBlocks =
    Array.isArray(article.contentBlocks) && article.contentBlocks.length > 0
      ? article.contentBlocks
      : paragraphBlocksFromBody(article.body ?? []);
  const allowedExternalHosts =
    article?.syndication?.sourceType === "allied_rss" && article?.syndication?.allowExternalMedia
      ? buildAllowedFeedHosts(article.syndication)
      : [];
  const sanitizedContentBlocks = sanitizeContentBlocks(rawContentBlocks, {
    allowedExternalHosts
  }).blocks;
  const contentBlocks = sanitizedContentBlocks.length > 0 ? sanitizedContentBlocks : paragraphBlocksFromBody(article.body ?? []);

  return {
    id: article._id.toString(),
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle,
    excerpt: article.excerpt,
    body: article.body,
    contentBlocks,
    cover: {
      ...serializeCover(article.cover),
      url:
        article?.syndication?.sourceType === "allied_rss" && article?.syndication?.allowExternalMedia
          ? sanitizeEditorialMediaUrl(article.cover?.url ?? "", { allowedExternalHosts })
          : serializeCover(article.cover).url
    },
    author: article.author
      ? {
          id: article.author._id.toString(),
          name: article.author.name,
          email: article.author.email,
          role: article.author.role
        }
      : null,
    category: article.category
      ? {
          id: article.category._id.toString(),
          name: article.category.name,
          slug: article.category.slug
        }
      : null,
    tags: article.tags,
    metrics: article.metrics ?? { views: 0, shares: 0, reactions: 0 },
    status: article.status,
    featured: article.featured,
    isPremium: article.isPremium,
    readingTime: article.readingTime,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    deletedAt: article.deletedAt ?? null,
    moderationNote: article.moderationNote,
    moderationHistory: article.moderationHistory ?? [],
    syndication: serializeSyndication(article)
  };
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatar: {
      url: sanitizeOwnedMediaUrl(user.avatar?.url ?? ""),
      alt: sanitizeText(user.avatar?.alt ?? "", 140)
    },
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null
  };
}

function serializeCategory(category) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description,
    isActive: category.isActive
  };
}

function serializeArticleComment(comment) {
  return {
    id: comment._id.toString(),
    articleId: comment.article?._id?.toString?.() ?? comment.article?.toString?.() ?? "",
    authorName: sanitizeText(comment.authorName ?? "", 80),
    authorAvatarUrl: sanitizeOwnedMediaUrl(comment.authorAvatarUrl ?? ""),
    authorAvatarAlt: sanitizeText(comment.authorAvatarAlt ?? "", 140),
    body: sanitizeText(comment.body ?? "", 1600),
    status: comment.status,
    censored: comment.censored === true,
    censoredTerms: Array.isArray(comment.censoredTerms) ? comment.censoredTerms : [],
    featured: comment.featured === true,
    moderationNote: sanitizeText(comment.moderationNote ?? "", 240),
    createdAt: comment.createdAt,
    moderatedAt: comment.moderatedAt ?? null,
    moderatedBy: comment.moderatedBy
      ? {
          id: comment.moderatedBy._id.toString(),
          name: comment.moderatedBy.name,
          email: comment.moderatedBy.email ?? "",
          role: comment.moderatedBy.role
        }
      : null
  };
}

async function buildUniqueSlug(title, currentId = null) {
  const baseSlug = slugify(title);
  let nextSlug = baseSlug;
  let attempts = 0;

  while (attempts < 20) {
    const existing = await Article.findOne({
      slug: nextSlug,
      ...(currentId ? { _id: { $ne: currentId } } : {})
    }).select("_id");

    if (!existing) {
      return nextSlug;
    }

    attempts += 1;
    nextSlug = `${baseSlug}-${attempts + 1}`;
  }

  return `${baseSlug}-${Date.now()}`;
}

function normalizeSyndicatedEditableInput(input, allowedExternalHosts = []) {
  const title = sanitizeText(input?.title ?? "", 180);

  if (title.length < 6) {
    const error = new Error("El título debe tener al menos 6 caracteres.");
    error.status = 400;
    throw error;
  }

  const statusOptions = ["draft", "review", "changes_requested", "approved", "published", "archived", "rejected"];
  const normalizedStatus = sanitizeText(input?.status ?? "", 40);
  const contentBlocksSource =
    Array.isArray(input?.contentBlocks) && input.contentBlocks.length > 0
      ? input.contentBlocks
      : sanitizeParagraphs(input?.body);
  const { blocks: contentBlocks, paragraphs: body } = sanitizeContentBlocks(contentBlocksSource, {
    allowedExternalHosts
  });

  if (contentBlocks.length === 0) {
    const error = new Error("El artículo debe incluir contenido.");
    error.status = 400;
    throw error;
  }

  return {
    title,
    subtitle: sanitizeText(input?.subtitle ?? "", 220),
    excerpt: sanitizeText(input?.excerpt ?? "", 320),
    body,
    contentBlocks,
    cover: {
      url: sanitizeEditorialMediaUrl(input?.cover?.url ?? "", {
        allowedExternalHosts
      }),
      alt: sanitizeText(input?.cover?.alt ?? "", 140),
      type: ["image", "video", "audio", "infographic"].includes(input?.cover?.type) ? input.cover.type : "image",
      positionX: clampCoverPosition(input?.cover?.positionX, 50),
      positionY: clampCoverPosition(input?.cover?.positionY, 50)
    },
    categoryId: typeof input?.categoryId === "string" ? input.categoryId : null,
    tags: Array.isArray(input?.tags) ? input.tags : [],
    isPremium: Boolean(input?.isPremium),
    featured: Boolean(input?.featured),
    status: statusOptions.includes(normalizedStatus) ? normalizedStatus : "draft"
  };
}

async function normalizeArticlePayload(input, currentArticle = null) {
  const allowedExternalHosts =
    currentArticle?.syndication?.sourceType === "allied_rss" && currentArticle?.syndication?.allowExternalMedia
      ? buildAllowedFeedHosts(currentArticle.syndication)
      : [];
  const parsed =
    allowedExternalHosts.length > 0
      ? normalizeSyndicatedEditableInput(input, allowedExternalHosts)
      : articleInputSchema.parse(input);
  const contentSource = parsed.contentBlocks.length > 0 ? parsed.contentBlocks : sanitizeParagraphs(parsed.body);
  const { blocks: contentBlocks, paragraphs: body } = sanitizeContentBlocks(contentSource, {
    allowedExternalHosts
  });

  if (contentBlocks.length === 0) {
    const error = new Error("El artículo debe incluir contenido.");
    error.status = 400;
    throw error;
  }

  const slug = await buildUniqueSlug(parsed.title, currentArticle?._id ?? null);
  const coverUrl = sanitizeText(parsed.cover?.url ?? "", 600);
  let categoryId = null;

  if (parsed.categoryId) {
    if (!mongoose.isValidObjectId(parsed.categoryId)) {
      const error = new Error("La categoría seleccionada no es válida.");
      error.status = 400;
      throw error;
    }

    const category = await Category.findById(parsed.categoryId).select("_id");
    if (!category) {
      const error = new Error("La categoría seleccionada no existe.");
      error.status = 400;
      throw error;
    }

    categoryId = category._id;
  }

  const explicitExcerpt = sanitizeText(parsed.excerpt ?? "", 320);
  const derivedExcerpt = sanitizeText(
    explicitExcerpt
      || body[0]
      || `${parsed.subtitle ?? ""} ${parsed.title ?? ""}`
      || `${parsed.title ?? ""} Cobertura editorial en desarrollo.`,
    320
  );
  const excerpt = derivedExcerpt.length >= 20
    ? derivedExcerpt
    : sanitizeText(`${parsed.title ?? ""} ${parsed.subtitle ?? ""} Cobertura editorial en desarrollo.`, 320);

  return {
    title: sanitizeText(parsed.title, 180),
    slug,
    subtitle: sanitizeText(parsed.subtitle ?? "", 220),
    excerpt,
    body,
    contentBlocks,
    cover: {
      url:
        allowedExternalHosts.length > 0
          ? sanitizeEditorialMediaUrl(coverUrl, { allowedExternalHosts })
          : (isValidUrl(coverUrl) ? coverUrl : ""),
      alt: sanitizeText(parsed.cover?.alt ?? "", 140),
      type: parsed.cover?.type ?? "image",
      positionX: clampCoverPosition(parsed.cover?.positionX, 50),
      positionY: clampCoverPosition(parsed.cover?.positionY, 50)
    },
    category: categoryId,
    tags: sanitizeTags(parsed.tags),
    featured: parsed.featured && parsed.status === "published",
    isPremium: parsed.isPremium,
    status: parsed.status,
    readingTime: calculateReadingTime(body),
    syndication: currentArticle?.syndication?.sourceType === "allied_rss" ? currentArticle.syndication : undefined,
    seo: {
      title: sanitizeText(parsed.title, 180),
      description: sanitizeText(excerpt, 160)
    }
  };
}

function applyEditorialRestrictions(user, payload, currentArticle = null) {
  if (user.role === "admin") {
    return payload;
  }

  return {
    ...payload,
    featured: false,
    status:
      currentArticle?.status && ["review", "published", "archived", "approved", "rejected"].includes(currentArticle.status)
        ? currentArticle.status
        : "draft"
  };
}

function canAccessArticle(user, article) {
  return user.role === "admin" || article.author?._id?.toString() === user._id.toString();
}

function escapeRegexLiteral(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCommunicationDurationHours(preset, hours) {
  if (preset === "week") {
    return 24 * 7;
  }

  if (preset === "month") {
    return 24 * 30;
  }

  return Math.min(24 * 31, Math.max(1, Number(hours ?? 24)));
}

function normalizeCommunicationPayload(input) {
  const parsed = communicationInputSchema.parse(input);
  const publishedAt = new Date();
  const durationHours = buildCommunicationDurationHours(parsed.durationPreset, parsed.durationHours);
  const expiresAt = new Date(publishedAt.getTime() + durationHours * 60 * 60 * 1000);
  const ctaUrl = sanitizeText(parsed.ctaUrl ?? "", 500);

  return {
    eyebrow: sanitizeText(parsed.eyebrow ?? "", 60) || "Comunicado editorial",
    title: sanitizeText(parsed.title, 140),
    message: sanitizeText(parsed.message, 1200),
    ctaLabel: sanitizeText(parsed.ctaLabel ?? "", 40) || (ctaUrl ? "Leer ahora" : ""),
    ctaUrl,
    durationHours,
    publishedAt,
    expiresAt,
    version: `comm-${publishedAt.getTime()}`
  };
}

async function buildUniqueAlliedFeedSlug(name, currentId = null) {
  const baseSlug = slugify(name);
  let nextSlug = baseSlug;
  let attempts = 0;

  while (attempts < 20) {
    const existing = await AlliedFeedSource.findOne({
      slug: nextSlug,
      ...(currentId ? { _id: { $ne: currentId } } : {})
    }).select("_id");

    if (!existing) {
      return nextSlug;
    }

    attempts += 1;
    nextSlug = `${baseSlug}-${attempts + 1}`;
  }

  return `${baseSlug}-${Date.now()}`;
}

function normalizeAlliedFeedHostsInput(values = []) {
  const entries = Array.isArray(values) ? values : [];
  const hosts = [];

  for (const entry of entries) {
    const host = alliedFeedHostEntrySchema.parse(entry);

    if (host && !hosts.includes(host)) {
      hosts.push(host);
    }
  }

  return hosts.slice(0, 20);
}

async function normalizeAlliedFeedPayload(input, currentSource = null) {
  const parsed = alliedFeedInputSchema.parse(input);
  let defaultCategoryId = null;

  if (parsed.defaultCategoryId) {
    if (!mongoose.isValidObjectId(parsed.defaultCategoryId)) {
      const error = new Error("La categoría base del medio aliado no es válida.");
      error.status = 400;
      throw error;
    }

    const category = await Category.findById(parsed.defaultCategoryId).select("_id");

    if (!category) {
      const error = new Error("La categoría base del medio aliado no existe.");
      error.status = 400;
      throw error;
    }

    defaultCategoryId = category._id;
  }

  return {
    name: sanitizeText(parsed.name, 80),
    slug: await buildUniqueAlliedFeedSlug(parsed.name, currentSource?._id ?? null),
    feedUrl: sanitizeText(parsed.feedUrl, 500),
    siteUrl: sanitizeText(parsed.siteUrl ?? "", 500),
    attributionLabel: sanitizeText(parsed.attributionLabel ?? "", 80) || sanitizeText(parsed.name, 80),
    logoUrl: sanitizeText(parsed.logoUrl ?? "", 500),
    allowedMediaHosts: normalizeAlliedFeedHostsInput(parsed.allowedMediaHosts),
    defaultTags: sanitizeTags(parsed.defaultTags),
    defaultCategory: defaultCategoryId,
    importMode: parsed.importMode,
    maxItemsPerSync: Math.max(1, Math.min(20, Number(parsed.maxItemsPerSync ?? 5))),
    permissionNote: sanitizeText(parsed.permissionNote ?? "", 240),
    isActive: parsed.isActive
  };
}

function mapFeedImportModeToStatus(importMode) {
  if (importMode === "review") {
    return "review";
  }

  if (importMode === "published") {
    return "published";
  }

  return "draft";
}

async function fetchRemoteFeedXml(feedUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
        "user-agent": "ColombianoPromedioRSS/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`El feed respondió con estado ${response.status}.`);
    }

    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("El feed aliado tardó demasiado en responder.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRemoteArticleHtml(articleUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(articleUrl, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "ColombianoPromedioRSS/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`La nota original respondio con estado ${response.status}.`);
    }

    return await response.text();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("La nota original tardo demasiado en responder.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isAllowedAlliedArticleUrl(url, source) {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    const hostname = parsedUrl.hostname.trim().toLowerCase();
    const allowedHosts = buildAllowedFeedHosts(source);
    return allowedHosts.some((allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`));
  } catch {
    return false;
  }
}

function shouldHydrateAlliedDraftFromArticlePage(draft) {
  const bodyLength = Array.isArray(draft?.body) ? draft.body.join(" ").trim().length : 0;
  const blockCount = Array.isArray(draft?.contentBlocks) ? draft.contentBlocks.length : 0;
  return bodyLength < 700 || blockCount < 4 || !draft?.cover?.url;
}

async function hydrateAlliedDraftFromArticlePage(draft, source) {
  if (!draft?.originalUrl || !isAllowedAlliedArticleUrl(draft.originalUrl, source) || !shouldHydrateAlliedDraftFromArticlePage(draft)) {
    return draft;
  }

  try {
    const articleHtml = await fetchRemoteArticleHtml(draft.originalUrl);
    const parsedArticle = parseAlliedArticleDocument(articleHtml, source, draft.originalUrl);

    if (!parsedArticle) {
      return draft;
    }

    const draftScore = (draft.body?.join(" ").trim().length ?? 0) + ((draft.contentBlocks?.length ?? 0) * 90);
    const parsedScore = (parsedArticle.body?.join(" ").trim().length ?? 0) + ((parsedArticle.contentBlocks?.length ?? 0) * 90);
    const hasBetterContent = parsedScore > draftScore;

    return {
      ...draft,
      title: draft.title || parsedArticle.title,
      excerpt: hasBetterContent ? (parsedArticle.excerpt || draft.excerpt) : (draft.excerpt || parsedArticle.excerpt),
      body: hasBetterContent && parsedArticle.body.length > 0 ? parsedArticle.body : draft.body,
      contentBlocks: hasBetterContent && parsedArticle.contentBlocks.length > 0 ? parsedArticle.contentBlocks : draft.contentBlocks,
      cover: parsedArticle.cover?.url ? parsedArticle.cover : draft.cover,
      publishedAt: parsedArticle.publishedAt || draft.publishedAt,
      readingTime: hasBetterContent
        ? Math.max(1, Number(parsedArticle.readingTime ?? draft.readingTime ?? 1))
        : Math.max(1, Number(draft.readingTime ?? 1)),
      authorName: parsedArticle.authorName || draft.authorName,
      allowedMediaHosts:
        Array.isArray(parsedArticle.allowedMediaHosts) && parsedArticle.allowedMediaHosts.length > 0
          ? parsedArticle.allowedMediaHosts
          : draft.allowedMediaHosts
    };
  } catch {
    return draft;
  }
}

async function findExistingAlliedArticle(sourceId, originalGuid, originalUrl) {
  const dedupeConditions = [];

  if (originalGuid) {
    dedupeConditions.push({ "syndication.originalGuid": originalGuid });
  }

  if (originalUrl) {
    dedupeConditions.push({ "syndication.originalUrl": originalUrl });
  }

  if (dedupeConditions.length === 0) {
    return null;
  }

  return Article.findOne({
    deletedAt: null,
    "syndication.sourceType": "allied_rss",
    "syndication.feedSource": sourceId,
    $or: dedupeConditions
  }).select("_id title excerpt body contentBlocks cover tags readingTime publishedAt status moderationHistory seo syndication");
}

async function syncAlliedFeedSource(source, actorUser) {
  const xml = await fetchRemoteFeedXml(source.feedUrl);
  const drafts = parseAlliedFeedDocument(xml, source).slice(0, source.maxItemsPerSync);
  const importedArticles = [];
  const updatedArticles = [];
  let skippedCount = 0;
  const syncedAt = new Date();

  for (const draft of drafts) {
    const existing = await findExistingAlliedArticle(source._id, draft.originalGuid, draft.originalUrl);
    const preparedDraft = await hydrateAlliedDraftFromArticlePage(draft, source);

    if (existing) {
      const nextBody = preparedDraft.body.length > 0 ? preparedDraft.body : sanitizeParagraphs(preparedDraft.excerpt);
      const nextPublishedAt =
        existing.status === "published" ? (existing.publishedAt ?? preparedDraft.publishedAt ?? syncedAt) : existing.publishedAt;

      existing.title = preparedDraft.title;
      existing.excerpt = preparedDraft.excerpt;
      existing.body = nextBody;
      existing.contentBlocks = preparedDraft.contentBlocks;
      existing.cover = preparedDraft.cover;
      existing.tags = preparedDraft.tags;
      existing.readingTime = Math.max(1, Number(preparedDraft.readingTime ?? existing.readingTime ?? 1));
      existing.publishedAt = nextPublishedAt;
      existing.syndication = {
        ...existing.syndication,
        sourceType: "allied_rss",
        feedSource: source._id,
        sourceName: source.name,
        sourceUrl: source.feedUrl,
        originalUrl: preparedDraft.originalUrl,
        originalGuid: preparedDraft.originalGuid,
        authorName: preparedDraft.authorName,
        attributionLabel: source.attributionLabel || source.name,
        allowExternalMedia: true,
        allowedMediaHosts: preparedDraft.allowedMediaHosts,
        importedAt: syncedAt
      };
      existing.seo = {
        ...(existing.seo ?? {}),
        title: preparedDraft.title,
        description: sanitizeText(preparedDraft.excerpt, 160)
      };
      existing.moderationHistory = [
        ...(Array.isArray(existing.moderationHistory) ? existing.moderationHistory : []),
        {
          actor: actorUser._id,
          role: actorUser.role,
          action: "updated",
          note: `Sincronizado de nuevo desde el medio aliado ${source.name}.`
        }
      ];

      await existing.save();
      updatedArticles.push(existing);
      continue;
    }

    const status = mapFeedImportModeToStatus(source.importMode);
    const article = await Article.create({
      title: preparedDraft.title,
      slug: await buildUniqueSlug(preparedDraft.title),
      subtitle: "",
      excerpt: preparedDraft.excerpt,
      body: preparedDraft.body.length > 0 ? preparedDraft.body : sanitizeParagraphs(preparedDraft.excerpt),
      contentBlocks: preparedDraft.contentBlocks,
      cover: preparedDraft.cover,
      category: source.defaultCategory ?? null,
      author: actorUser._id,
      tags: preparedDraft.tags,
      featured: false,
      isPremium: false,
      status,
      readingTime: Math.max(1, Number(preparedDraft.readingTime ?? 1)),
      publishedAt: status === "published" ? (preparedDraft.publishedAt ?? syncedAt) : null,
      moderationHistory: [
        {
          actor: actorUser._id,
          role: actorUser.role,
          action: "created",
          note: `Importado desde el medio aliado ${source.name}.`
        }
      ],
      syndication: {
        sourceType: "allied_rss",
        feedSource: source._id,
        sourceName: source.name,
        sourceUrl: source.feedUrl,
        originalUrl: preparedDraft.originalUrl,
        originalGuid: preparedDraft.originalGuid,
        authorName: preparedDraft.authorName,
        attributionLabel: source.attributionLabel || source.name,
        allowExternalMedia: true,
        allowedMediaHosts: preparedDraft.allowedMediaHosts,
        importedAt: syncedAt
      },
      seo: {
        title: preparedDraft.title,
        description: sanitizeText(preparedDraft.excerpt, 160)
      }
    });

    importedArticles.push(article);
  }

  source.lastFetchedAt = syncedAt;
  source.lastImportedAt = importedArticles.length > 0 || updatedArticles.length > 0 ? syncedAt : source.lastImportedAt;
  source.lastImportCount = importedArticles.length;
  source.lastSkippedCount = skippedCount;
  source.lastError = "";
  await source.save();

  return {
    syncedAt,
    importedCount: importedArticles.length,
    updatedCount: updatedArticles.length,
    skippedCount,
    items: [...importedArticles, ...updatedArticles].map((article) => ({
      id: article._id.toString(),
      title: article.title,
      slug: article.slug,
      status: article.status
    }))
  };
}

async function sendPublishedArticleBulletinSafely(article) {
  try {
    await dispatchPublishedArticleBulletin(article);
  } catch (error) {
    console.error("No fue posible despachar el boletín de nueva publicación.");
    console.error(error);
  }
}

export async function getDashboardOverview(req, res, next) {
  try {
    const baseArticleFilter = req.user.role === "admin" ? {} : { author: req.user._id };
    const articleFilter = visibleArticleFilter(baseArticleFilter);
    const activeOverviewFilter = visibleArticleFilter({ ...baseArticleFilter, status: { $ne: "archived" } });
    const editorialUserFilter = {
      role: {
        $in: ["admin", "journalist"]
      }
    };

    const [articleCount, reviewCount, publishedCount, usersCount, subscriptionsCount, recentArticles, topViewedArticles] = await Promise.all([
      Article.countDocuments(articleFilter),
      Article.countDocuments({ ...articleFilter, status: "review" }),
      Article.countDocuments({ ...articleFilter, status: "published" }),
      req.user.role === "admin" ? User.countDocuments(editorialUserFilter) : Promise.resolve(null),
      req.user.role === "admin" ? Subscription.countDocuments({ status: "active" }) : Promise.resolve(null),
      Article.find(activeOverviewFilter)
        .populate([
          { path: "author", select: "name email role" },
          { path: "category", select: "name slug" }
        ])
        .sort({ updatedAt: -1 })
        .limit(6),
      Article.find(activeOverviewFilter)
        .populate([
          { path: "author", select: "name email role" },
          { path: "category", select: "name slug" }
        ])
        .sort({ "metrics.views": -1, publishedAt: -1, updatedAt: -1 })
        .limit(5)
    ]);

    res.json({
      metrics: {
        articleCount,
        reviewCount,
        publishedCount,
        usersCount,
        subscriptionsCount
      },
      recentArticles: recentArticles.map(serializeArticle),
      topViewedArticles: topViewedArticles.map(serializeArticle)
    });
  } catch (error) {
    next(error);
  }
}

export async function getDashboardCommunication(_req, res, next) {
  try {
    const communication = await getActiveSiteCommunication();
    res.json({
      communication
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDashboardCommunication(req, res, next) {
  try {
    const communication = normalizeCommunicationPayload(req.body);
    const siteSetting = await saveSiteCommunication(communication);

    await writeAuditLog(req, {
      actor: req.user,
      action: "site.communication.updated",
      targetType: "site",
      targetId: siteSetting._id.toString(),
      details: {
        title: communication.title,
        expiresAt: communication.expiresAt.toISOString(),
        durationHours: communication.durationHours
      }
    });

    res.json({
      communication: serializeSiteCommunication(siteSetting.communication)
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDashboardCommunication(req, res, next) {
  try {
    const siteSetting = await clearSiteCommunication();

    await writeAuditLog(req, {
      actor: req.user,
      action: "site.communication.deleted",
      targetType: "site",
      targetId: siteSetting._id.toString(),
      details: {}
    });

    res.json({
      message: "La comunicación editorial fue retirada."
    });
  } catch (error) {
    next(error);
  }
}

export async function listAlliedFeedSources(_req, res, next) {
  try {
    const sources = await AlliedFeedSource.find({})
      .populate({ path: "defaultCategory", select: "name slug" })
      .sort({ updatedAt: -1, createdAt: -1 });

    res.json({
      items: sources.map(serializeAlliedFeedSource)
    });
  } catch (error) {
    next(error);
  }
}

export async function createAlliedFeedSource(req, res, next) {
  try {
    const payload = await normalizeAlliedFeedPayload(req.body);
    const source = await AlliedFeedSource.create(payload);
    const populated = await AlliedFeedSource.findById(source._id).populate({ path: "defaultCategory", select: "name slug" });

    await writeAuditLog(req, {
      actor: req.user,
      action: "allied_feed.created",
      targetType: "allied_feed",
      targetId: source._id.toString(),
      details: {
        name: source.name,
        feedUrl: source.feedUrl,
        importMode: source.importMode
      }
    });

    res.status(201).json({
      source: serializeAlliedFeedSource(populated)
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAlliedFeedSource(req, res, next) {
  try {
    const source = await AlliedFeedSource.findById(req.params.sourceId);

    if (!source) {
      return res.status(404).json({ message: "Fuente aliada no encontrada." });
    }

    const payload = await normalizeAlliedFeedPayload(req.body, source);
    Object.assign(source, payload);
    await source.save();

    const populated = await AlliedFeedSource.findById(source._id).populate({ path: "defaultCategory", select: "name slug" });

    await writeAuditLog(req, {
      actor: req.user,
      action: "allied_feed.updated",
      targetType: "allied_feed",
      targetId: source._id.toString(),
      details: {
        name: source.name,
        feedUrl: source.feedUrl,
        importMode: source.importMode
      }
    });

    res.json({
      source: serializeAlliedFeedSource(populated)
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAlliedFeedSource(req, res, next) {
  try {
    const source = await AlliedFeedSource.findById(req.params.sourceId);

    if (!source) {
      return res.status(404).json({ message: "Fuente aliada no encontrada." });
    }

    await source.deleteOne();

    await writeAuditLog(req, {
      actor: req.user,
      action: "allied_feed.deleted",
      targetType: "allied_feed",
      targetId: source._id.toString(),
      details: {
        name: source.name
      }
    });

    res.json({
      message: "La fuente aliada fue eliminada."
    });
  } catch (error) {
    next(error);
  }
}

export async function syncAlliedFeedSourceNow(req, res, next) {
  try {
    const source = await AlliedFeedSource.findById(req.params.sourceId);

    if (!source) {
      return res.status(404).json({ message: "Fuente aliada no encontrada." });
    }

    if (!source.isActive) {
      return res.status(409).json({ message: "Activa la fuente antes de sincronizarla." });
    }

    const result = await syncAlliedFeedSource(source, req.user);

    await writeAuditLog(req, {
      actor: req.user,
      action: "allied_feed.synced",
      targetType: "allied_feed",
      targetId: source._id.toString(),
      details: {
        name: source.name,
        importedCount: result.importedCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        syncedAt: result.syncedAt.toISOString()
      }
    });

    const syncSummary =
      result.importedCount > 0 && result.updatedCount > 0
        ? `Se importaron ${result.importedCount} artículos y se actualizaron ${result.updatedCount} ya existentes.`
        : result.importedCount > 0
          ? `Se importaron ${result.importedCount} artículos nuevos.`
          : result.updatedCount > 0
            ? `Se actualizaron ${result.updatedCount} artículos ya importados.`
            : "No hubo artículos nuevos ni cambios para sincronizar.";

    res.json({
      message:
        result.skippedCount > 0
          ? `${syncSummary} Se omitieron ${result.skippedCount} duplicados.`
          : syncSummary,
      result
    });
  } catch (error) {
    if (mongoose.isValidObjectId?.(req.params.sourceId)) {
      await AlliedFeedSource.findByIdAndUpdate(req.params.sourceId, {
        $set: {
          lastFetchedAt: new Date(),
          lastError: sanitizeText(error?.message ?? "Error de sincronización.", 240)
        }
      }).catch(() => undefined);
    }

    next(error);
  }
}

export async function listDashboardArticles(req, res, next) {
  try {
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const page = readBoundedPositiveInt(req.query.page, 1);
    const limit = readBoundedPositiveInt(req.query.limit, 12, { max: 30 });

    const filters = visibleArticleFilter(req.user.role === "admin" ? {} : { author: req.user._id });
    if (status) {
      filters.status = status;
    }
    if (search) {
      filters.$text = { $search: search };
    }

    const [items, total] = await Promise.all([
      Article.find(filters)
        .populate([
          { path: "author", select: "name email role" },
          { path: "category", select: "name slug" }
        ])
        .sort(search ? { score: { $meta: "textScore" }, updatedAt: -1 } : { updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Article.countDocuments(filters)
    ]);

    res.json({
      items: items.map(serializeArticle),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getDashboardArticle(req, res, next) {
  try {
    const article = await Article.findOne({
      _id: req.params.articleId,
      deletedAt: null
    }).populate([
      { path: "author", select: "name email role" },
      { path: "category", select: "name slug" }
    ]);

    if (!article) {
      return res.status(404).json({ message: "Artículo no encontrado." });
    }

    if (!canAccessArticle(req.user, article)) {
      return res.status(403).json({ message: "No puedes acceder a este artículo." });
    }

    res.json(serializeArticle(article));
  } catch (error) {
    next(error);
  }
}

export async function createDashboardArticle(req, res, next) {
  try {
    const normalized = applyEditorialRestrictions(req.user, await normalizeArticlePayload(req.body));

    const article = await Article.create({
      ...normalized,
      author: req.user._id,
      moderationHistory: [
        {
          actor: req.user._id,
          role: req.user.role,
          action: "created",
          note: ""
        }
      ]
    });

    await writeAuditLog(req, {
      actor: req.user,
      action: "article.created",
      targetType: "article",
      targetId: article._id.toString(),
      details: {
        title: article.title,
        status: article.status
      }
    });

    if (req.user.role === "admin") {
      if (article.featured) {
        await setFeaturedArticleSelection(article._id);
      } else {
        await clearFeaturedArticleSelection(article._id);
      }
    }

    const populated = await Article.findOne({ _id: article._id, deletedAt: null }).populate([
      { path: "author", select: "name email role" },
      { path: "category", select: "name slug" }
    ]);

    if (article.status === "published") {
      void sendPublishedArticleBulletinSafely(populated);
    }

    res.status(201).json(serializeArticle(populated));
  } catch (error) {
    next(error);
  }
}

export async function updateDashboardArticle(req, res, next) {
  try {
    const article = await Article.findOne({
      _id: req.params.articleId,
      deletedAt: null
    }).populate("author");

    if (!article) {
      return res.status(404).json({ message: "Artículo no encontrado." });
    }

    if (!canAccessArticle(req.user, article)) {
      return res.status(403).json({ message: "No puedes editar este artículo." });
    }

    if (req.user.role !== "admin" && ["published", "archived"].includes(article.status)) {
      return res.status(409).json({ message: "El artículo ya no puede ser editado por el periodista." });
    }

    const wasPublished = article.status === "published";
    const normalized = applyEditorialRestrictions(req.user, await normalizeArticlePayload(req.body, article), article);

    Object.assign(article, normalized);
    article.moderationHistory.push({
      actor: req.user._id,
      role: req.user.role,
      action: "updated",
      note: ""
    });

    await article.save();

    await writeAuditLog(req, {
      actor: req.user,
      action: "article.updated",
      targetType: "article",
      targetId: article._id.toString(),
      details: {
        title: article.title,
        status: article.status
      }
    });

    if (req.user.role === "admin") {
      if (article.featured) {
        await setFeaturedArticleSelection(article._id);
      } else {
        await clearFeaturedArticleSelection(article._id);
      }
    }

    const populated = await Article.findOne({ _id: article._id, deletedAt: null }).populate([
      { path: "author", select: "name email role" },
      { path: "category", select: "name slug" }
    ]);

    if (!wasPublished && article.status === "published") {
      void sendPublishedArticleBulletinSafely(populated);
    }

    res.json(serializeArticle(populated));
  } catch (error) {
    next(error);
  }
}

export async function submitArticleForReview(req, res, next) {
  try {
    const article = await Article.findOne({
      _id: req.params.articleId,
      deletedAt: null
    }).populate("author");

    if (!article) {
      return res.status(404).json({ message: "Artículo no encontrado." });
    }

    if (!canAccessArticle(req.user, article)) {
      return res.status(403).json({ message: "No puedes enviar este artículo." });
    }

    if (article.status === "review") {
      return res.status(409).json({ message: "El artículo ya está en revisión." });
    }

    if (req.user.role !== "admin" && !["draft", "changes_requested", "rejected"].includes(article.status)) {
      return res.status(409).json({
        message: "Solo puedes reenviar borradores, piezas rechazadas o notas con cambios solicitados."
      });
    }

    article.status = "review";
    article.moderationNote = "";
    article.moderationHistory.push({
      actor: req.user._id,
      role: req.user.role,
      action: "submitted",
      note: ""
    });

    await article.save();

    await writeAuditLog(req, {
      actor: req.user,
      action: "article.submitted",
      targetType: "article",
      targetId: article._id.toString(),
      details: {
        title: article.title
      }
    });

    res.json({
      message: "Artículo enviado a revisión."
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDashboardArticle(req, res, next) {
  try {
    const article = await Article.findById(req.params.articleId).populate("author");

    if (!article) {
      return res.status(404).json({ message: "Artículo no encontrado." });
    }

    if (!canAccessArticle(req.user, article)) {
      return res.status(403).json({ message: "No puedes eliminar este artículo." });
    }

    if (req.user.role !== "admin" && !["draft", "changes_requested", "rejected"].includes(article.status)) {
      return res.status(409).json({
        message: "Solo el administrador puede enviar a papelera artículos en revisión, aprobados, publicados o archivados."
      });
    }

    if (article.deletedAt) {
      return res.json({ message: "El artículo ya estaba en la papelera editorial." });
    }

    article.deletedAt = new Date();
    article.deletedBy = req.user._id;
    article.deletionReason = "Enviado a papelera editorial desde el panel.";
    article.featured = false;
    article.moderationHistory.push({
      actor: req.user._id,
      role: req.user.role,
      action: "deleted",
      note: article.deletionReason
    });
    await article.save();

    await clearFeaturedArticleSelection(article._id);

    await writeAuditLog(req, {
      actor: req.user,
      action: "article.deleted",
      targetType: "article",
      targetId: article._id.toString(),
      details: {
        title: article.title,
        status: article.status
      }
    });

    res.json({ message: "Artículo enviado a papelera editorial." });
  } catch (error) {
    next(error);
  }
}

export async function moderateArticle(req, res, next) {
  try {
    const payload = moderationSchema.parse(req.body);
    const article = await Article.findOne({
      _id: req.params.articleId,
      deletedAt: null
    }).populate([
      { path: "author", select: "name email role" },
      { path: "category", select: "name slug" }
    ]);

    if (!article) {
      return res.status(404).json({ message: "Artículo no encontrado." });
    }

    const note = sanitizeText(payload.note, 400);
    const wasPublished = article.status === "published";

    switch (payload.action) {
      case "approve":
        article.status = "approved";
        article.moderationHistory.push({ actor: req.user._id, role: req.user.role, action: "approved", note });
        break;
      case "request_changes":
        article.status = "changes_requested";
        article.moderationHistory.push({ actor: req.user._id, role: req.user.role, action: "changes_requested", note });
        break;
      case "publish":
        article.status = "published";
        article.publishedAt = article.publishedAt ?? new Date();
        article.moderationHistory.push({ actor: req.user._id, role: req.user.role, action: "published", note });
        break;
      case "archive":
        article.status = "archived";
        article.moderationHistory.push({ actor: req.user._id, role: req.user.role, action: "archived", note });
        break;
      case "reject":
        article.status = "rejected";
        article.moderationHistory.push({ actor: req.user._id, role: req.user.role, action: "rejected", note });
        break;
      case "feature":
        if (article.status !== "published") {
          return res.status(409).json({
            message: "Solo los artículos publicados pueden destacarse en portada."
          });
        }
        article.featured = true;
        await setFeaturedArticleSelection(article._id);
        article.moderationHistory.push({ actor: req.user._id, role: req.user.role, action: "featured", note });
        break;
      case "unfeature":
        article.featured = false;
        await clearFeaturedArticleSelection(article._id);
        article.moderationHistory.push({ actor: req.user._id, role: req.user.role, action: "unfeatured", note });
        break;
      default:
        break;
    }

    if (article.status !== "published" && article.featured) {
      article.featured = false;
      await clearFeaturedArticleSelection(article._id);
    }

    article.moderationNote = note;
    article.moderatedAt = new Date();
    await article.save();

    await writeAuditLog(req, {
      actor: req.user,
      action: `article.${payload.action}`,
      targetType: "article",
      targetId: article._id.toString(),
      details: {
        title: article.title,
        note
      }
    });

    if (!wasPublished && article.status === "published") {
      void sendPublishedArticleBulletinSafely(article);
    }

    res.json(serializeArticle(article));
  } catch (error) {
    next(error);
  }
}

export async function listDashboardArticleComments(req, res, next) {
  try {
    const article = await Article.findOne({
      _id: req.params.articleId,
      deletedAt: null
    }).select("_id title");

    if (!article) {
      return res.status(404).json({ message: "Artículo no encontrado." });
    }

    const [items, grouped] = await Promise.all([
      ArticleComment.find({ article: article._id })
        .populate({ path: "moderatedBy", select: "name email role" })
        .sort({ status: 1, featured: -1, createdAt: -1, _id: -1 })
        .limit(120),
      ArticleComment.aggregate([
        {
          $match: {
            article: article._id
          }
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            featured: {
              $sum: {
                $cond: ["$featured", 1, 0]
              }
            }
          }
        }
      ])
    ]);

    const summary = {
      total: 0,
      pending: 0,
      approved: 0,
      hidden: 0,
      rejected: 0,
      featured: 0
    };

    for (const entry of grouped) {
      const statusKey = String(entry?._id ?? "");
      const count = Number(entry?.count ?? 0);
      const featuredCount = Number(entry?.featured ?? 0);

      summary.total += count;
      summary.featured += featuredCount;

      if (statusKey === "pending" || statusKey === "approved" || statusKey === "hidden" || statusKey === "rejected") {
        summary[statusKey] = count;
      }
    }

    res.json({
      items: items.map((comment) => serializeArticleComment(comment)),
      summary
    });
  } catch (error) {
    next(error);
  }
}

export async function moderateDashboardArticleComment(req, res, next) {
  try {
    const payload = commentModerationSchema.parse(req.body);
    const article = await Article.findOne({
      _id: req.params.articleId,
      deletedAt: null
    }).select("_id title");

    if (!article) {
      return res.status(404).json({ message: "Artículo no encontrado." });
    }

    const comment = await ArticleComment.findOne({
      _id: req.params.commentId,
      article: article._id
    });

    if (!comment) {
      return res.status(404).json({ message: "Comentario no encontrado." });
    }

    const note = sanitizeText(payload.note, 240);

    switch (payload.action) {
      case "approve":
        comment.status = "approved";
        break;
      case "hide":
        comment.status = "hidden";
        comment.featured = false;
        break;
      case "feature":
        comment.status = "approved";
        comment.featured = true;
        break;
      case "unfeature":
        comment.featured = false;
        if (comment.status === "pending") {
          comment.status = "approved";
        }
        break;
      case "reject":
        comment.status = "rejected";
        comment.featured = false;
        break;
      default:
        break;
    }

    comment.moderationNote = note;
    comment.moderatedAt = new Date();
    comment.moderatedBy = req.user._id;
    await comment.save();

    const hydratedComment = await ArticleComment.findById(comment._id).populate({
      path: "moderatedBy",
      select: "name email role"
    });

    await writeAuditLog(req, {
      actor: req.user,
      action: `comment.${payload.action}`,
      targetType: "article-comment",
      targetId: comment._id.toString(),
      details: {
        articleId: article._id.toString(),
        articleTitle: article.title,
        authorName: comment.authorName,
        note
      }
    });

    res.json({
      comment: hydratedComment ? serializeArticleComment(hydratedComment) : null
    });
  } catch (error) {
    next(error);
  }
}

export async function listDashboardCategories(req, res, next) {
  try {
    const filters = req.user.role === "admin" ? {} : { isActive: true };
    const items = await Category.find(filters).sort({ name: 1 });
    res.json(items.map(serializeCategory));
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req, res, next) {
  try {
    const payload = categoryInputSchema.parse(req.body);
    const category = await Category.create({
      name: sanitizeText(payload.name, 80),
      slug: slugify(payload.name),
      description: sanitizeText(payload.description ?? "", 200),
      isActive: payload.isActive
    });

    await writeAuditLog(req, {
      actor: req.user,
      action: "category.created",
      targetType: "category",
      targetId: category._id.toString(),
      details: {
        name: category.name
      }
    });

    res.status(201).json(serializeCategory(category));
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const payload = categoryInputSchema.parse(req.body);
    const category = await Category.findById(req.params.categoryId);

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada." });
    }

    category.name = sanitizeText(payload.name, 80);
    category.slug = slugify(payload.name);
    category.description = sanitizeText(payload.description ?? "", 200);
    category.isActive = payload.isActive;

    await category.save();

    await writeAuditLog(req, {
      actor: req.user,
      action: "category.updated",
      targetType: "category",
      targetId: category._id.toString(),
      details: {
        name: category.name
      }
    });

    res.json(serializeCategory(category));
  } catch (error) {
    next(error);
  }
}

export async function listUsers(req, res, next) {
  try {
    const search = sanitizeText(String(req.query.search ?? ""), 120);
    const page = readBoundedPositiveInt(req.query.page, 1);
    const limit = readBoundedPositiveInt(req.query.limit, 12, { max: 50 });
    const filters = {
      role: {
        $in: ["admin", "journalist"]
      }
    };

    if (search) {
      const pattern = new RegExp(escapeRegexLiteral(search), "i");
      filters.$or = [{ name: pattern }, { email: pattern }];
    }

    const [items, total] = await Promise.all([
      User.find(filters)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filters)
    ]);

    res.json({
      items: items.map(serializeUser),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const payload = userCreateSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(payload.password, 12);

    const user = await User.create({
      name: sanitizeText(payload.name, 80),
      email: payload.email,
      passwordHash,
      role: payload.role,
      status: payload.status
    });

    await writeAuditLog(req, {
      actor: req.user,
      action: "user.created",
      targetType: "user",
      targetId: user._id.toString(),
      details: {
        email: user.email,
        role: user.role
      }
    });

    res.status(201).json(serializeUser(user));
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const payload = userUpdateSchema.parse(req.body);
    const user = await User.findById(req.params.userId).select("+passwordHash");

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    const nextRole = payload.role ?? user.role;
    const nextStatus = payload.status ?? user.status;

    if (user.role === "admin" && (nextRole !== "admin" || nextStatus !== "active")) {
      const otherActiveAdmins = await User.countDocuments({
        _id: { $ne: user._id },
        role: "admin",
        status: "active"
      });

      if (otherActiveAdmins === 0) {
        return res.status(409).json({
          message: "Debe existir al menos un admin activo."
        });
      }
    }

    if (payload.name) {
      user.name = sanitizeText(payload.name, 80);
    }
    if (payload.role) {
      user.role = payload.role;
    }
    if (payload.status) {
      user.status = payload.status;
    }
    if (payload.password) {
      user.passwordHash = await bcrypt.hash(payload.password, 12);
      user.sessionVersion = Number(user.sessionVersion ?? 0) + 1;
    }

    await user.save();

    if (payload.password && user._id.toString() === req.user._id.toString()) {
      const refreshedToken = signAuthToken(user);
      res.cookie(req.app.locals.cookieName, refreshedToken, buildCookieOptions());
    }

    await writeAuditLog(req, {
      actor: req.user,
      action: "user.updated",
      targetType: "user",
      targetId: user._id.toString(),
      details: {
        email: user.email,
        role: user.role,
        status: user.status
      }
    });

    res.json(serializeUser(user));
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(409).json({ message: "No puedes eliminar tu propia cuenta desde este panel." });
    }

    if (user.role === "admin") {
      const otherActiveAdmins = await User.countDocuments({
        _id: { $ne: user._id },
        role: "admin",
        status: "active"
      });

      if (otherActiveAdmins === 0) {
        return res.status(409).json({ message: "Debe existir al menos un admin activo." });
      }
    }

    const linkedArticles = await Article.countDocuments({
      author: user._id,
      deletedAt: null
    });

    if (linkedArticles > 0) {
      return res.status(409).json({
        message: "No puedes eliminar este usuario mientras tenga artículos asociados. Reasígnalos o bloquea la cuenta."
      });
    }

    await User.deleteOne({ _id: user._id });

    await writeAuditLog(req, {
      actor: req.user,
      action: "user.deleted",
      targetType: "user",
      targetId: user._id.toString(),
      details: {
        email: user.email,
        role: user.role,
        status: user.status
      }
    });

    res.json({ message: "Usuario eliminado." });
  } catch (error) {
    next(error);
  }
}

export async function updateOwnProfile(req, res, next) {
  try {
    const payload = profileUpdateSchema.parse(req.body);
    const nextName = sanitizeText(payload.name, 80);
    const currentName = sanitizeText(req.user.name ?? "", 80);

    if (req.user.role === "reader" && nextName !== currentName) {
      const lastNameChangeTime = req.user.nameChangedAt ? new Date(req.user.nameChangedAt).getTime() : 0;
      const nameChangeAvailableAt = lastNameChangeTime ? lastNameChangeTime + readerNameChangeWindowMs : 0;

      if (nameChangeAvailableAt && nameChangeAvailableAt > Date.now()) {
        return res.status(409).json({
          message: `Solo puedes cambiar tu nombre una vez cada 7 días. Vuelve a intentarlo después del ${new Date(nameChangeAvailableAt).toLocaleString("es-CO", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "America/Bogota"
          })}.`,
          nameChangeAvailableAt: new Date(nameChangeAvailableAt).toISOString()
        });
      }

      req.user.nameChangedAt = new Date();
    }

    req.user.name = nextName;
    req.user.avatar = {
      url: sanitizeOwnedMediaUrl(payload.avatarUrl ?? ""),
      alt: sanitizeText(payload.avatarAlt ?? "", 140)
    };
    await req.user.save();

    await writeAuditLog(req, {
      actor: req.user,
      action: "profile.updated",
      targetType: "user",
      targetId: req.user._id.toString()
    });

    res.json({
      user: serializeUser(req.user)
    });
  } catch (error) {
    next(error);
  }
}

export async function changeOwnPassword(req, res, next) {
  try {
    const payload = passwordChangeSchema.parse(req.body);
    const user = await User.findById(req.user._id).select("+passwordHash");

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado."
      });
    }

    const passwordMatches = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({
        message: "La contraseña actual no es correcta."
      });
    }

    const samePassword = await bcrypt.compare(payload.nextPassword, user.passwordHash);
    if (samePassword) {
      return res.status(409).json({
        message: "La nueva contraseña debe ser diferente a la actual."
      });
    }

    user.passwordHash = await bcrypt.hash(payload.nextPassword, 12);
    user.sessionVersion = Number(user.sessionVersion ?? 0) + 1;
    await user.save();

    const refreshedToken = signAuthToken(user);
    res.cookie(req.app.locals.cookieName, refreshedToken, buildCookieOptions());

    await writeAuditLog(req, {
      actor: req.user,
      action: "profile.password_changed",
      targetType: "user",
      targetId: req.user._id.toString()
    });

    res.json({
      message: "Contraseña actualizada."
    });
  } catch (error) {
    next(error);
  }
}

export async function listAuditLogs(req, res, next) {
  try {
    const limit = readBoundedPositiveInt(req.query.limit, 30, { max: 100 });
    const items = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit);

    res.json(
      items.map((item) => ({
        id: item._id.toString(),
        action: item.action,
        targetType: item.targetType,
        targetId: item.targetId,
        actorEmail: item.actorEmail,
        ip: item.ip,
        details: item.details,
        createdAt: item.createdAt
      }))
    );
  } catch (error) {
    next(error);
  }
}

export async function listSubscriptions(_req, res, next) {
  try {
    const search = sanitizeText(String(_req.query.search ?? ""), 120);
    const page = readBoundedPositiveInt(_req.query.page, 1);
    const limit = readBoundedPositiveInt(_req.query.limit, 12, { max: 50 });
    const filters = {};

    if (search) {
      const pattern = new RegExp(escapeRegexLiteral(search), "i");
      filters.$or = [{ name: pattern }, { email: pattern }, { interests: pattern }];
    }

    const [items, total] = await Promise.all([
      Subscription.find(filters)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Subscription.countDocuments(filters)
    ]);

    res.json({
      items: items.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        email: item.email,
        plan: item.plan,
        status: item.status,
        interests: item.interests,
        createdAt: item.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSubscription(req, res, next) {
  try {
    const payload = subscriptionUpdateSchema.parse(req.body);
    const subscription = await Subscription.findById(req.params.subscriptionId);

    if (!subscription) {
      return res.status(404).json({ message: "Suscripción no encontrada." });
    }

    subscription.status = payload.status;

    if (payload.status === "active" && !subscription.confirmedAt) {
      subscription.confirmedAt = new Date();
    }

    if (payload.status === "active" || payload.status === "paused" || payload.status === "cancelled") {
      subscription.confirmationTokenHash = "";
      subscription.confirmationTokenExpiresAt = null;
    }

    await subscription.save();

    await writeAuditLog(req, {
      actor: req.user,
      action: "subscription.updated",
      targetType: "subscription",
      targetId: subscription._id.toString(),
      details: {
        email: subscription.email,
        status: subscription.status,
        plan: subscription.plan
      }
    });

    res.json({
      id: subscription._id.toString(),
      name: subscription.name,
      email: subscription.email,
      plan: subscription.plan,
      status: subscription.status,
      interests: subscription.interests,
      createdAt: subscription.createdAt
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteSubscription(req, res, next) {
  try {
    const subscription = await Subscription.findById(req.params.subscriptionId);

    if (!subscription) {
      return res.status(404).json({ message: "Suscripción no encontrada." });
    }

    await Subscription.deleteOne({ _id: subscription._id });

    await writeAuditLog(req, {
      actor: req.user,
      action: "subscription.deleted",
      targetType: "subscription",
      targetId: subscription._id.toString(),
      details: {
        email: subscription.email,
        status: subscription.status,
        plan: subscription.plan
      }
    });

    res.json({ message: "Suscripción eliminada." });
  } catch (error) {
    next(error);
  }
}
