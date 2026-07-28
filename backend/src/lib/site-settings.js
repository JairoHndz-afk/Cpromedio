import { Article } from "../models/Article.js";
import { SiteSetting } from "../models/SiteSetting.js";

const MAIN_SITE_KEY = "main";
const MAX_COMMUNICATION_COOKIE_HOURS = 24 * 31;

function toObjectIdString(value) {
  return value?.toString?.() ?? String(value ?? "");
}

function normalizeCommunicationText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

function toCommunicationPayload(communication) {
  if (!communication?.title || !communication?.message || !communication?.version || !communication?.expiresAt) {
    return null;
  }

  return {
    eyebrow: normalizeCommunicationText(communication.eyebrow, "Comunicado editorial"),
    title: normalizeCommunicationText(communication.title),
    message: normalizeCommunicationText(communication.message),
    ctaLabel: normalizeCommunicationText(communication.ctaLabel),
    ctaUrl: normalizeCommunicationText(communication.ctaUrl),
    durationHours: Math.min(MAX_COMMUNICATION_COOKIE_HOURS, Math.max(1, Number(communication.durationHours ?? 24))),
    publishedAt: communication.publishedAt ? new Date(communication.publishedAt).toISOString() : null,
    expiresAt: new Date(communication.expiresAt).toISOString(),
    version: normalizeCommunicationText(communication.version)
  };
}

function isExpiredCommunication(communication) {
  if (!communication?.expiresAt) {
    return true;
  }

  const expiresAt = new Date(communication.expiresAt);

  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
}

export async function getMainSiteSetting() {
  const siteSetting = await SiteSetting.findOneAndUpdate(
    { key: MAIN_SITE_KEY },
    {
      $setOnInsert: {
        key: MAIN_SITE_KEY
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  if (siteSetting?.communication && isExpiredCommunication(siteSetting.communication)) {
    siteSetting.communication = null;
    await siteSetting.save();
  }

  return siteSetting;
}

export async function clearFeaturedArticleSelection(currentArticleId = null) {
  if (currentArticleId) {
    await Article.updateOne({ _id: currentArticleId }, { $set: { featured: false } });
    const siteSetting = await getMainSiteSetting();

    if (sameObjectId(siteSetting.featuredArticle, currentArticleId)) {
      siteSetting.featuredArticle = null;
      await siteSetting.save();
    }

    return;
  }

  await Article.updateMany({ featured: true }, { $set: { featured: false } });
  await SiteSetting.findOneAndUpdate(
    { key: MAIN_SITE_KEY },
    {
      $set: { featuredArticle: null },
      $setOnInsert: { key: MAIN_SITE_KEY }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
}

export async function setFeaturedArticleSelection(articleId) {
  await Article.updateMany(
    {
      featured: true,
      _id: { $ne: articleId }
    },
    {
      $set: { featured: false }
    }
  );

  await Article.updateOne({ _id: articleId }, { $set: { featured: true } });

  await SiteSetting.findOneAndUpdate(
    { key: MAIN_SITE_KEY },
    {
      $set: { featuredArticle: articleId },
      $setOnInsert: { key: MAIN_SITE_KEY }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
}

export async function repairFeaturedArticleSelection() {
  const siteSetting = await getMainSiteSetting();

  if (siteSetting.featuredArticle) {
    const validFeatured = await Article.findOne({
      _id: siteSetting.featuredArticle,
      status: "published",
      deletedAt: null
    }).select("_id");

    if (validFeatured) {
      await Article.updateOne({ _id: validFeatured._id }, { $set: { featured: true } });
      await Article.updateMany(
        {
          featured: true,
          _id: { $ne: validFeatured._id }
        },
        {
          $set: { featured: false }
        }
      );
      return validFeatured._id;
    }
  }

  const fallbackFeatured = await Article.findOne({
    featured: true,
    status: "published",
    deletedAt: null
  })
    .sort({ publishedAt: -1, updatedAt: -1 })
    .select("_id");

  if (fallbackFeatured) {
    await setFeaturedArticleSelection(fallbackFeatured._id);
    return fallbackFeatured._id;
  }

  await clearFeaturedArticleSelection();
  return null;
}

export function serializeSiteCommunication(communication) {
  return toCommunicationPayload(communication);
}

export async function getActiveSiteCommunication(siteSetting = null) {
  const activeSiteSetting = siteSetting ?? (await getMainSiteSetting());

  if (!activeSiteSetting?.communication) {
    return null;
  }

  if (isExpiredCommunication(activeSiteSetting.communication)) {
    activeSiteSetting.communication = null;
    await activeSiteSetting.save();
    return null;
  }

  return serializeSiteCommunication(activeSiteSetting.communication);
}

export async function saveSiteCommunication(communication) {
  const siteSetting = await getMainSiteSetting();
  siteSetting.communication = communication;
  await siteSetting.save();
  return siteSetting;
}

export async function clearSiteCommunication() {
  const siteSetting = await getMainSiteSetting();

  if (!siteSetting.communication) {
    return siteSetting;
  }

  siteSetting.communication = null;
  await siteSetting.save();
  return siteSetting;
}

export function sameObjectId(left, right) {
  return Boolean(left && right && toObjectIdString(left) === toObjectIdString(right));
}
