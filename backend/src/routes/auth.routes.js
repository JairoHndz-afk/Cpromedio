import { Router } from "express";

import { getSession, login, logout } from "../controllers/auth.controller.js";
import { attachCurrentUser } from "../middlewares/auth.js";
import { authRateLimit } from "../middlewares/rate-limit.js";

const router = Router();

router.post("/login", authRateLimit, login);
router.post("/logout", attachCurrentUser, logout);
router.get("/me", attachCurrentUser, getSession);

export default router;
