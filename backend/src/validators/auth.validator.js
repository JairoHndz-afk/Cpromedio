import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresa un correo valido.").transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres.").max(120, "La contrasena no puede superar 120 caracteres.")
});
