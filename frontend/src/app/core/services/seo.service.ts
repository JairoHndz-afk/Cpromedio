import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";
import { Meta, Title } from "@angular/platform-browser";

interface SeoArticlePayload {
  title: string;
  description: string;
  slug: string;
  imageUrl?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  authorName?: string;
  authorId?: string;
  categoryName?: string;
  tags?: string[];
  isPremium?: boolean;
}

interface SeoAuthorPayload {
  name: string;
  description: string;
  authorId: string;
}

@Injectable({ providedIn: "root" })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  setHome(payload: { title?: string; description?: string; imageUrl?: string } = {}): void {
    const title = payload.title?.trim() || "Colombiano Promedio | Noticias de Colombia, politica, poder y regiones";
    const description =
      payload.description?.trim() ||
      "Noticias de Colombia, politica, poder regional, justicia y opinion en Colombiano Promedio. Periodismo independiente con contexto y archivo editorial propio.";
    const url = this.absoluteUrl("/");
    const imageUrl = this.toAbsoluteMediaUrl(payload.imageUrl) || this.siteLogoUrl();

    this.applyCommonMeta({
      title,
      description,
      url,
      imageUrl,
      type: "website",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });
    this.clearArticleMeta();

    this.setJsonLd([
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${url}#organization`,
        name: "Colombiano Promedio",
        alternateName: "ColombianoPromedio",
        url,
        logo: {
          "@type": "ImageObject",
          url: this.siteLogoUrl()
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": `${url}#website`,
        url,
        name: "Colombiano Promedio",
        alternateName: "ColombianoPromedio",
        description,
        inLanguage: "es-CO",
        publisher: {
          "@id": `${url}#organization`
        },
        image: imageUrl
      }
    ]);
  }

  setArticle(payload: SeoArticlePayload): void {
    const description = payload.description.trim() || "Noticias, analisis y contexto editorial de Colombiano Promedio.";
    const url = this.absoluteUrl(`/articulo/${payload.slug}`);
    const imageUrl = this.toAbsoluteMediaUrl(payload.imageUrl);
    const rootUrl = this.absoluteUrl("/");

    this.applyCommonMeta({
      title: `${payload.title} | Colombiano Promedio`,
      description,
      url,
      imageUrl,
      type: "article",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });
    this.applyArticleMeta(payload);

    this.setJsonLd({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "@id": `${url}#article`,
      headline: payload.title,
      description,
      url,
      inLanguage: "es-CO",
      image: imageUrl ? [imageUrl] : undefined,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": url
      },
      datePublished: payload.publishedAt || undefined,
      dateModified: payload.updatedAt || payload.publishedAt || undefined,
      articleSection: payload.categoryName || undefined,
      keywords: payload.tags?.filter(Boolean).join(", ") || undefined,
      isAccessibleForFree: payload.isPremium === undefined ? undefined : !payload.isPremium,
      author: payload.authorName
        ? {
            "@type": "Person",
            name: payload.authorName,
            url: payload.authorId ? this.absoluteUrl(`/autor/${payload.authorId}`) : undefined
          }
        : undefined,
      isPartOf: {
        "@id": `${rootUrl}#website`
      },
      publisher: {
        "@type": "Organization",
        "@id": `${rootUrl}#organization`,
        name: "Colombiano Promedio",
        url: rootUrl,
        logo: {
          "@type": "ImageObject",
          url: this.siteLogoUrl()
        }
      }
    });
  }

  setArticleFallback(payload: { slug?: string; title?: string; description?: string } = {}): void {
    const slug = payload.slug?.trim();
    const description = payload.description?.trim() || "Lectura editorial de Colombiano Promedio.";
    const url = slug ? this.absoluteUrl(`/articulo/${slug}`) : this.absoluteUrl("/");

    this.applyCommonMeta({
      title: payload.title?.trim() || "Articulo | Colombiano Promedio",
      description,
      url,
      type: "article",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });
    this.clearArticleMeta();
    this.clearJsonLd();
  }

  setAuthor(payload: SeoAuthorPayload): void {
    const url = this.absoluteUrl(`/autor/${payload.authorId}`);

    this.applyCommonMeta({
      title: `${payload.name} | Archivo de autor | Colombiano Promedio`,
      description: payload.description,
      url,
      type: "profile",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });
    this.clearArticleMeta();

    this.setJsonLd({
      "@context": "https://schema.org",
      "@type": "Person",
      name: payload.name,
      url
    });
  }

  setAuthorFallback(payload: { authorId: string; title?: string; description?: string }): void {
    const url = this.absoluteUrl(`/autor/${payload.authorId}`);

    this.applyCommonMeta({
      title: payload.title?.trim() || "Archivo de autor | Colombiano Promedio",
      description: payload.description?.trim() || "Archivo publico de autores y publicaciones de Colombiano Promedio.",
      url,
      type: "profile",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });
    this.clearArticleMeta();
    this.clearJsonLd();
  }

  setArchive(payload: { page?: number; description?: string } = {}): void {
    const page = Math.max(Number(payload.page ?? 1), 1);
    const description =
      payload.description?.trim() ||
      "Archivo de noticias, politica, opinion y analisis de Colombiano Promedio, ordenado de la mas reciente a la mas antigua.";
    const title = page > 1 ? `Archivo de noticias | Página ${page} | Colombiano Promedio` : "Archivo de noticias | Colombiano Promedio";
    const url = page > 1 ? this.absoluteUrl(`/archivo?page=${page}`) : this.absoluteUrl("/archivo");

    this.applyCommonMeta({
      title,
      description,
      url,
      type: "website",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });
    this.clearArticleMeta();

    this.setJsonLd({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Archivo de noticias",
      description,
      url,
      inLanguage: "es-CO",
      isPartOf: {
        "@type": "WebSite",
        name: "Colombiano Promedio",
        url: this.absoluteUrl("/")
      }
    });
  }

  setNoIndex(title: string, description: string): void {
    const url = this.absoluteUrl(this.document.location.pathname + this.document.location.search);

    this.applyCommonMeta({
      title,
      description,
      url,
      type: "website",
      robots: "noindex,nofollow,noarchive"
    });
    this.clearArticleMeta();
    this.clearJsonLd();
  }

  private applyCommonMeta(payload: {
    title: string;
    description: string;
    url: string;
    type: string;
    robots: string;
    imageUrl?: string;
  }): void {
    const imageUrl = this.toAbsoluteMediaUrl(payload.imageUrl) || this.absoluteUrl("/assets/branding/logo-c-light.png");

    this.title.setTitle(payload.title);
    this.updateNameTag("description", payload.description);
    this.updateNameTag("robots", payload.robots);
    this.updatePropertyTag("og:locale", "es_CO");
    this.updatePropertyTag("og:site_name", "Colombiano Promedio");
    this.updatePropertyTag("og:type", payload.type);
    this.updatePropertyTag("og:title", payload.title);
    this.updatePropertyTag("og:description", payload.description);
    this.updatePropertyTag("og:url", payload.url);
    this.updatePropertyTag("og:image", imageUrl);
    this.updateNameTag("twitter:card", "summary_large_image");
    this.updateNameTag("twitter:title", payload.title);
    this.updateNameTag("twitter:description", payload.description);
    this.updateNameTag("twitter:image", imageUrl);
    this.setCanonical(payload.url);
  }

  private updateNameTag(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private updatePropertyTag(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private updateOptionalPropertyTag(property: string, content?: string | null): void {
    const normalized = content?.trim();

    if (normalized) {
      this.updatePropertyTag(property, normalized);
      return;
    }

    this.meta.removeTag(`property='${property}'`);
  }

  private applyArticleMeta(payload: SeoArticlePayload): void {
    this.updateOptionalPropertyTag("article:published_time", payload.publishedAt);
    this.updateOptionalPropertyTag("article:modified_time", payload.updatedAt || payload.publishedAt);
    this.updateOptionalPropertyTag("article:author", payload.authorName);
    this.updateOptionalPropertyTag("article:section", payload.categoryName);
  }

  private clearArticleMeta(): void {
    this.meta.removeTag("property='article:published_time'");
    this.meta.removeTag("property='article:modified_time'");
    this.meta.removeTag("property='article:author'");
    this.meta.removeTag("property='article:section'");
  }

  private setCanonical(url: string): void {
    let canonical = this.document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;

    if (!canonical) {
      canonical = this.document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      this.document.head.appendChild(canonical);
    }

    canonical.setAttribute("href", url);
  }

  private setJsonLd(data: Record<string, unknown> | Array<Record<string, unknown>>): void {
    this.clearJsonLd();

    const script = this.document.createElement("script");
    script.type = "application/ld+json";
    script.id = "cp-jsonld";
    script.text = JSON.stringify(data);
    this.document.head.appendChild(script);
  }

  private clearJsonLd(): void {
    this.document.getElementById("cp-jsonld")?.remove();
  }

  private siteLogoUrl(): string {
    return this.absoluteUrl("/assets/branding/logo-c-light.png");
  }

  private absoluteUrl(pathname: string): string {
    return new URL(pathname, this.document.location.origin).toString();
  }

  private toAbsoluteMediaUrl(value?: string): string {
    if (!value?.trim()) {
      return "";
    }

    try {
      return new URL(value, this.document.location.origin).toString();
    } catch {
      return "";
    }
  }
}
