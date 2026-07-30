import crypto from "node:crypto";
import { isValidObjectId } from "mongoose";

import { Article } from "../models/Article.js";
import { ArticleView } from "../models/ArticleView.js";
import { Category } from "../models/Category.js";
import { writeAuditLog } from "../lib/audit.js";
import { env } from "../config/env.js";
import { getActiveSiteCommunication, getMainSiteSetting } from "../lib/site-settings.js";
import {
  sendNewsletterArticlePublishedEmail,
  sendNewsletterConfirmationEmail,
  sendNewsletterGoodbyeEmail,
  sendNewsletterWelcomeEmail
} from "../lib/newsletter-mailer.js";
import { createExpiringToken, createOpaqueToken, hashOpaqueToken } from "../lib/newsletter-tokens.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { paragraphBlocksFromBody, sanitizeContentBlocks, sanitizeEditorialMediaUrl, sanitizeOwnedMediaUrl, sanitizeTags, sanitizeText } from "../utils/content.js";
import { buildAllowedFeedHosts } from "../lib/allied-feeds.js";
import { readBoundedPositiveInt } from "../utils/request.js";
import { subscriptionInputSchema, subscriptionTokenSchema } from "../validators/subscription.validator.js";

const recentArticleViewsCookieName = "cp_recent_views";
const publicConsentCookieName = "cp_cookie_preferences";
const recentArticleViewWindowMs = 1000 * 60 * 45;
const recentArticleViewLimit = 24;
const publicArchiveTagLimit = 12;
const publicSubscriptionAcceptedMessage = "Si el correo es válido, revisa tu bandeja para continuar con el boletín.";
const publicSubscriptionProcessedMessage = "Si el correo es válido, la suscripción fue procesada correctamente.";
const searchablePublicArticleFields = [
  "title",
  "subtitle",
  "excerpt",
  "body",
  "tags",
  "seo.title",
  "seo.description",
  "contentBlocks.text",
  "contentBlocks.heading.text",
  "contentBlocks.quote.text",
  "contentBlocks.quote.attribution",
  "contentBlocks.embed.title"
];
const accentAwareCharacters = {
  a: "aáàäâã",
  e: "eéèëê",
  i: "iíìïî",
  o: "oóòöôõ",
  u: "uúùüû",
  n: "nñ",
  c: "cç",
  y: "yýÿ"
};

function clampCoverPosition(value, fallback = 50) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(numericValue * 10) / 10));
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

  return {
    sourceType,
    sourceName: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.sourceName ?? "", 80) : "",
    sourceUrl: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.sourceUrl ?? "", 500) : "",
    originalUrl: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.originalUrl ?? "", 500) : "",
    authorName: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.authorName ?? "", 120) : "",
    attributionLabel: sourceType === "allied_rss" ? sanitizeText(article?.syndication?.attributionLabel ?? "", 80) : ""
  };
}

function articlePopulate() {
  return [
    {
      path: "author",
      select: "name role"
    },
    {
      path: "category",
      select: "name slug"
    }
  ];
}

function publishedVisibleArticleFilter(filters = {}) {
  return {
    status: "published",
    deletedAt: null,
    ...filters
  };
}

function escapeRegexLiteral(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeRegexCharacterClass(value) {
  return String(value ?? "").replace(/[-\\\]^]/g, "\\$&");
}

function buildAccentAwarePattern(value) {
  return Array.from(String(value ?? "")).map((character) => {
    if (/\s/.test(character)) {
      return "\\s+";
    }

    const normalized = character.toLowerCase();
    const variants = accentAwareCharacters[normalized];

    if (variants) {
      const characterSet = Array.from(new Set(`${variants}${variants.toUpperCase()}`)).join("");
      return `[${escapeRegexCharacterClass(characterSet)}]`;
    }

    return escapeRegexLiteral(character);
  }).join("");
}

function buildPublicSearchRegex(value) {
  return new RegExp(buildAccentAwarePattern(value), "iu");
}

