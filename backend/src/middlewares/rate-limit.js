import rateLimit from "express-rate-limit";

export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas solicitudes. Intenta de nuevo en un minuto."
  }
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados intentos de acceso. Intenta de nuevo mas tarde."
  }
});

export const subscriptionCreateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados intentos de suscripcion. Intenta de nuevo en unos minutos."
  }
});

export const subscriptionTokenRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados intentos sobre enlaces del boletin. Intenta de nuevo en unos minutos."
  }
});

export const uploadImageRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas cargas de imagen. Intenta de nuevo en unos minutos."
  }
});
