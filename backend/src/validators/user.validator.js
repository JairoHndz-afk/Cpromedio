import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10)
  .max(120)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, "La contraseña debe incluir mayúscula, minúscula, número y símbolo.");

export const userCreateSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: passwordSchema,
  role: z.enum(["admin", "journalist"]),
  status: z.enum(["active", "blocked", "disabled"]).optional().default("active")
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  password: passwordSchema.optional(),
  role: z.enum(["admin", "journalist"]).optional(),
  status: z.enum(["active", "blocked", "disabled"]).optional()
});

export const subscriptionUpdateSchema = z.object({
  status: z.enum(["pending", "active", "paused", "cancelled"])
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(80)
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1),
    nextPassword: passwordSchema,
    confirmPassword: z.string().min(1)
  })
  .refine((value) => value.nextPassword === value.confirmPassword, {
    message: "La confirmación no coincide con la nueva contraseña.",
    path: ["confirmPassword"]
  });
