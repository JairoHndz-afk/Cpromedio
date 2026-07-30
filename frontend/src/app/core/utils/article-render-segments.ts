import { ArticleContentBlock } from "../types/api.types";

export interface ArticleGalleryImage {
  url: string;
  alt: string;
  caption: string;
}

export type ArticleRenderSegment =
  | {
      kind: "block";
      key: string;
      block: ArticleContentBlock;
    }
  | {
      kind: "gallery";
      key: string;
      images: ArticleGalleryImage[];
    };

export function buildArticleRenderSegments(blocks: ArticleContentBlock[]): ArticleRenderSegment[] {
  const segments: ArticleRenderSegment[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];

    if (block.type === "image" && block.image.url.trim()) {
      const images: ArticleGalleryImage[] = [];
      let cursor = index;

      while (cursor < blocks.length) {
        const candidate = blocks[cursor];

        if (candidate.type !== "image" || !candidate.image.url.trim()) {
          break;
        }

        images.push({
          url: candidate.image.url.trim(),
          alt: (candidate.image.alt ?? "").trim(),
          caption: (candidate.image.caption ?? "").trim()
        });
        cursor += 1;
      }

      if (images.length > 1) {
        segments.push({
          kind: "gallery",
          key: `gallery-${index}-${images.length}-${sanitizeSegmentToken(images[0]?.url ?? "imagenes")}`,
          images
        });
      } else {
        segments.push({
          kind: "block",
          key: `block-${index}-image`,
          block
        });
      }

      index = cursor;
      continue;
    }

    segments.push({
      kind: "block",
      key: `block-${index}-${block.type}`,
      block
    });
    index += 1;
  }

  return segments;
}

function sanitizeSegmentToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
