import assert from "node:assert/strict";
import test from "node:test";

import { env } from "../../src/config/env.js";
import { isOwnedMediaUrl, sanitizeContentBlocks, sanitizeOwnedMediaUrl } from "../../src/utils/content.js";
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
