import bcrypt from "bcryptjs";

import { buildCookieOptions, signAuthToken } from "../lib/auth.js";
import { censorColombianProfanity } from "../lib/colombian-profanity.js";
import { createOpaqueToken, hashOpaqueToken } from "../lib/newsletter-tokens.js";
import { writeAuditLog } from "../lib/audit.js";
import { Article } from "../models/Article.js";
import { ArticleComment } from "../models/ArticleComment.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { sanitizeOwnedMediaUrl, sanitizeText } from "../utils/content.js";
import { serializeUser } from "./auth.controller.js";
import { readerAccessCreateSchema, readerAccessLookupSchema, readerCommentUpdateSchema, readerRegisterSchema } from "../validators/reader.validator.js";

const readerNameChangeWindowMs = 7 * 24 * 60 * 60 * 1000;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function resolveNameChangeAvailability(user) {
  if (user.role !== "reader") {
    return {
      canChangeNameNow: true,
      nameChangeAvailableAt: null
    };
  }

  const lastNameChangeTime = user.nameChangedAt ? new Date(user.nameChangedAt).getTime() : 0;

  if (!lastNameChangeTime) {
    return {
      canChangeNameNow: true,
      nameChangeAvailableAt: null
    };
  }

  const nameChangeAvailableAt = new Date(lastNameChangeTime + readerNameChangeWindowMs);
  const canChangeNameNow = nameChangeAvailableAt.getTime() <= Date.now();

  return {
    canChangeNameNow,
    nameChangeAvailableAt: canChangeNameNow ? null : nameChangeAvailableAt.toISOString()
  };
}

function serializeReaderSubscription(subscription) {
  if (!subscription) {
    return null;
  }

  return {
    id: subscription._id.toString(),
    name: sanitizeText(subscription.name ?? "", 80),
    email: subscription.email,
    plan: subscription.plan,
    status: subscription.status,
    createdAt: subscription.createdAt,
    confirmedAt: subscription.confirmedAt ?? null
  };
}

function serializeReaderAccountPayload(user, subscription) {
  return {
    user: serializeUser(user),
    subscription: serializeReaderSubscription(subscription),
    permissions: resolveNameChangeAvailability(user)
  };
}

function serializeOwnComment(comment) {
  return {
    id: comment._id.toString(),
    article: comment.article
      ? {
          id: comment.article._id.toString(),
          slug: comment.article.slug,
          title: comment.article.title
        }
      : null,
    body: sanitizeText(comment.body ?? "", 1600),
    status: comment.status,
    featured: comment.featured === true,
    censored: comment.censored === true,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    canEdit: comment.status === "approved"
  };
}

async function ensureActiveReaderSubscription({ name, email }) {
  const now = new Date();
  const subscription = (await Subscription.findOne({ email })) ?? new Subscription({ email });

  subscription.name = sanitizeText(name, 80);
  subscription.plan = subscription.plan ?? "newsletter";
  subscription.source = subscription.source || "reader-account";
  subscription.status = "active";
  subscription.confirmedAt = subscription.confirmedAt ?? now;
  subscription.confirmationTokenHash = "";
  subscription.confirmationTokenExpiresAt = null;

  if (!subscription.unsubscribeTokenHash) {
    subscription.unsubscribeTokenHash = hashOpaqueToken(createOpaqueToken());
  }

  await subscription.save();
  return subscription;
}

async function findReaderUserByEmail(email) {
  return User.findOne({
    email,
    role: "reader"
  });
}

async function resolveSubscriptionByAccessToken(token) {
  const tokenHash = hashOpaqueToken(token);
  return Subscription.findOne({ unsubscribeTokenHash: tokenHash });
}

