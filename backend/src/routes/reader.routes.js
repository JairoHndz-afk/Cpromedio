import { Router } from "express";

import {
  createReaderFromSubscriptionAccess,
  deleteOwnReaderComment,
  getReaderAccount,
  getReaderSubscriptionAccess,
  listOwnReaderComments,
  registerReader,
  updateOwnReaderComment
} from "../controllers/reader.controller.js";
import { changeOwnPassword, updateOwnProfile } from "../controllers/dashboard.controller.js";
import { attachCurrentUser, requireAuth, requireRole } from "../middlewares/auth.js";
import { readerAccessRateLimit, readerRegisterRateLimit } from "../middlewares/rate-limit.js";

const router = Router();

router.get("/access", getReaderSubscriptionAccess);
router.post("/access", readerAccessRateLimit, createReaderFromSubscriptionAccess);
router.post("/register", readerRegisterRateLimit, registerReader);

router.use(attachCurrentUser, requireAuth, requireRole("reader"));

router.get("/me", getReaderAccount);
router.put("/me", updateOwnProfile);
router.put("/me/password", changeOwnPassword);
router.get("/me/comments", listOwnReaderComments);
router.put("/me/comments/:commentId", updateOwnReaderComment);
router.delete("/me/comments/:commentId", deleteOwnReaderComment);

export default router;
