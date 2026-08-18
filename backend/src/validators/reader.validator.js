import { z } from "zod";

import { passwordSchema } from "./user.validator.js";

const tokenSchema = z.string().min(24, "El token recibido no es válido.").max(240, "El token recibido no es válido.");

export const readerRegisterSchema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").max(80, "El nombre no puede superar 80 caracteres."),
    email: z.string().email("Ingresa un correo válido.").transform((value) => value.trim().toLowerCase()),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu contraseña.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "La confirmación no coincide con la contraseña.",
    path: ["confirmPassword"]
  });

export const readerAccessLookupSchema = z.object({
  token: tokenSchema
});

export const readerAccessCreateSchema = z
  .object({
    token: tokenSchema,
    name: z.string().max(80, "El nombre no puede superar 80 caracteres.").optional().default(""),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu contraseña.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "La confirmación no coincide con la contraseña.",
    path: ["confirmPassword"]
  });

export const readerCommentUpdateSchema = z.object({
  body: z.string().min(8, "El comentario debe tener al menos 8 caracteres.").max(1600, "El comentario no puede superar 1600 caracteres.")
});
