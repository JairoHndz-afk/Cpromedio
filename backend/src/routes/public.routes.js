import { Router } from "express";

import { subscriptionCreateRateLimit, subscriptionTokenRateLimit } from "../middlewares/rate-limit.js";
import {
  confirmPublicSubscription,
  createPublicSubscription,
  getPublicArticle,
  getPublicAuthor,
  getRobotsTxt,
  getSitemapXml,
  getPublicSite,
  listPublicArticles,
  reactivatePublicSubscription,
  unsubscribePublicSubscription
} from "../controllers/public.controller.js";

const router = Router();

router.get("/site", getPublicSite);
router.get("/articles", listPublicArticles);
router.get("/articles/:slug", getPublicArticle);
router.get("/authors/:authorId", getPublicAuthor);
router.post("/subscriptions", subscriptionCreateRateLimit, createPublicSubscription);
router.post("/subscriptions/confirm", subscriptionTokenRateLimit, confirmPublicSubscription);
router.post("/subscriptions/reactivate", subscriptionTokenRateLimit, reactivatePublicSubscription);
router.post("/subscriptions/unsubscribe", subscriptionTokenRateLimit, unsubscribePublicSubscription);
router.get("/seo/robots.txt", getRobotsTxt);
router.get("/seo/sitemap.xml", getSitemapXml);

export default router;
