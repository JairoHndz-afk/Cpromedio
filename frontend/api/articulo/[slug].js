import {
  absoluteUrl,
  fetchArticleBySlug,
  normalizeBackendOrigin,
  renderShareDocument,
  resolveCoverImage,
  resolveSiteOrigin
} from "../_lib/article-share.js";

export default async function handler(req, res) {
  try {
    const backendOrigin = normalizeBackendOrigin();
    const siteOrigin = resolveSiteOrigin(req);
    const slug = String(Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug ?? "").trim();

    if (!slug) {
      res.status(400).send("Falta el articulo solicitado.");
      return;
    }

    const article = await fetchArticleBySlug(slug, backendOrigin);

    if (!article) {
      res.writeHead(302, {
        Location: absoluteUrl(`/articulo/${slug}`, siteOrigin)
      });
      res.end();
      return;
    }

    const canonicalUrl = absoluteUrl(`/articulo/${article.slug}`, siteOrigin);
    const requestUrl = canonicalUrl;
    const imageUrl = resolveCoverImage(article, siteOrigin);
    const html = renderShareDocument({
      article,
      siteOrigin,
      requestUrl,
      canonicalUrl,
      imageUrl,
      redirectToCanonical: false
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(html);
  } catch (error) {
    const fallbackOrigin = (() => {
      try {
        return resolveSiteOrigin(req);
      } catch {
        return "https://www.colombianopromedio.co";
      }
    })();
    const slug = String(Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug ?? "").trim();
    const target = absoluteUrl(`/articulo/${slug}`, fallbackOrigin);

    if (error instanceof Error) {
      console.error("No fue posible construir la vista social del articulo.");
      console.error(error);
    }

    res.writeHead(302, {
      Location: target
    });
    res.end();
  }
}