function buildPublicSearchFilters(search) {
  const normalizedSearch = sanitizeText(search, 160);
  const rawTokens = normalizedSearch.split(/\s+/).filter(Boolean);
  const preferredTokens = rawTokens.filter((token) => token.length >= 2);
  const searchTokens = Array.from(new Set((preferredTokens.length > 0 ? preferredTokens : rawTokens).map((token) => token.slice(0, 60))));

  if (searchTokens.length === 0) {
    return [];
  }

  return searchTokens.map((token) => {
    const regex = buildPublicSearchRegex(token);

    return {
      $or: searchablePublicArticleFields.map((field) => ({
        [field]: regex
      }))
    };
  });
}

function humanizeArchiveLabel(value) {
  return String(value ?? "")
    .split(/[-\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readPublicArticleSort(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "oldest") {
    return {
      key: "oldest",
      sort: { publishedAt: 1, _id: 1 }
    };
  }

  if (normalized === "popular") {
    return {
      key: "popular",
      sort: { "metrics.views": -1, "metrics.shares": -1, "metrics.reactions": -1, publishedAt: -1, _id: -1 }
    };
  }

  return {
    key: "latest",
    sort: { publishedAt: -1, _id: -1 }
  };
}

function articleViewCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: env.isProduction,
    path: "/api/public/articles",
    maxAge: recentArticleViewWindowMs
  };
}

function parseRecentArticleViews(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Number(value)])
        .filter(([key, value]) => Boolean(key) && Number.isFinite(value))
    );
  } catch {
    return {};
  }
}

function parsePublicConsentPreferences(rawValue) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue));

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return {
      essential: parsed.essential === true,
      preferences: parsed.preferences === true,
      measurement: parsed.measurement === true,
      version: Number(parsed.version ?? 0)
    };
  } catch {
    return null;
  }
}

function hasMeasurementConsent(req) {
  const preferences = parsePublicConsentPreferences(req.cookies?.[publicConsentCookieName]);
  return preferences?.essential === true && preferences?.version === 1 && preferences?.measurement === true;
}

function pruneRecentArticleViews(entries, now = Date.now()) {
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([, expiresAt]) => Number(expiresAt) > now)
      .sort((left, right) => Number(right[1]) - Number(left[1]))
      .slice(0, recentArticleViewLimit)
  );
}

function readRequestHeader(req, headerName) {
  if (typeof req.get === "function") {
    return req.get(headerName) ?? "";
  }

  const directHeader = req.headers?.[headerName];
  if (Array.isArray(directHeader)) {
    return directHeader.join(", ");
  }

  return String(directHeader ?? "");
}

function buildArticleViewFingerprint(req) {
  const rawFingerprint = [
    String(req.ip ?? ""),
    readRequestHeader(req, "user-agent"),
    readRequestHeader(req, "accept-language"),
    readRequestHeader(req, "sec-ch-ua"),
    readRequestHeader(req, "sec-ch-ua-platform"),
    readRequestHeader(req, "sec-ch-ua-mobile")
  ]
    .map((item) => sanitizeText(item, 240))
    .filter(Boolean)
    .join("|");

  if (!rawFingerprint) {
    return "";
  }

  return crypto.createHash("sha256").update(rawFingerprint).digest("hex");
}

function resolveArticleViewWindow(now = Date.now()) {
  const windowStartsAtMs = now - (now % recentArticleViewWindowMs);

  return {
    windowStartsAt: new Date(windowStartsAtMs),
    expiresAt: new Date(windowStartsAtMs + recentArticleViewWindowMs)
  };
}

async function registerArticleView(req, articleId, now = Date.now()) {
  const fingerprint = buildArticleViewFingerprint(req);

  if (!fingerprint) {
    return false;
  }

  const { windowStartsAt, expiresAt } = resolveArticleViewWindow(now);

  try {
    await ArticleView.create({
      article: articleId,
      fingerprint,
      windowStartsAt,
      expiresAt
    });

    return true;
  } catch (error) {
    if (error?.code === 11000) {
      return false;
    }

    console.error("No fue posible registrar la vista única del artículo.");
    console.error(error);
    return false;
  }
}

