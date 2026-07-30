import assert from "node:assert/strict";
import test from "node:test";

import { env } from "../../src/config/env.js";
import { isOwnedMediaUrl, sanitizeContentBlocks, sanitizeEditorialMediaUrl, sanitizeOwnedMediaUrl } from "../../src/utils/content.js";
import { articleInputSchema } from "../../src/validators/article.validator.js";

const allowedUploadUrl = `${env.publicServerUrl}/uploads/news/2026/07/portada-segura.webp`;

test("rechaza URLs externas arbitrarias para portadas e imagenes editoriales", () => {
  assert.throws(
    () =>
      articleInputSchema.parse({
        title: "Titular de seguridad valido",
        subtitle: "Subtitulo breve",
        excerpt: "Resumen breve de seguridad editorial.",
        cover: {
          url: "https://tracker.evil.example/pixel.png",
          alt: "Portada remota"
        },
        contentBlocks: [
          {
            type: "paragraph",
            text: "Contenido suficiente para que la validacion no falle por ausencia de cuerpo."
          }
        ]
      }),
    /infraestructura controlada/i
  );

  assert.throws(
    () =>
      articleInputSchema.parse({
        title: "Titular de seguridad valido",
        subtitle: "Subtitulo breve",
        excerpt: "Resumen breve de seguridad editorial.",
        contentBlocks: [
          {
            type: "paragraph",
            text: "Primer parrafo seguro."
          },
          {
            type: "image",
            image: {
              url: "https://tracker.evil.example/inline.png",
              alt: "Imagen remota"
            }
          }
        ]
      }),
    /infraestructura controlada/i
  );
});

test("acepta uploads propios y sanea medios remotos ya almacenados", () => {
  assert.equal(isOwnedMediaUrl(allowedUploadUrl), true);
  assert.equal(sanitizeOwnedMediaUrl("https://tracker.evil.example/pixel.png"), "");

  const { blocks } = sanitizeContentBlocks([
    {
      type: "paragraph",
      text: "Texto seguro del cuerpo."
    },
    {
      type: "image",
      image: {
        url: "https://tracker.evil.example/pixel.png",
        alt: "Spy pixel"
      }
    },
    {
      type: "image",
      image: {
        url: allowedUploadUrl,
        alt: "Imagen segura"
      }
    }
  ]);

  assert.equal(blocks.length, 2);
  assert.deepEqual(
    blocks.map((block) => block.type),
    ["paragraph", "image"]
  );
  assert.equal(blocks[1].image.url, allowedUploadUrl);
});

test("acepta embeds de X/Twitter y sigue rechazando proveedores arbitrarios", () => {
  const parsed = articleInputSchema.parse({
    title: "Titular con publicacion embebida",
    subtitle: "Subtitulo breve",
    excerpt: "Resumen breve con una publicacion de red social incrustada.",
    contentBlocks: [
      {
        type: "paragraph",
        text: "Contexto suficiente para la nota."
      },
      {
        type: "embed",
        embed: {
          url: "https://x.com/OpenAI/status/1949865123456789012",
          title: "Mensaje incrustado"
        }
      }
    ]
  });

  assert.equal(parsed.contentBlocks[1].type, "embed");

  const { blocks } = sanitizeContentBlocks(parsed.contentBlocks);
  assert.equal(blocks[1].type, "embed");
  assert.equal(blocks[1].embed.provider, "twitter");
  assert.equal(blocks[1].embed.url, "https://twitter.com/OpenAI/status/1949865123456789012");

  const instagramParsed = articleInputSchema.parse({
    title: "Titular con post de Instagram",
    subtitle: "Subtitulo breve",
    excerpt: "Resumen breve con una publicacion de Instagram incrustada.",
    contentBlocks: [
      {
        type: "paragraph",
        text: "Contexto suficiente para la nota."
      },
      {
        type: "embed",
        embed: {
          url: "https://www.instagram.com/p/DMj4R8at9Q1/",
          title: "Post incrustado"
        }
      }
    ]
  });

  const instagramSanitized = sanitizeContentBlocks(instagramParsed.contentBlocks);
  assert.equal(instagramSanitized.blocks[1].type, "embed");
  assert.equal(instagramSanitized.blocks[1].embed.provider, "instagram");
  assert.equal(instagramSanitized.blocks[1].embed.url, "https://www.instagram.com/p/DMj4R8at9Q1/");

  assert.throws(
    () =>
      articleInputSchema.parse({
        title: "Titular con embed invalido",
        subtitle: "Subtitulo breve",
        excerpt: "Resumen breve con embed de origen no permitido.",
        contentBlocks: [
          {
            type: "paragraph",
            text: "Primer parrafo seguro."
          },
          {
            type: "embed",
            embed: {
              url: "https://evil.example/social/post/123456",
              title: "Fuente no valida"
            }
          }
        ]
      }),
    /youtube, vimeo, x\/twitter o instagram/i
  );
});

