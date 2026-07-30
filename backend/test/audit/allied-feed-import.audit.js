import assert from "node:assert/strict";
import test from "node:test";

import { syncAlliedFeedSourceNow } from "../../src/controllers/dashboard.controller.js";
import { AuditLog } from "../../src/models/AuditLog.js";
import { AlliedFeedSource } from "../../src/models/AlliedFeedSource.js";
import { Article } from "../../src/models/Article.js";

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

function createMockRequest(overrides = {}) {
  return {
    params: {},
    body: {},
    headers: {
      "user-agent": "node-test"
    },
    ip: "127.0.0.1",
    user: {
      _id: "admin-2026",
      email: "admin@colombianopromedio.co",
      role: "admin"
    },
    ...overrides
  };
}

function createObjectId(value) {
  return {
    toString() {
      return value;
    }
  };
}

test("audita que una sincronizacion RSS aliada complete la nota original cuando el feed solo trae un teaser", async (t) => {
  const originalFetch = global.fetch;
  const originalFindById = AlliedFeedSource.findById;
  const originalArticleFindOne = Article.findOne;
  const originalArticleCreate = Article.create;
  const originalAuditCreate = AuditLog.create;

  const source = {
    _id: createObjectId("feed-1"),
    name: "Medio Aliado",
    feedUrl: "https://medio-aliado.co/feed/",
    siteUrl: "https://medio-aliado.co/",
    attributionLabel: "Medio aliado autorizado",
    allowedMediaHosts: ["cdn.medio-aliado.co"],
    defaultTags: ["aliado"],
    defaultCategory: null,
    importMode: "draft",
    maxItemsPerSync: 5,
    isActive: true,
    lastFetchedAt: null,
    lastImportedAt: null,
    lastImportCount: 0,
    lastSkippedCount: 0,
    lastError: "",
    async save() {
      return this;
    }
  };

  const createdArticles = [];
  const updatedArticles = [];
  const seenDedupeValues = [];
  const existingArticle = {
    _id: createObjectId("existing-1"),
    title: "Nota duplicada",
    excerpt: "Teaser viejo",
    body: ["Teaser viejo"],
    contentBlocks: [],
    cover: {
      type: "image",
      url: "https://cdn.medio-aliado.co/imagenes/vieja.webp",
      alt: "Vieja"
    },
    tags: ["aliado"],
    readingTime: 1,
    publishedAt: new Date("2026-07-29T08:00:00.000Z"),
    status: "published",
    moderationHistory: [],
    seo: {
      title: "Nota duplicada",
      description: "Teaser viejo"
    },
    syndication: {
      sourceType: "allied_rss",
      feedSource: source._id,
      sourceName: source.name,
      sourceUrl: source.feedUrl,
      originalUrl: "https://medio-aliado.co/nota-duplicada",
      originalGuid: "nota-duplicada-guid",
      authorName: "",
      attributionLabel: source.attributionLabel,
      allowExternalMedia: true,
      allowedMediaHosts: ["cdn.medio-aliado.co"],
      importedAt: new Date("2026-07-29T08:00:00.000Z")
    },
    async save() {
      updatedArticles.push({
        title: this.title,
        excerpt: this.excerpt,
        body: [...this.body],
        contentBlocks: this.contentBlocks.map((block) => ({ ...block })),
        cover: { ...this.cover },
        tags: [...this.tags],
        readingTime: this.readingTime,
        syndication: { ...this.syndication }
      });
      return this;
    }
  };

  global.fetch = async (url) => {
    if (String(url).includes("/feed/")) {
      return {
        ok: true,
        async text() {
          return `<?xml version="1.0" encoding="UTF-8"?>
          <rss version="2.0">
            <channel>
              <title>Medio aliado</title>
              <item>
                <title>Nota nueva importada</title>
                <link>https://medio-aliado.co/nota-nueva</link>
                <guid>nota-nueva-guid</guid>
                <category>Actualidad</category>
                <pubDate>Wed, 29 Jul 2026 10:00:00 GMT</pubDate>
                <description><![CDATA[
                  <p>La Camara aprobo trasladar a Cali la posesion.</p>
                ]]></description>
              </item>
              <item>
                <title>Nota duplicada</title>
                <link>https://medio-aliado.co/nota-duplicada</link>
                <guid>nota-duplicada-guid</guid>
                <description><![CDATA[
                  <p>Esta nota ya existia antes de la sincronizacion.</p>
                ]]></description>
              </item>
            </channel>
          </rss>`;
        }
      };
    }

    if (String(url) === "https://medio-aliado.co/nota-nueva") {
      return {
        ok: true,
        async text() {
          return `<!doctype html>
          <html lang="es">
            <head>
              <title>Nota nueva importada</title>
              <meta property="og:title" content="Nota nueva importada" />
              <meta property="og:description" content="Resumen completo recuperado desde la nota original." />
              <meta property="og:image" content="https://cdn.medio-aliado.co/imagenes/nota-nueva.webp" />
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "NewsArticle",
                  "headline": "Nota nueva importada",
                  "description": "Resumen completo recuperado desde la nota original.",
                  "articleBody": "Primer parrafo importado desde la pagina original. Segundo parrafo con contexto adicional.",
                  "image": ["https://cdn.medio-aliado.co/imagenes/nota-nueva.webp"],
                  "author": { "@type": "Person", "name": "Redaccion aliada" },
                  "datePublished": "2026-07-29T10:00:00Z"
                }
              </script>
            </head>
            <body>
              <article>
                <p>Compartir</p>
                <p>Guardar</p>
                <h2>Contexto principal</h2>
                <p>Primer parrafo importado desde la pagina original.</p>
                <p>Segundo parrafo con contexto adicional.</p>
                <figure>
                  <img src="https://cdn.medio-aliado.co/imagenes/nota-nueva.webp" alt="Portada aliada" />
                </figure>
              </article>
            </body>
          </html>`;
        }
      };
    }

    if (String(url) === "https://medio-aliado.co/nota-duplicada") {
      return {
        ok: true,
        async text() {
          return `<!doctype html>
          <html lang="es">
            <head>
              <title>Nota duplicada</title>
              <meta property="og:title" content="Nota duplicada" />
              <meta property="og:description" content="La nota existente se completo otra vez con el cuerpo original." />
              <meta property="og:image" content="https://cdn.medio-aliado.co/imagenes/nota-duplicada.webp" />
              <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "NewsArticle",
                  "headline": "Nota duplicada",
                  "description": "La nota existente se completo otra vez con el cuerpo original.",
                  "articleBody": "Parrafo recuperado para una nota existente. Segundo bloque de contexto restaurado.",
                  "image": ["https://cdn.medio-aliado.co/imagenes/nota-duplicada.webp"],
                  "author": { "@type": "Person", "name": "Equipo aliado" },
                  "datePublished": "2026-07-29T11:00:00Z"
                }
              </script>
            </head>
            <body>
              <article>
                <p>Compartir</p>
                <p>Resumen</p>
                <p>Parrafo recuperado para una nota existente.</p>
                <p>Segundo bloque de contexto restaurado.</p>
              </article>
            </body>
          </html>`;
        }
      };
    }

    throw new Error(`URL no esperada en prueba: ${url}`);
  };

  AlliedFeedSource.findById = async () => source;
  AuditLog.create = async () => ({});
  Article.findOne = (query) => ({
    async select() {
      if (query?.slug) {
        return null;
      }

      const dedupeValue = query?.$or?.[0]?.["syndication.originalGuid"] ?? query?.$or?.[1]?.["syndication.originalUrl"] ?? "";
      seenDedupeValues.push(dedupeValue);

      if (dedupeValue === "nota-duplicada-guid") {
        return existingArticle;
      }

      return null;
    }
  });

  Article.create = async (payload) => {
    createdArticles.push(payload);
    return {
      _id: createObjectId(`article-${createdArticles.length}`),
      title: payload.title,
      slug: payload.slug,
      status: payload.status
    };
  };

  t.after(() => {
    global.fetch = originalFetch;
    AlliedFeedSource.findById = originalFindById;
    Article.findOne = originalArticleFindOne;
    Article.create = originalArticleCreate;
    AuditLog.create = originalAuditCreate;
  });

  const request = createMockRequest({
    params: { sourceId: "feed-1" }
  });
  const response = createMockResponse();

  await syncAlliedFeedSourceNow(request, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.result.importedCount, 1);
  assert.equal(response.payload.result.updatedCount, 1);
  assert.equal(response.payload.result.skippedCount, 0);
  assert.equal(createdArticles.length, 1);
  assert.equal(updatedArticles.length, 1);
  assert.equal(createdArticles[0].syndication.sourceType, "allied_rss");
  assert.equal(createdArticles[0].syndication.originalGuid, "nota-nueva-guid");
  assert.equal(createdArticles[0].syndication.authorName, "Redaccion aliada");
  assert.equal(createdArticles[0].cover.url, "https://cdn.medio-aliado.co/imagenes/nota-nueva.webp");
  assert.equal(createdArticles[0].contentBlocks.some((block) => block.type === "image"), false);
  assert.equal(
    createdArticles[0].contentBlocks.some((block) => block.type === "paragraph" && /pagina original/i.test(block.text)),
    true
  );
  assert.equal(
    createdArticles[0].contentBlocks.some((block) => /compartir|guardar/i.test(block.text ?? "")),
    false
  );
  assert.equal(createdArticles[0].tags.includes("actualidad"), true);
  assert.equal(createdArticles[0].tags.includes("aliado"), true);
  assert.equal(updatedArticles[0].body.some((paragraph) => /Parrafo recuperado/i.test(paragraph)), true);
  assert.equal(
    updatedArticles[0].contentBlocks.some((block) => block.type === "paragraph" && /Segundo bloque de contexto/i.test(block.text)),
    true
  );
  assert.equal(
    updatedArticles[0].contentBlocks.some((block) => /compartir|resumen/i.test(block.text ?? "")),
    false
  );
  assert.equal(updatedArticles[0].syndication.authorName, "Equipo aliado");
  assert.deepEqual(seenDedupeValues.filter(Boolean), ["nota-nueva-guid", "nota-duplicada-guid"]);
  assert.ok(source.lastFetchedAt instanceof Date);
  assert.ok(source.lastImportedAt instanceof Date);
});
