export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: "admin" | "journalist";
  status: "active" | "blocked" | "disabled";
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
}

export interface ArticleImageAsset {
  url: string;
  alt: string;
  caption?: string;
}

export interface ArticleEmbedAsset {
  url: string;
  provider: "youtube" | "vimeo";
  title?: string;
}

export type ArticleContentBlock =
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "image";
      image: ArticleImageAsset;
    }
  | {
      type: "embed";
      embed: ArticleEmbedAsset;
    };

export interface PublicArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  body: string[];
  contentBlocks: ArticleContentBlock[];
  cover: {
    url: string;
    alt: string;
    positionX: number;
    positionY: number;
    type: "image" | "video" | "audio" | "infographic";
  };
  author: {
    id: string;
    name: string;
    role: string;
    email?: string;
  } | null;
  category: Category | null;
  tags: string[];
  metrics: {
    views: number;
    shares: number;
    reactions: number;
  };
  isPremium: boolean;
  featured: boolean;
  readingTime: number;
  publishedAt: string | null;
  updatedAt: string;
}

export interface PublicArticlePreview
  extends Pick<
    PublicArticle,
    "id" | "slug" | "title" | "subtitle" | "excerpt" | "cover" | "author" | "category" | "tags" | "metrics" | "featured" | "readingTime" | "publishedAt" | "updatedAt"
  > {}

export interface PublicArticleDetailPayload {
  article: PublicArticle;
  nextArticle: PublicArticlePreview | null;
}

export interface PublicAuthorProfile {
  id: string;
  name: string;
  role: string;
  articleCount: number;
  latestPublishedAt: string | null;
}

export interface PublicAuthorProfilePayload {
  author: PublicAuthorProfile;
  items: PublicArticle[];
  pagination: PaginationMeta;
}

export interface DashboardArticle extends PublicArticle {
  status: "draft" | "review" | "changes_requested" | "approved" | "published" | "archived" | "rejected";
  moderationNote: string;
  moderationHistory: Array<{
    actor: string;
    role: "admin" | "journalist";
    action: string;
    note: string;
    createdAt: string;
  }>;
}

export interface SitePayload {
  featured: PublicArticle | null;
  latest: PublicArticle[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedArticles {
  items: PublicArticle[];
  pagination: PaginationMeta;
}

export interface PublicArticleFilters {
  search?: string;
  page?: number;
  tag?: string;
  category?: string;
}

export interface SubscriptionActionPayload {
  message: string;
}

export interface DashboardArticlePage {
  items: DashboardArticle[];
  pagination: PaginationMeta;
}

export interface DashboardOverview {
  metrics: {
    articleCount: number;
    reviewCount: number;
    publishedCount: number;
    usersCount: number | null;
    subscriptionsCount: number | null;
  };
  recentArticles: DashboardArticle[];
  topViewedArticles: DashboardArticle[];
}

export interface PaginatedUsers {
  items: UserSession[];
  pagination: PaginationMeta;
}

export interface PaginatedSubscriptions {
  items: SubscriptionEntry[];
  pagination: PaginationMeta;
}

export interface UploadedImagePayload {
  url: string;
  alt: string;
  filename: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorEmail: string;
  ip: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface SubscriptionEntry {
  id: string;
  name: string;
  email: string;
  plan: "newsletter" | "premium";
  status: "pending" | "active" | "paused" | "cancelled";
  interests: string[];
  createdAt: string;
}