async function shouldCountArticleView(req, res, articleId) {
  if (!hasMeasurementConsent(req)) {
    return false;
  }

  const now = Date.now();
  const articleKey = articleId.toString();
  const recentViews = pruneRecentArticleViews(parseRecentArticleViews(req.cookies?.[recentArticleViewsCookieName]), now);
  const alreadyCounted = Number(recentViews[articleKey] ?? 0) > now;

  recentViews[articleKey] = now + recentArticleViewWindowMs;
  res.cookie(
    recentArticleViewsCookieName,
    JSON.stringify(pruneRecentArticleViews(recentViews, now)),
    articleViewCookieOptions()
  );

  if (alreadyCounted) {
    return false;
  }

  return registerArticleView(req, articleId, now);
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
    isPremium: article.isPremium,
    featured: article.featured,
    readingTime: article.readingTime,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    syndication: serializeSyndication(article)
  };
}

function serializeArticlePreview(article) {
  const serialized = serializeArticle(article);

  return {
    id: serialized.id,
    slug: serialized.slug,
    title: serialized.title,
    subtitle: serialized.subtitle,
    excerpt: serialized.excerpt,
    cover: serialized.cover,
    author: serialized.author,
    category: serialized.category,
    tags: serialized.tags,
    metrics: serialized.metrics,
    featured: serialized.featured,
    readingTime: serialized.readingTime,
    publishedAt: serialized.publishedAt,
    updatedAt: serialized.updatedAt
  };
}