test("acepta assets de Cloudinary del cloud configurado y rechaza clouds ajenos", (t) => {
  const originalCloudinaryCloudName = env.cloudinaryCloudName;
  const originalCloudinaryConfigured = env.cloudinaryConfigured;
  const allowedCloudinaryUrl =
    "https://res.cloudinary.com/wbvvnw52/image/upload/f_auto,q_auto/v1785003138/colombiano-promedio/news/2026/07/portada-segura.webp";
  const rejectedCloudinaryUrl =
    "https://res.cloudinary.com/otro-cloud/image/upload/v1785003138/colombiano-promedio/news/2026/07/portada-segura.webp";

  env.cloudinaryCloudName = "wbvvnw52";
  env.cloudinaryConfigured = true;

  t.after(() => {
    env.cloudinaryCloudName = originalCloudinaryCloudName;
    env.cloudinaryConfigured = originalCloudinaryConfigured;
  });

  assert.equal(isOwnedMediaUrl(allowedCloudinaryUrl), true);
  assert.equal(sanitizeOwnedMediaUrl(allowedCloudinaryUrl), allowedCloudinaryUrl);
  assert.equal(sanitizeOwnedMediaUrl(rejectedCloudinaryUrl), "");
});

test("rechaza rutas relativas con traversal aunque aparenten salir de /uploads/news", () => {
  assert.equal(sanitizeOwnedMediaUrl("/uploads/news/../../api/auth/me"), "");
  assert.equal(sanitizeOwnedMediaUrl(`${env.publicServerUrl}/uploads/news/../../api/auth/me`), "");
  assert.equal(sanitizeOwnedMediaUrl("/uploads/news/2026/07/../08/portada.webp"), "/uploads/news/2026/08/portada.webp");
});

test("solo conserva medios externos cuando el host pertenece a una fuente aliada autorizada", () => {
  const allowedUrl = "https://cdn.medio-aliado.co/imagenes/portada-principal.webp";
  const blockedUrl = "https://cdn.intruso.example/imagenes/portada-principal.webp";

  assert.equal(
    sanitizeEditorialMediaUrl(allowedUrl, {
      allowedExternalHosts: ["cdn.medio-aliado.co", "imagenes.medio-aliado.co"]
    }),
    allowedUrl
  );
  assert.equal(
    sanitizeEditorialMediaUrl(blockedUrl, {
      allowedExternalHosts: ["cdn.medio-aliado.co", "imagenes.medio-aliado.co"]
    }),
    ""
  );

  const { blocks } = sanitizeContentBlocks(
    [
      {
        type: "paragraph",
        text: "Contenido sindicado seguro."
      },
      {
        type: "image",
        image: {
          url: allowedUrl,
          alt: "Imagen aliada"
        }
      },
      {
        type: "image",
        image: {
          url: blockedUrl,
          alt: "Imagen intrusa"
        }
      }
    ],
    {
      allowedExternalHosts: ["cdn.medio-aliado.co"]
    }
  );

  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].type, "image");
  assert.equal(blocks[1].image.url, allowedUrl);
});
