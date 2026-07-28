import bcrypt from "bcryptjs";

import { env } from "../config/env.js";
import { repairFeaturedArticleSelection } from "../lib/site-settings.js";
import { Article } from "../models/Article.js";
import { User } from "../models/User.js";
import { calculateReadingTime, paragraphBlocksFromBody, sanitizeText } from "./content.js";

async function upsertBootstrapUser({ name, email, password, role }) {
  const existing = await User.findOne({ email });

  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  return User.create({
    name,
    email,
    passwordHash,
    role,
    status: "active"
  });
}

async function repairLegacyArticles() {
  const legacyArticles = await Article.find({
    $or: [
      { contentBlocks: { $exists: false } },
      { contentBlocks: { $size: 0 } }
    ]
  }).select("_id title subtitle excerpt body contentBlocks readingTime");

  let repaired = 0;

  for (const article of legacyArticles) {
    const contentBlocks = paragraphBlocksFromBody(article.body ?? []);

    if (contentBlocks.length === 0) {
      continue;
    }

    const body = contentBlocks
      .filter((block) => block.type === "paragraph")
      .map((block) => block.text)
      .filter(Boolean);

    const excerptSource =
      sanitizeText(article.excerpt ?? "", 320)
      || body[0]
      || sanitizeText(`${article.subtitle ?? ""} ${article.title ?? ""}`, 320)
      || sanitizeText(`${article.title ?? ""} Cobertura editorial en desarrollo.`, 320);

    await Article.updateOne(
      { _id: article._id },
      {
        $set: {
          body,
          contentBlocks,
          excerpt: excerptSource,
          readingTime: calculateReadingTime(body)
        }
      }
    );

    repaired += 1;
  }

  if (repaired > 0) {
    console.log(`Artículos reparados: ${repaired}`);
  }
}

export async function ensureBootstrapUsers(options = {}) {
  const { force = false, seedStarterContent = true } = options;
  const shouldBootstrapUsers = force || env.bootstrapOnStart;

  await repairLegacyArticles();
  await repairFeaturedArticleSelection();

  if (!shouldBootstrapUsers) {
    return;
  }

  await upsertBootstrapUser({
    ...env.bootstrapAdmin,
    role: "admin"
  });

  const journalist = await upsertBootstrapUser({
    ...env.bootstrapJournalist,
    role: "journalist"
  });

  if (!seedStarterContent) {
    return;
  }

  const existingArticles = await Article.countDocuments({});
  if (existingArticles > 0) {
    return;
  }

  const starterParagraphs = [
    "Colombiano Promedio arranca con una edición base para que portada, detalle y búsqueda tengan contenido real desde el primer arranque.",
    "Desde aquí, el admin puede moderar y publicar nuevas piezas, mientras los periodistas redactan y envían artículos a revisión con la consigna de que la dignidad se haga costumbre."
  ];

  await Article.create({
    title: "Edición inicial de Colombiano Promedio",
    slug: "edicion-inicial-de-colombiano-promedio",
    subtitle: "Base editorial protegida, identidad renovada y panel listo para producción.",
    excerpt: "Esta publicación de arranque permite validar portada, lectura pública y moderación bajo la nueva identidad del medio.",
    body: starterParagraphs,
    contentBlocks: starterParagraphs.map((text) => ({
      type: "paragraph",
      text
    })),
    author: journalist._id,
    status: "published",
    featured: true,
    isPremium: false,
    readingTime: 1,
    publishedAt: new Date(),
    seo: {
      title: "Edición inicial de Colombiano Promedio",
      description: "Artículo de arranque para validar portada, identidad y flujo editorial."
    },
    moderationHistory: [
      {
        actor: journalist._id,
        role: "journalist",
        action: "created",
        note: ""
      },
      {
        actor: journalist._id,
        role: "journalist",
        action: "submitted",
        note: ""
      }
    ]
  });

  await repairFeaturedArticleSelection();
}
