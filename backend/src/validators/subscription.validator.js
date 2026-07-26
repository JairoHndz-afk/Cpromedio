import { z } from "zod";

export const subscriptionInputSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").max(80, "El nombre no puede superar 80 caracteres."),
  email: z.string().email("Ingresa un correo valido.").transform((value) => value.trim().toLowerCase()),
  plan: z.enum(["newsletter", "premium"]).optional().default("newsletter"),
  interests: z.array(z.string().max(40, "Cada interes no puede superar 40 caracteres.")).optional().default([])
});

export const subscriptionTokenSchema = z.object({
  token: z.string().min(24, "El token recibido no es valido.").max(240, "El token recibido no es valido.")
});
