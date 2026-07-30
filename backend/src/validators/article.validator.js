import { z } from "zod";

import { isOwnedMediaUrl, resolveVideoEmbedSource } from "../utils/content.js";

const articleStatusSchema = z.enum(["draft", "review", "changes_requested", "approved", "published", "archived", "rejected"]);
const editorialMediaMessage = "Las imagenes editoriales y las portadas deben salir de infraestructura controlada.";
const editorialEmbedMessage = "Solo se aceptan enlaces de YouTube, Vimeo, X/Twitter o Instagram.";

const articleImageSchema = z.object({
  url: z
    .string()
    .max(1200, "La URL de la imagen no puede superar 1200 caracteres.")
    .refine((value) => isOwnedMediaUrl(value), editorialMediaMessage),
  alt: z.string().max(140, "El texto alternativo no puede superar 140 caracteres.").optional().default(""),
  caption: z.string().max(220, "La leyenda no puede superar 220 caracteres.").optional().default("")
});

const articleEmbedSchema = z.object({
  url: z
    .string()
    .max(1200, "La URL del contenido multimedia no puede superar 1200 caracteres.")
    .refine((value) => Boolean(resolveVideoEmbedSource(value)), editorialEmbedMessage),
  provider: z.enum(["youtube", "vimeo", "twitter", "instagram"]).optional(),
  title: z.string().max(160, "El titulo del embed no puede superar 160 caracteres.").optional().default("")
});

const articleContentBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    heading: z.object({
      text: z.string().min(1, "Cada encabezado debe incluir contenido.").max(4000, "Cada encabezado no puede superar 4000 caracteres."),
      align: z.enum(["left", "center", "right"]).optional().default("left"),
      level: z.enum(["h2", "h3"]).optional().default("h2")
    })
  }),
  z.object({
    type: z.literal("paragraph"),
    text: z.string().min(1, "Cada parrafo debe incluir contenido.").max(4000, "Cada parrafo no puede superar 4000 caracteres.")
  }),
  z.object({
    type: z.literal("quote"),
    quote: z.object({
      text: z.string().min(1, "Cada cita debe incluir contenido.").max(1200, "Cada cita no puede superar 1200 caracteres."),
      attribution: z.string().max(140, "La fuente de la cita no puede superar 140 caracteres.").optional().default("")
    })
  }),
  z.object({
    type: z.literal("image"),
    image: articleImageSchema
  }),
  z.object({
    type: z.literal("embed"),
    embed: articleEmbedSchema
  })
]);

export const articleInputSchema = z
  .object({
    title: z.string().min(6, "El titulo debe tener al menos 6 caracteres.").max(180, "El titulo no puede superar 180 caracteres."),
    subtitle: z.string().max(220, "El subtitulo no puede superar 220 caracteres.").optional().default(""),
    excerpt: z.string().max(320, "El extracto no puede superar 320 caracteres.").optional().default(""),
    body: z.union([z.array(z.string().min(1)), z.string().min(1)]).optional(),
    contentBlocks: z.array(articleContentBlockSchema).max(120, "El articulo no puede superar 120 bloques.").optional().default([]),
    cover: z
      .object({
        url: z
          .string()
          .max(1200, "La URL de la portada no puede superar 1200 caracteres.")
          .optional()
          .or(z.literal(""))
          .default("")
          .refine((value) => value === "" || isOwnedMediaUrl(value), editorialMediaMessage),
        alt: z.string().max(140, "El texto alternativo de la portada no puede superar 140 caracteres.").optional().default(""),
        positionX: z.coerce.number().min(0, "La posicion horizontal debe estar entre 0 y 100.").max(100, "La posicion horizontal debe estar entre 0 y 100.").optional().default(50),
        positionY: z.coerce.number().min(0, "La posicion vertical debe estar entre 0 y 100.").max(100, "La posicion vertical debe estar entre 0 y 100.").optional().default(50),
        type: z.enum(["image", "video", "audio", "infographic"]).optional().default("image")
      })
      .optional()
      .default({ url: "", alt: "", positionX: 50, positionY: 50, type: "image" }),
    categoryId: z.string().optional().nullable(),
    tags: z.array(z.string().max(40, "Cada etiqueta no puede superar 40 caracteres.")).optional().default([]),
    isPremium: z.boolean().optional().default(false),
    featured: z.boolean().optional().default(false),
    status: articleStatusSchema.optional().default("draft")
  })
  .refine((value) => Boolean(value.body) || value.contentBlocks.length > 0, {
    message: "Agrega al menos un bloque de contenido al articulo.",
    path: ["contentBlocks"]
  });

export const moderationSchema = z.object({
  action: z.enum(["approve", "request_changes", "publish", "archive", "reject", "feature", "unfeature"]),
  note: z.string().max(400, "La nota editorial no puede superar 400 caracteres.").optional().default("")
});