export async function registerReader(req, res, next) {
  try {
    const payload = readerRegisterSchema.parse(req.body);
    const existingUser = await User.findOne({ email: payload.email });

    if (existingUser) {
      return res.status(409).json({
        message: existingUser.role === "reader"
          ? "Ya existe una cuenta con este correo. Puedes iniciar sesión."
          : "Este correo ya está asociado a una cuenta interna. Usa el acceso correspondiente."
      });
    }

    const subscription = await ensureActiveReaderSubscription({
      name: payload.name,
      email: payload.email
    });
    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await User.create({
      name: sanitizeText(payload.name, 80),
      email: payload.email,
      passwordHash,
      role: "reader",
      status: "active",
      subscription: subscription._id,
      nameChangedAt: null
    });

    const token = signAuthToken(user);
    res.cookie(req.app.locals.cookieName, token, buildCookieOptions());

    await writeAuditLog(req, {
      actor: user,
      action: "reader.registered",
      targetType: "user",
      targetId: user._id.toString(),
      details: {
        email: user.email,
        subscriptionId: subscription._id.toString()
      }
    });

    res.status(201).json({
      message: "Tu cuenta quedó lista. Ya puedes comentar y administrar tus aportes.",
      user: serializeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function getReaderSubscriptionAccess(req, res, next) {
  try {
    const payload = readerAccessLookupSchema.parse({
      token: req.query.token
    });
    const subscription = await resolveSubscriptionByAccessToken(payload.token);

    if (!subscription) {
      throw createHttpError(404, "El enlace de gestión ya no está disponible.");
    }

    const readerUser = await findReaderUserByEmail(subscription.email);

    res.json({
      subscription: serializeReaderSubscription(subscription),
      readerAccount: {
        exists: Boolean(readerUser),
        name: readerUser ? sanitizeText(readerUser.name ?? "", 80) : "",
        createdAt: readerUser?.createdAt ?? null
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function createReaderFromSubscriptionAccess(req, res, next) {
  try {
    const payload = readerAccessCreateSchema.parse(req.body);
    const subscription = await resolveSubscriptionByAccessToken(payload.token);

    if (!subscription) {
      throw createHttpError(404, "El enlace de gestión ya no está disponible.");
    }

    if (subscription.status === "cancelled") {
      throw createHttpError(409, "La suscripción asociada a este enlace está cancelada. Reactívala antes de crear tu cuenta.");
    }

    const existingUser = await User.findOne({ email: subscription.email });

    if (existingUser) {
      return res.status(409).json({
        message: existingUser.role === "reader"
          ? "Ya existe una cuenta asociada a este correo. Puedes iniciar sesión."
          : "Este correo ya está ligado a una cuenta interna. Usa el acceso correspondiente."
      });
    }

    const readerName = sanitizeText(payload.name || subscription.name || "", 80);

    if (readerName.length < 2) {
      throw createHttpError(400, "El nombre visible debe tener al menos 2 caracteres.");
    }

    subscription.name = readerName;
    subscription.status = "active";
    subscription.confirmedAt = subscription.confirmedAt ?? new Date();
    await subscription.save();

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await User.create({
      name: readerName,
      email: subscription.email,
      passwordHash,
      role: "reader",
      status: "active",
      subscription: subscription._id,
      nameChangedAt: null
    });

    const token = signAuthToken(user);
    res.cookie(req.app.locals.cookieName, token, buildCookieOptions());

    await writeAuditLog(req, {
      actor: user,
      action: "reader.subscription_access_created",
      targetType: "user",
      targetId: user._id.toString(),
      details: {
        email: user.email,
        subscriptionId: subscription._id.toString()
      }
    });

    res.status(201).json({
      message: "Tu cuenta quedó creada. Ya puedes entrar, comentar y gestionar tus aportes.",
      user: serializeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function getReaderAccount(req, res, next) {
  try {
    const subscription = req.user.subscription
      ? await Subscription.findById(req.user.subscription)
      : await Subscription.findOne({ email: req.user.email });

    res.json(serializeReaderAccountPayload(req.user, subscription));
  } catch (error) {
    next(error);
  }
}

export async function listOwnReaderComments(req, res, next) {
  try {
    const comments = await ArticleComment.find({
      authorUser: req.user._id
    })
      .sort({ createdAt: -1, _id: -1 })
      .populate({
        path: "article",
        select: "title slug"
      });

    res.json({
      items: comments.map(serializeOwnComment)
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOwnReaderComment(req, res, next) {
  try {
    const payload = readerCommentUpdateSchema.parse(req.body);
    const comment = await ArticleComment.findOne({
      _id: req.params.commentId,
      authorUser: req.user._id
    });

    if (!comment) {
      return res.status(404).json({
        message: "Comentario no encontrado."
      });
    }

    if (comment.status !== "approved") {
      return res.status(409).json({
        message: "Solo puedes editar comentarios visibles en este momento."
      });
    }

    const censorship = censorColombianProfanity(sanitizeText(payload.body, 1600));
    comment.body = censorship.value;
    comment.censored = censorship.wasCensored;
    comment.censoredTerms = censorship.matchedTerms;
    await comment.save();

    await writeAuditLog(req, {
      actor: req.user,
      action: "comment.reader_updated",
      targetType: "article-comment",
      targetId: comment._id.toString(),
      details: {
        censored: censorship.wasCensored,
        censoredTerms: censorship.matchedTerms
      }
    });

    res.json({
      comment: serializeOwnComment(
        await ArticleComment.findById(comment._id).populate({
          path: "article",
          select: "title slug"
        })
      )
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteOwnReaderComment(req, res, next) {
  try {
    const comment = await ArticleComment.findOne({
      _id: req.params.commentId,
      authorUser: req.user._id
    });

    if (!comment) {
      return res.status(404).json({
        message: "Comentario no encontrado."
      });
    }

    await ArticleComment.deleteOne({ _id: comment._id });

    await writeAuditLog(req, {
      actor: req.user,
      action: "comment.reader_deleted",
      targetType: "article-comment",
      targetId: comment._id.toString(),
      details: {
        articleId: comment.article?.toString?.() ?? ""
      }
    });

    res.json({
      message: "Comentario retirado."
    });
  } catch (error) {
    next(error);
  }
}
