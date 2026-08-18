import { Router } from "express";

import { commentCreateRateLimit, subscriptionCreateRateLimit, subscriptionTokenRateLimit } from "../middlewares/rate-limit.js";
import {
  confirmPublicSubscription,
  createPublicArticleComment,
  createPublicSubscription,
  getPublicArticle,
  getPublicArticleComments,
  getPublicArchiveFilters,
  getPublicAuthor,
  getPublicCommunication,
  getRobotsTxt,
  getSitemapXml,
  getPublicSite,
  listPublicArticles,
  reactivatePublicSubscription,
  unsubscribePublicSubscription
} from "../controllers/public.controller.js";

const router = Router();

router.get("/site", getPublicSite);
router.get("/communication", getPublicCommunication);
router.get("/archive-filters", getPublicArchiveFilters);
router.get("/articles", listPublicArticles);
router.get("/articles/:slug/comments", getPublicArticleComments);
router.post("/articles/:slug/comments", commentCreateRateLimit, createPublicArticleComment);
router.get("/articles/:slug", getPublicArticle);
router.get("/authors/:authorId", getPublicAuthor);
router.post("/subscriptions", subscriptionCreateRateLimit, createPublicSubscription);
router.post("/subscriptions/confirm", subscriptionTokenRateLimit, confirmPublicSubscription);
router.post("/subscriptions/reactivate", subscriptionTokenRateLimit, reactivatePublicSubscription);
router.post("/subscriptions/unsubscribe", subscriptionTokenRateLimit, unsubscribePublicSubscription);
router.get("/seo/robots.txt", getRobotsTxt);
router.get("/seo/sitemap.xml", getSitemapXml);

export default router;
