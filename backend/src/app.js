import path from "node:path";
import { fileURLToPath } from "node:url";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { attachCurrentUser } from "./middlewares/auth.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { generalRateLimit } from "./middlewares/rate-limit.js";
import { rejectDisallowedOrigin, requireTrustedHost, requireTrustedMutation } from "./middlewares/security.js";
import apiRoutes from "./routes/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(currentDir, "..", "uploads");

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy);
  app.locals.cookieName = env.cookieName;

  app.use(requireTrustedHost);
  app.use(rejectDisallowedOrigin);
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || env.isAllowedOrigin(origin));
      },
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-Requested-With", "Authorization"],
      maxAge: 600,
      optionsSuccessStatus: 204
    })
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: false
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));
  app.use(generalRateLimit);
  app.use(requireTrustedMutation);
  app.use(attachCurrentUser);
  app.use(morgan(env.isProduction ? "combined" : "dev"));
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      etag: true,
      maxAge: env.isProduction ? 1000 * 60 * 60 * 24 * 7 : 0,
      setHeaders(response) {
        response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
        response.setHeader("X-Content-Type-Options", "nosniff");
      }
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({
      name: "periodico-backend",
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });

  app.use("/api", apiRoutes);

  app.use((req, res) => {
    res.status(404).json({
      message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
  });

  app.use(errorHandler);

  return app;
}
