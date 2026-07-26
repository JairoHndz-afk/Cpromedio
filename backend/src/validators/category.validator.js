import { z } from "zod";

export const categoryInputSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").max(80, "El nombre no puede superar 80 caracteres."),
  description: z.string().max(200, "La descripcion no puede superar 200 caracteres.").optional().default(""),
  isActive: z.boolean().optional().default(true)
});
