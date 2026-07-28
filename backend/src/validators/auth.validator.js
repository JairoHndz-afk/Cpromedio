import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido.").transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(120, "La contraseña no puede superar 120 caracteres.")
});
