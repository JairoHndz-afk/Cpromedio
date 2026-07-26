import { z } from "zod";

const dataUrlPattern = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,[A-Za-z0-9+/=]+$/;

export const imageUploadSchema = z.object({
  dataUrl: z
    .string()
    .min(80, "La imagen cargada es demasiado pequena.")
    .max(8_000_000, "La imagen cargada es demasiado pesada.")
    .refine((value) => dataUrlPattern.test(value), {
      message: "La imagen debe ser PNG, JPG, WEBP, GIF o AVIF."
    }),
  filename: z.string().min(1, "El archivo debe tener un nombre.").max(140, "El nombre del archivo es demasiado largo."),
  alt: z.string().max(140, "El texto alternativo no puede superar 140 caracteres.").optional().default("")
});
