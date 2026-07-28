import { z } from "zod";

const communicationPresetSchema = z.enum(["hours", "week", "month"]);

function isValidOptionalUrl(value) {
  if (!value) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return value.startsWith("/");
  }
}

export const communicationInputSchema = z.object({
  eyebrow: z.string().max(60, "El rotulo no puede superar 60 caracteres.").optional().default("Comunicado editorial"),
  title: z.string().min(6, "El titulo debe tener al menos 6 caracteres.").max(140, "El titulo no puede superar 140 caracteres."),
  message: z.string().min(12, "El contenido debe tener al menos 12 caracteres.").max(1200, "El contenido no puede superar 1200 caracteres."),
  ctaLabel: z.string().max(40, "El texto del boton no puede superar 40 caracteres.").optional().default(""),
  ctaUrl: z
    .string()
    .max(500, "El enlace no puede superar 500 caracteres.")
    .optional()
    .default("")
    .refine((value) => isValidOptionalUrl(value), "El enlace debe ser una URL valida o una ruta interna que empiece por /."),
  durationPreset: communicationPresetSchema.optional().default("hours"),
  durationHours: z.coerce.number().int().min(1, "La duracion minima es de 1 hora.").max(24 * 31, "La duracion maxima es de 744 horas.").optional().default(24)
});
