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
import { Article } from "../models/Article.js";
import { AuditLog } from "../models/AuditLog.js";
import { Category } from "../models/Category.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { calculateReadingTime, isValidUrl, paragraphBlocksFromBody, sanitizeContentBlocks, sanitizeOwnedMediaUrl, sanitizeParagraphs, sanitizeTags, sanitizeText, slugify } from "../utils/content.js";
import { readBoundedPositiveInt } from "../utils/request.js";
import { articleInputSchema, moderationSchema } from "../validators/article.validator.js";
import { categoryInputSchema } from "../validators/category.validator.js";
import { communicationInputSchema } from "../validators/site-setting.validator.js";
import { passwordChangeSchema, profileUpdateSchema, subscriptionUpdateSchema, userCreateSchema, userUpdateSchema } from "../validators/user.validator.js";

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

function serializeArticle(article) {
  const rawContentBlocks =
    Array.isArray(article.contentBlocks) && article.contentBlocks.length > 0
      ? article.contentBlocks
      : paragraphBlocksFromBody(article.body ?? []);
  const sanitizedContentBlocks = sanitizeContentBlocks(rawContentBlocks).blocks;
  const contentBlocks = sanitizedContentBlocks.length > 0 ? sanitizedContentBlocks : paragraphBlocksFromBody(article.body ?? []);

  return {
    id: article._id.toString(),
    slug: article.slug,
    title: article.title,
    subtitle: article.subtitle,
    excerpt: article.excerpt,
    body: article.body,
    contentBlocks,
    cover: serializeCover(article.cover),
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
    moderationHistory: article.moderationHistory ?? []
  };
}

function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
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

async function normalizeArticlePayload(input, currentArticle = null) {
  const parsed = articleInputSchema.parse(input);
  const contentSource = parsed.contentBlocks.length > 0 ? parsed.contentBlocks : sanitizeParagraphs(parsed.body);
  const { blocks: contentBlocks, paragraphs: body } = sanitizeContentBlocks(contentSource);

  if (contentBlocks.length === 0) {
    const error = new Error("El articulo debe incluir contenido.");
    error.status = 400;
    throw error;
  }

  const slug = await buildUniqueSlug(parsed.title, currentArticle?._id ?? null);
  const coverUrl = sanitizeText(parsed.cover?.url ?? "", 600);
  let categoryId = null;

  if (parsed.categoryId) {
    if (!mongoose.isValidObjectId(parsed.categoryId)) {
      const error = new Error("La categoria seleccionada no es valida.");
      error.status = 400;
      throw error;
    }

    const category = await Category.findById(parsed.categoryId).select("_id");
    if (!category) {
      const error = new Error("La categoria seleccionada no existe.");
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
      url: isValidUrl(coverUrl) ? coverUrl : "",
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

async function sendPublishedArticleBulletinSafely(article) {
  try {
    await dispatchPublishedArticleBulletin(article);
  } catch (error) {
    console.error("No fue posible despachar el boletin de nueva publicacion.");
    console.error(error);
  }
}

export async function getDashboardOverview(req, res, next) {
  try {
    const baseArticleFilter = req.user.role === "admin" ? {} : { author: req.user._id };
    const articleFilter = visibleArticleFilter(baseArticleFilter);
    const activeOverviewFilter = visibleArticleFilter({ ...baseArticleFilter, status: { $ne: "archived" } });

    const [articleCount, reviewCount, publishedCount, usersCount, subscriptionsCount, recentArticles, topViewedArticles] = await Promise.all([
      Article.countDocuments(articleFilter),
      Article.countDocuments({ ...articleFilter, status: "review" }),
      Article.countDocuments({ ...articleFilter, status: "published" }),
      req.user.role === "admin" ? User.countDocuments({}) : Promise.resolve(null),
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
      return res.status(409).json({ message: "El articulo ya esta en revision." });
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
      return res.status(404).json({ message: "Articulo no encontrado." });
    }

    if (!canAccessArticle(req.user, article)) {
      return res.status(403).json({ message: "No puedes eliminar este articulo." });
    }

    if (req.user.role !== "admin" && !["draft", "changes_requested", "rejected"].includes(article.status)) {
      return res.status(409).json({
        message: "Solo el administrador puede enviar a papelera articulos en revision, aprobados, publicados o archivados."
      });
    }

    if (article.deletedAt) {
      return res.json({ message: "Articulo ya estaba en la papelera editorial." });
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

    res.json({ message: "Articulo enviado a papelera editorial." });
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
            message: "Solo los articulos publicados pueden destacarse en portada."
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
    const filters = {};

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
        message: "No puedes eliminar este usuario mientras tenga articulos asociados. Reasignalos o bloquea la cuenta."
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
    req.user.name = sanitizeText(payload.name, 80);
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
        message: "La contrasena actual no es correcta."
      });
    }

    const samePassword = await bcrypt.compare(payload.nextPassword, user.passwordHash);
    if (samePassword) {
      return res.status(409).json({
        message: "La nueva contrasena debe ser diferente a la actual."
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
      message: "Contrasena actualizada."
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
      return res.status(404).json({ message: "Suscripcion no encontrada." });
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
      return res.status(404).json({ message: "Suscripcion no encontrada." });
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

    res.json({ message: "Suscripcion eliminada." });
  } catch (error) {
    next(error);
  }
}