function serializeAuthorProfile(author, { articleCount = 0, latestPublishedAt = null } = {}) {
  return {
    id: author._id.toString(),
    name: author.name,
    role: author.role,
    articleCount,
    latestPublishedAt
  };
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatSeoDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

function buildPublicArticleUrl(slug) {
  return new URL(`/articulo/${slug}`, `${env.publicSiteUrl}/`).toString();
}

function buildPublicAuthorUrl(authorId) {
  return new URL(`/autor/${authorId}`, `${env.publicSiteUrl}/`).toString();
}

function serializeSubscriptionMessage(message) {
  return {
    message
  };
}

function cloneOptionalDate(value) {
  if (!value) {
    return null;
  }

  const cloned = new Date(value);
  return Number.isNaN(cloned.getTime()) ? null : cloned;
}

function snapshotSubscriptionState(subscription) {
  return {
    name: subscription.name ?? "",
    email: subscription.email ?? "",
    plan: subscription.plan ?? "newsletter",
    interests: Array.isArray(subscription.interests) ? [...subscription.interests] : [],
    source: subscription.source ?? "site",
    status: subscription.status ?? "pending",
    confirmationTokenHash: subscription.confirmationTokenHash ?? "",
    confirmationTokenExpiresAt: cloneOptionalDate(subscription.confirmationTokenExpiresAt),
    unsubscribeTokenHash: subscription.unsubscribeTokenHash ?? "",
    confirmedAt: cloneOptionalDate(subscription.confirmedAt),
    welcomeSentAt: cloneOptionalDate(subscription.welcomeSentAt)
  };
}

function restoreSubscriptionState(subscription, snapshot) {
  subscription.name = snapshot.name;
  subscription.email = snapshot.email;
  subscription.plan = snapshot.plan;
  subscription.interests = [...snapshot.interests];
  subscription.source = snapshot.source;
  subscription.status = snapshot.status;
  subscription.confirmationTokenHash = snapshot.confirmationTokenHash;
  subscription.confirmationTokenExpiresAt = snapshot.confirmationTokenExpiresAt;
  subscription.unsubscribeTokenHash = snapshot.unsubscribeTokenHash;
  subscription.confirmedAt = snapshot.confirmedAt;
  subscription.welcomeSentAt = snapshot.welcomeSentAt;
}

function applyPublicSubscriptionDetails(subscription, payload, interests) {
  subscription.name = sanitizeText(payload.name, 80);
  subscription.plan = payload.plan;
  subscription.interests = interests;
  subscription.source = "site";
}

async function rollbackSubscriptionMutation(subscription, previousState, wasExisting) {
  try {
    if (wasExisting) {
      restoreSubscriptionState(subscription, previousState);
      await subscription.save();
      return;
    }

    if (subscription._id) {
      await Subscription.deleteOne({ _id: subscription._id });
    }
  } catch (rollbackError) {
    console.error("No fue posible revertir la suscripción tras un fallo de correo.");
    console.error(rollbackError);
  }
}

async function persistThenSendSubscriptionMail({ subscription, wasExisting, mutate, deliver }) {
  const previousState = wasExisting ? snapshotSubscriptionState(subscription) : null;

  mutate();
  await subscription.save();

  try {
    await deliver();
  } catch (error) {
    await rollbackSubscriptionMutation(subscription, previousState, wasExisting);
    throw error;
  }
}

function rotateUnsubscribeToken(subscription) {
  const unsubscribeToken = createOpaqueToken();
  subscription.unsubscribeTokenHash = hashOpaqueToken(unsubscribeToken);
  return unsubscribeToken;
}

async function logSubscriptionEvent(req, subscription, action, details = {}) {
  await writeAuditLog(req, {
    action,
    actorEmail: subscription.email,
    targetType: "subscription",
    targetId: subscription._id.toString(),
    details
  });
}

async function sendConfirmationOrThrow(subscription, tokens) {
  try {
    await sendNewsletterConfirmationEmail(subscription, tokens);
  } catch (error) {
    console.error("No fue posible enviar el correo de confirmación del boletín.");
    console.error(error);
    const reason = sanitizeText(error?.message ?? "", 220);
    throw createHttpError(
      502,
      reason
        ? `No fue posible enviar el correo de confirmación. ${reason}`
        : "No fue posible enviar el correo de confirmación. Intenta de nuevo en unos minutos."
    );
  }
}

async function sendWelcomeOrThrow(subscription, tokens) {
  try {
    await sendNewsletterWelcomeEmail(subscription, tokens);
  } catch (error) {
    console.error("No fue posible enviar el correo de bienvenida del boletín.");
    console.error(error);
    const reason = sanitizeText(error?.message ?? "", 220);
    throw createHttpError(
      502,
      reason
        ? `No fue posible enviar el correo de bienvenida. ${reason}`
        : "No fue posible enviar el correo de bienvenida. Intenta de nuevo en unos minutos."
    );
  }
}

async function sendGoodbyeBestEffort(subscription, tokens) {
  try {
    await sendNewsletterGoodbyeEmail(subscription, tokens);
  } catch (error) {
    console.error("No fue posible enviar el correo de despedida del boletín.");
    console.error(error);
  }
}

async function dispatchPublishedArticleBulletin(article) {
  const activeSubscriptions = await Subscription.find({ status: "active" }).select("name email status plan");

  for (const subscription of activeSubscriptions) {
    try {
      await sendNewsletterArticlePublishedEmail(subscription, { article });
    } catch (error) {
      console.error(`No fue posible enviar el aviso editorial a ${subscription.email}.`);
      console.error(error);
    }
  }
}

function hasLockedPublicSubscriptionStatus(subscription) {
  return subscription?.status === "paused";
}

async function buildPublicFilters(query) {
  const filters = publishedVisibleArticleFilter();
  const search = String(query.search ?? "").trim();
  const tag = sanitizeTags([query.tag])[0] ?? "";
  const excludeId = String(query.excludeId ?? "").trim();
  const categorySlug = String(query.category ?? "")
    .trim()
    .toLowerCase();

  if (search) {
    const searchClauses = buildPublicSearchFilters(search);

    if (searchClauses.length > 0) {
      filters.$and = [...(filters.$and ?? []), ...searchClauses];
    }
  }

  if (tag) {
    filters.tags = tag;
  }

  if (excludeId && isValidObjectId(excludeId)) {
    filters._id = {
      $ne: excludeId
    };
  }

  if (categorySlug) {
    const category = await Category.findOne({ slug: categorySlug }).select("_id");

    if (!category) {
      return {
        filters: null,
        search
      };
    }

    filters.category = category._id;
  }

  return {
    filters,
    search
  };
}

async function findNextArticle(currentArticle) {
  const currentPublishedAt = currentArticle.publishedAt ?? currentArticle.updatedAt ?? new Date(0);
  const categoryId = currentArticle.category?._id ?? currentArticle.category ?? null;
  const tags = sanitizeTags(currentArticle.tags ?? []);
  const relatedQueries = [];

  if (categoryId) {
    relatedQueries.push({ category: categoryId });
  }

  for (const tag of tags) {
    relatedQueries.push({ tags: tag });
  }

  for (const query of relatedQueries) {
    const moreRecent = await Article.findOne({
      deletedAt: null,
      status: "published",
      _id: { $ne: currentArticle._id },
      publishedAt: { $gt: currentPublishedAt },
      ...query
    })
      .populate(articlePopulate())
      .sort({ publishedAt: 1, _id: 1 });

    if (moreRecent) {
      return moreRecent;
    }

    const latestRelated = await Article.findOne({
      deletedAt: null,
      status: "published",
      _id: { $ne: currentArticle._id },
      ...query
    })
      .populate(articlePopulate())
      .sort({ publishedAt: -1, _id: -1 });

    if (latestRelated) {
      return latestRelated;
    }
  }

  return Article.findOne({
    status: "published",
    deletedAt: null,
    _id: { $ne: currentArticle._id }
  })
    .populate(articlePopulate())
    .sort({ publishedAt: -1, _id: -1 });
}

export async function getPublicSite(_req, res, next) {
  try {
    const siteSetting = await getMainSiteSetting();
    const communication = await getActiveSiteCommunication(siteSetting);

    const [featured, mostRead, latest] = await Promise.all([
      siteSetting.featuredArticle
        ? Article.findOne(publishedVisibleArticleFilter({ _id: siteSetting.featuredArticle })).populate(articlePopulate())
        : Promise.resolve(null),
      Article.findOne(publishedVisibleArticleFilter())
        .populate(articlePopulate())
        .sort({ "metrics.views": -1, "metrics.shares": -1, "metrics.reactions": -1, publishedAt: -1, _id: -1 }),
      Article.find(publishedVisibleArticleFilter())
        .populate(articlePopulate())
        .sort({ publishedAt: -1 })
        .limit(8)
    ]);

    res.json({
      featured: featured ? serializeArticle(featured) : latest[0] ? serializeArticle(latest[0]) : null,
      mostRead: mostRead ? serializeArticle(mostRead) : null,
      latest: latest.map(serializeArticle),
      communication
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicCommunication(_req, res, next) {
  try {
    const communication = await getActiveSiteCommunication();
    res.json({
      communication
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicArchiveFilters(_req, res, next) {
  try {
    const baseFilter = publishedVisibleArticleFilter();
    const [categoryCounts, rawTagCounts] = await Promise.all([
      Article.aggregate([
        {
          $match: {
            ...baseFilter,
            category: { $ne: null }
          }
        },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 }
          }
        },
        {
          $sort: {
            count: -1,
            _id: 1
          }
        }
      ]),
      Article.aggregate([
        {
          $match: baseFilter
        },
        {
          $unwind: "$tags"
        },
        {
          $match: {
            tags: { $type: "string", $ne: "" }
          }
        },
        {
          $group: {
            _id: "$tags",
            count: { $sum: 1 }
          }
        },
        {
          $sort: {
            count: -1,
            _id: 1
          }
        },
        {
          $limit: publicArchiveTagLimit
        }
      ])
    ]);

    const categoryIds = categoryCounts
      .map((entry) => entry?._id)
      .filter(Boolean);
    const categories =
      categoryIds.length > 0
        ? await Category.find({
            _id: { $in: categoryIds }
          }).select("name slug description isActive")
        : [];
    const categoryMap = new Map(categories.map((category) => [category._id.toString(), category]));
    const serializedCategories = categoryCounts.flatMap((entry) => {
      const categoryId = entry?._id?.toString?.() ?? String(entry?._id ?? "");
      const category = categoryMap.get(categoryId);

      if (!category) {
        return [];
      }

      return [
        {
          id: category._id.toString(),
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          isActive: category.isActive !== false,
          count: Number(entry?.count ?? 0)
        }
      ];
    });
    const tags = rawTagCounts
      .map((entry) => {
        const value = sanitizeTags([entry?._id])[0] ?? "";

        if (!value) {
          return null;
        }

        return {
          value,
          label: humanizeArchiveLabel(value),
          count: Number(entry?.count ?? 0)
        };
      })
      .filter(Boolean);

    res.json({
      categories: serializedCategories,
      tags
    });
  } catch (error) {
    next(error);
  }
}

export { dispatchPublishedArticleBulletin };

export async function listPublicArticles(req, res, next) {
  try {
    const page = readBoundedPositiveInt(req.query.page, 1);
    const limit = readBoundedPositiveInt(req.query.limit, 12, { max: 24 });
    const sortDefinition = readPublicArticleSort(req.query.sort);
    const { filters } = await buildPublicFilters(req.query);

    if (!filters) {
      return res.json({
        items: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      });
    }

    const [items, total] = await Promise.all([
      Article.find(filters)
        .populate(articlePopulate())
        .sort(sortDefinition.sort)
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

export async function getPublicArticle(req, res, next) {
  try {
    const item = await Article.findOne({
      slug: req.params.slug,
      status: "published",
      deletedAt: null
    }).populate(articlePopulate());

    if (!item) {
      return res.status(404).json({
        message: "Artículo no encontrado."
      });
    }

    item.metrics = item.metrics ?? { views: 0, shares: 0, reactions: 0 };

    if (await shouldCountArticleView(req, res, item._id)) {
      await Article.updateOne(
        { _id: item._id },
        {
          $inc: {
            "metrics.views": 1
          }
        }
      );
      item.metrics.views = (item.metrics?.views ?? 0) + 1;
    }

    const nextArticle = await findNextArticle(item);

    res.json({
      article: serializeArticle(item),
      nextArticle: nextArticle ? serializeArticlePreview(nextArticle) : null
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicAuthor(req, res, next) {
  try {
    const authorId = String(req.params.authorId ?? "").trim();

    if (!isValidObjectId(authorId)) {
      return res.status(404).json({
        message: "Autor no encontrado."
      });
    }

    const page = readBoundedPositiveInt(req.query.page, 1);
    const limit = readBoundedPositiveInt(req.query.limit, 12, { max: 24 });
    const author = await User.findById(authorId).select("name role");

    if (!author) {
      return res.status(404).json({
        message: "Autor no encontrado."
      });
    }

    const filters = publishedVisibleArticleFilter({ author: author._id });

    const [items, total, latestPublication] = await Promise.all([
      Article.find(filters)
        .populate(articlePopulate())
        .sort({ publishedAt: -1, updatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Article.countDocuments(filters),
      Article.findOne(filters)
        .sort({ publishedAt: -1, updatedAt: -1, _id: -1 })
        .select("publishedAt updatedAt")
    ]);

    res.json({
      author: serializeAuthorProfile(author, {
        articleCount: total,
        latestPublishedAt: latestPublication?.publishedAt ?? latestPublication?.updatedAt ?? null
      }),
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

export async function getRobotsTxt(_req, res, next) {
  try {
    const sitemapUrl = new URL("/sitemap.xml", `${env.publicSiteUrl}/`).toString();
    const body = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /dashboard",
      "Disallow: /login",
      "Disallow: /boletin",
      "Disallow: /api/",
      `Sitemap: ${sitemapUrl}`
    ].join("\n");

    res.type("text/plain; charset=utf-8").send(body);
  } catch (error) {
    next(error);
  }
}

export async function getSitemapXml(_req, res, next) {
  try {
    const [articles, authorIds] = await Promise.all([
      Article.find(publishedVisibleArticleFilter())
        .select("slug author publishedAt updatedAt featured")
        .sort({ publishedAt: -1, updatedAt: -1, _id: -1 }),
      Article.distinct("author", publishedVisibleArticleFilter())
    ]);

    const uniqueAuthorIds = [...new Set(authorIds.map((item) => item?.toString?.() ?? "").filter(Boolean))];
    const urls = [
      {
        loc: env.publicSiteUrl,
        lastmod: new Date().toISOString(),
        changefreq: "hourly",
        priority: "1.0"
      },
      ...uniqueAuthorIds.map((authorId) => ({
        loc: buildPublicAuthorUrl(authorId),
        lastmod: new Date().toISOString(),
        changefreq: "daily",
        priority: "0.6"
      })),
      ...articles.map((article) => ({
        loc: buildPublicArticleUrl(article.slug),
        lastmod: formatSeoDate(article.updatedAt ?? article.publishedAt) || new Date().toISOString(),
        changefreq: "daily",
        priority: article.featured ? "0.9" : "0.8"
      }))
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>
    <priority>${escapeXml(entry.priority)}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.type("application/xml; charset=utf-8").send(xml);
  } catch (error) {
    next(error);
  }
}

export async function createPublicSubscription(req, res, next) {
  try {
    const payload = subscriptionInputSchema.parse(req.body);
    const existing = await Subscription.findOne({ email: payload.email });
    const interests = sanitizeTags(payload.interests);

    if (existing?.status === "active" || hasLockedPublicSubscriptionStatus(existing)) {
      return res.status(202).json(
        serializeSubscriptionMessage(publicSubscriptionAcceptedMessage)
      );
    }

    const subscription = existing ?? new Subscription({ email: payload.email });
    const wasExisting = Boolean(existing);

    if (env.newsletterRequireConfirm) {
      const confirmation = createExpiringToken(72);
      let unsubscribeToken = "";

      await persistThenSendSubscriptionMail({
        subscription,
        wasExisting,
        mutate() {
          applyPublicSubscriptionDetails(subscription, payload, interests);
          unsubscribeToken = rotateUnsubscribeToken(subscription);
          subscription.status = "pending";
          subscription.confirmedAt = null;
          subscription.welcomeSentAt = null;
          subscription.confirmationTokenHash = confirmation.hash;
          subscription.confirmationTokenExpiresAt = confirmation.expiresAt;
        },
        deliver() {
          return sendConfirmationOrThrow(subscription, {
            confirmationToken: confirmation.token,
            unsubscribeToken
          });
        }
      });

      await logSubscriptionEvent(req, subscription, "subscription.confirmation_requested", {
        plan: subscription.plan,
        confirmationRequired: true
      });

      return res.status(202).json(serializeSubscriptionMessage(publicSubscriptionAcceptedMessage));
    }

    const activatedAt = new Date();
    let unsubscribeToken = "";

    await persistThenSendSubscriptionMail({
      subscription,
      wasExisting,
      mutate() {
        applyPublicSubscriptionDetails(subscription, payload, interests);
        unsubscribeToken = rotateUnsubscribeToken(subscription);
        subscription.status = "active";
        subscription.confirmedAt = activatedAt;
        subscription.welcomeSentAt = activatedAt;
        subscription.confirmationTokenHash = "";
        subscription.confirmationTokenExpiresAt = null;
      },
      deliver() {
        return sendWelcomeOrThrow(subscription, { unsubscribeToken });
      }
    });

    await logSubscriptionEvent(req, subscription, "subscription.activated", {
      plan: subscription.plan,
      confirmationRequired: false
    });

    res
      .status(202)
      .json(serializeSubscriptionMessage(publicSubscriptionProcessedMessage));
  } catch (error) {
    next(error);
  }
}

export async function confirmPublicSubscription(req, res, next) {
  try {
    const payload = subscriptionTokenSchema.parse(req.body);
    const tokenHash = hashOpaqueToken(payload.token);
    const subscription = await Subscription.findOne({ confirmationTokenHash: tokenHash });

    if (!subscription) {
      throw createHttpError(404, "El enlace de confirmación no es válido.");
    }

    if (subscription.confirmationTokenExpiresAt && subscription.confirmationTokenExpiresAt < new Date()) {
      throw createHttpError(410, "El enlace de confirmación ya venció. Solicita una nueva suscripción.");
    }

    if (subscription.status !== "pending") {
      throw createHttpError(409, "El enlace de confirmación ya no está disponible.");
    }

    const confirmedAt = new Date();
    let unsubscribeToken = "";

    await persistThenSendSubscriptionMail({
      subscription,
      wasExisting: true,
      mutate() {
        unsubscribeToken = rotateUnsubscribeToken(subscription);
        subscription.status = "active";
        subscription.confirmedAt = confirmedAt;
        subscription.welcomeSentAt = confirmedAt;
        subscription.confirmationTokenHash = "";
        subscription.confirmationTokenExpiresAt = null;
      },
      deliver() {
        return sendWelcomeOrThrow(subscription, { unsubscribeToken });
      }
    });

    await logSubscriptionEvent(req, subscription, "subscription.confirmed", {
      confirmedAt: subscription.confirmedAt
    });

    res.json(serializeSubscriptionMessage("Suscripción confirmada. Ya puedes recibir nuevas publicaciones del boletín."));
  } catch (error) {
    next(error);
  }
}

export async function reactivatePublicSubscription(req, res, next) {
  try {
    const payload = subscriptionTokenSchema.parse(req.body);
    const tokenHash = hashOpaqueToken(payload.token);
    const subscription = await Subscription.findOne({ confirmationTokenHash: tokenHash });

    if (!subscription) {
      throw createHttpError(404, "El enlace de reactivación no es válido.");
    }

    if (subscription.confirmationTokenExpiresAt && subscription.confirmationTokenExpiresAt < new Date()) {
      throw createHttpError(410, "El enlace de reactivación ya venció. Puedes volver a suscribirte desde la portada.");
    }

    if (subscription.status !== "cancelled") {
      throw createHttpError(409, "La suscripción ya no necesita reactivación.");
    }

    const reactivatedAt = new Date();
    let unsubscribeToken = "";

    await persistThenSendSubscriptionMail({
      subscription,
      wasExisting: true,
      mutate() {
        unsubscribeToken = rotateUnsubscribeToken(subscription);
        subscription.status = "active";
        subscription.confirmedAt = subscription.confirmedAt ?? reactivatedAt;
        subscription.welcomeSentAt = reactivatedAt;
        subscription.confirmationTokenHash = "";
        subscription.confirmationTokenExpiresAt = null;
      },
      deliver() {
        return sendWelcomeOrThrow(subscription, { unsubscribeToken });
      }
    });

    await logSubscriptionEvent(req, subscription, "subscription.reactivated", {
      reactivatedAt
    });

    res.json(serializeSubscriptionMessage("Suscripción reactivada. Volverás a recibir nuevas publicaciones del boletín."));
  } catch (error) {
    next(error);
  }
}

export async function unsubscribePublicSubscription(req, res, next) {
  try {
    const payload = subscriptionTokenSchema.parse(req.body);
    const tokenHash = hashOpaqueToken(payload.token);
    const subscription = await Subscription.findOne({ unsubscribeTokenHash: tokenHash });

    if (!subscription) {
      throw createHttpError(404, "El enlace de salida no es valido.");
    }

    const reactivation = createExpiringToken(24 * 30);
    subscription.status = "cancelled";
    subscription.confirmationTokenHash = reactivation.hash;
    subscription.confirmationTokenExpiresAt = reactivation.expiresAt;
    await subscription.save();

    void sendGoodbyeBestEffort(subscription, {
      reactivationToken: reactivation.token
    });

    await logSubscriptionEvent(req, subscription, "subscription.cancelled", {
      cancelledAt: new Date()
    });

    res.json(
      serializeSubscriptionMessage(
        "Tu suscripción fue cancelada correctamente. Si cambias de idea, puedes volver desde el correo de despedida o desde la portada."
      )
    );
  } catch (error) {
    next(error);
  }
}
