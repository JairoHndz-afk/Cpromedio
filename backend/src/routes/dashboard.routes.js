import { Router } from "express";

import {
  createAlliedFeedSource,
  createCategory,
  createDashboardArticle,
  createUser,
  changeOwnPassword,
  deleteAlliedFeedSource,
  deleteDashboardCommunication,
  deleteDashboardArticle,
  getDashboardArticle,
  listAlliedFeedSources,
  getDashboardCommunication,
  getDashboardOverview,
  listAuditLogs,
  listDashboardArticles,
  listDashboardCategories,
  listSubscriptions,
  listUsers,
  moderateArticle,
  deleteSubscription,
  deleteUser,
  submitArticleForReview,
  syncAlliedFeedSourceNow,
  updateOwnProfile,
  updateAlliedFeedSource,
  updateDashboardCommunication,
  updateCategory,
  updateDashboardArticle,
  updateSubscription,
  updateUser
} from "../controllers/dashboard.controller.js";
import { uploadArticleImage } from "../controllers/upload.controller.js";
import { attachCurrentUser, requireAuth, requireRole } from "../middlewares/auth.js";
import { uploadImageRateLimit } from "../middlewares/rate-limit.js";

const router = Router();

router.use(attachCurrentUser, requireAuth);

router.get("/overview", getDashboardOverview);
router.get("/communication", requireRole("admin"), getDashboardCommunication);
router.put("/communication", requireRole("admin"), updateDashboardCommunication);
router.delete("/communication", requireRole("admin"), deleteDashboardCommunication);
router.get("/allied-feeds", requireRole("admin"), listAlliedFeedSources);
router.post("/allied-feeds", requireRole("admin"), createAlliedFeedSource);
router.put("/allied-feeds/:sourceId", requireRole("admin"), updateAlliedFeedSource);
router.delete("/allied-feeds/:sourceId", requireRole("admin"), deleteAlliedFeedSource);
router.post("/allied-feeds/:sourceId/sync", requireRole("admin"), syncAlliedFeedSourceNow);
router.put("/profile", updateOwnProfile);
router.put("/profile/password", changeOwnPassword);
router.post("/uploads/images", uploadImageRateLimit, uploadArticleImage);
router.get("/articles", listDashboardArticles);
router.get("/articles/:articleId", getDashboardArticle);
router.post("/articles", createDashboardArticle);
router.put("/articles/:articleId", updateDashboardArticle);
router.delete("/articles/:articleId", deleteDashboardArticle);
router.post("/articles/:articleId/submit", submitArticleForReview);
router.post("/articles/:articleId/moderate", requireRole("admin"), moderateArticle);

router.get("/categories", listDashboardCategories);
router.post("/categories", requireRole("admin"), createCategory);
router.put("/categories/:categoryId", requireRole("admin"), updateCategory);

router.get("/users", requireRole("admin"), listUsers);
router.post("/users", requireRole("admin"), createUser);
router.put("/users/:userId", requireRole("admin"), updateUser);
router.delete("/users/:userId", requireRole("admin"), deleteUser);

router.get("/audit-logs", requireRole("admin"), listAuditLogs);
router.get("/subscriptions", requireRole("admin"), listSubscriptions);
router.put("/subscriptions/:subscriptionId", requireRole("admin"), updateSubscription);
router.delete("/subscriptions/:subscriptionId", requireRole("admin"), deleteSubscription);

export default router;
