import { Article } from "../models/Article.js";
import { SiteSetting } from "../models/SiteSetting.js";

const MAIN_SITE_KEY = "main";

function toObjectIdString(value) {
  return value?.toString?.() ?? String(value ?? "");
}

export async function getMainSiteSetting() {
  return SiteSetting.findOneAndUpdate(
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

export function sameObjectId(left, right) {
  return Boolean(left && right && toObjectIdString(left) === toObjectIdString(right));
}
