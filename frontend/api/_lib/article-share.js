function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeBackendOrigin() {
  const rawValue = String(process.env.BACKEND_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");

  if (!rawValue) {
    throw new Error("BACKEND_PUBLIC_URL no esta configurada en Vercel.");
  }

  return rawValue;
}

function resolveSiteOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "https").trim() || "https";
  const forwardedHost = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").trim();

  if (!forwardedHost) {
    throw new Error("No fue posible resolver el dominio publico.");
  }

  return `${forwardedProto}://${forwardedHost}`;
}

function absoluteUrl(pathname, origin) {
  return new URL(pathname, `${origin}/`).toString();
}

function resolveCoverImage(article, origin) {
  const rawValue = String(article?.cover?.url ?? "").trim();

  if (!rawValue) {
    return absoluteUrl("/assets/branding/logo-c-light.png", origin);
  }

  try {
    return new URL(rawValue, `${origin}/`).toString();
  } catch {
    return absoluteUrl("/assets/branding/logo-c-light.png", origin);
  }
}

function resolveSocialImage(imageUrl) {
  if (!imageUrl) {
    return imageUrl;
  }

  try {
    const url = new URL(imageUrl);

    if (url.hostname !== "res.cloudinary.com" || !url.pathname.includes("/image/upload/")) {
      return imageUrl;
    }

    url.pathname = url.pathname.replace(
      "/image/upload/",
      "/image/upload/f_jpg,q_auto,c_limit,w_1200/"
    );

    return url.toString();
  } catch {
    return imageUrl;
  }
}

async function fetchArticleBySlug(slug, backendOrigin) {
  const upstreamUrl = `${backendOrigin}/api/public/articles/${encodeURIComponent(slug)}`;
  const upstreamResponse = await fetch(upstreamUrl, {
    headers: {
      accept: "application/json"
    }
  });

  if (!upstreamResponse.ok) {
    return null;
  }

  const payload = await upstreamResponse.json();
  const article = payload?.article;

  if (!article?.slug || !article?.title) {
    return null;
  }

  return article;
}

function renderShareDocument({
  article,
  siteOrigin,
  requestUrl,
  canonicalUrl,
  imageUrl,
  redirectToCanonical = false
}) {
  const title = `${article.title} | Colombiano Promedio`;
  const description = String(article.subtitle || article.excerpt || "Lectura editorial de Colombiano Promedio.").trim();
  const publishedTime = article.publishedAt ? new Date(article.publishedAt).toISOString() : "";
  const updatedTime = article.updatedAt ? new Date(article.updatedAt).toISOString() : publishedTime;
  const authorName = String(article.author?.name ?? "Colombiano Promedio").trim();
  const socialImageUrl = resolveSocialImage(imageUrl);
  const redirectMarkup = redirectToCanonical
    ? `
    <meta http-equiv="refresh" content="0; url=${escapeHtml(canonicalUrl)}" />
    <script>
      window.location.replace(${JSON.stringify(canonicalUrl)});
    </script>`
    : "";
  const helpLine = redirectToCanonical
    ? "Si no eres redirigido automaticamente, abre la nota aqui:"
    : "Abre la nota aqui:";

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:locale" content="es_CO" />
    <meta property="og:site_name" content="Colombiano Promedio" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(socialImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(socialImageUrl)}" />
    <meta property="og:image:alt" content="${escapeHtml(article.cover?.alt || article.title)}" />
    <meta property="article:author" content="${escapeHtml(authorName)}" />
    ${publishedTime ? `<meta property="article:published_time" content="${escapeHtml(publishedTime)}" />` : ""}
    ${updatedTime ? `<meta property="article:modified_time" content="${escapeHtml(updatedTime)}" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(article.cover?.alt || article.title)}" />${redirectMarkup}
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at top, rgba(248, 196, 0, 0.18), transparent 28%),
          radial-gradient(circle at right, rgba(21, 72, 167, 0.24), transparent 32%),
          linear-gradient(180deg, #07101d, #0e1728);
        color: #f8fbff;
      }
      main {
        width: min(100%, 620px);
        padding: 28px;
        border-radius: 28px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(8, 18, 35, 0.84);
        box-shadow: 0 32px 80px rgba(0,0,0,0.32);
      }
      p {
        margin: 0 0 12px;
        line-height: 1.6;
        color: #dbe7fb;
      }
      a {
        color: #f8c400;
        font-weight: 700;
      }
      .eyebrow {
        color: #8faef7;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 14px;
        font-size: clamp(2rem, 4vw, 2.8rem);
        line-height: 1.02;
        font-family: Georgia, "Times New Roman", serif;
      }
      small {
        color: #b8c7df;
      }
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Compartiendo articulo</p>
      <h1>${escapeHtml(article.title)}</h1>
      <p>${escapeHtml(description)}</p>
      <p>${helpLine} <a href="${escapeHtml(canonicalUrl)}">${escapeHtml(canonicalUrl)}</a></p>
      <p><small>Solicitud: ${escapeHtml(requestUrl)}</small></p>
      <p><small>Colombiano Promedio · ${escapeHtml(siteOrigin)}</small></p>
    </main>
  </body>
</html>`;
}

export {
  absoluteUrl,
  fetchArticleBySlug,
  normalizeBackendOrigin,
  renderShareDocument,
  resolveCoverImage,
  resolveSocialImage,
  resolveSiteOrigin
};
