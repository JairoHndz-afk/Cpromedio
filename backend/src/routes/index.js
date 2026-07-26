import { Router } from "express";

import authRoutes from "./auth.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import publicRoutes from "./public.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/public", publicRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
