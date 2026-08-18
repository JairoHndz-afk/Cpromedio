import { z } from "zod";

export const publicCommentInputSchema = z.object({
  authorName: z.string().max(80, "El nombre no puede superar 80 caracteres.").optional().default(""),
  body: z.string().min(8, "El comentario debe tener al menos 8 caracteres.").max(1600, "El comentario no puede superar 1600 caracteres.")
});

export const commentReactionSchema = z.object({
  reaction: z.enum(["like", "dislike"])
});

export const commentModerationSchema = z.object({
  action: z.enum(["approve", "hide", "feature", "unfeature", "reject"]),
  note: z.string().max(240, "La nota de moderación no puede superar 240 caracteres.").optional().default("")
});
