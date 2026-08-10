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
    const title = payload.title?.trim() || "Colombiano Promedio | Periodismo digital";
    const description =
      payload.description?.trim() ||
      "Colombiano Promedio: periodismo digital, archivo editorial, autores y lecturas recientes con identidad colombiana.";
    const url = this.absoluteUrl("/");

    this.applyCommonMeta({
      title,
      description,
      url,
      imageUrl: payload.imageUrl,
      type: "website",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });
    this.clearJsonLd();
  }

  setArticle(payload: SeoArticlePayload): void {
    const description = payload.description.trim() || "Lectura editorial de Colombiano Promedio.";
    const url = this.absoluteUrl(`/articulo/${payload.slug}`);
    const imageUrl = this.toAbsoluteMediaUrl(payload.imageUrl);

    this.applyCommonMeta({
      title: `${payload.title} | Colombiano Promedio`,
      description,
      url,
      imageUrl,
      type: "article",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });

    this.setJsonLd({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: payload.title,
      description,
      url,
      image: imageUrl ? [imageUrl] : undefined,
      datePublished: payload.publishedAt || undefined,
      dateModified: payload.updatedAt || payload.publishedAt || undefined,
      author: payload.authorName
        ? {
            "@type": "Person",
            name: payload.authorName
          }
        : undefined,
      publisher: {
        "@type": "Organization",
        name: "Colombiano Promedio",
        url: this.absoluteUrl("/")
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
    this.clearJsonLd();
  }

  setArchive(payload: { page?: number; description?: string } = {}): void {
    const page = Math.max(Number(payload.page ?? 1), 1);
    const description =
      payload.description?.trim() ||
      "Archivo completo de Colombiano Promedio con acceso a todas las publicaciones ordenadas de la más reciente a la más antigua.";
    const title = page > 1 ? `Archivo de noticias | Página ${page} | Colombiano Promedio` : "Archivo de noticias | Colombiano Promedio";
    const url = page > 1 ? this.absoluteUrl(`/archivo?page=${page}`) : this.absoluteUrl("/archivo");

    this.applyCommonMeta({
      title,
      description,
      url,
      type: "website",
      robots: "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    });

    this.setJsonLd({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Archivo de noticias",
      description,
      url,
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

  private setCanonical(url: string): void {
    let canonical = this.document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;

    if (!canonical) {
      canonical = this.document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      this.document.head.appendChild(canonical);
    }

    canonical.setAttribute("href", url);
  }

  private setJsonLd(data: Record<string, unknown>): void {
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
