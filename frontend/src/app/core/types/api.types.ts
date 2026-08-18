export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: "admin" | "journalist" | "reader";
  status: "active" | "blocked" | "disabled";
  avatar: {
    url: string;
    alt: string;
  };
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
  provider: "youtube" | "vimeo" | "twitter" | "instagram";
  title?: string;
}

export interface ArticleQuoteAsset {
  text: string;
  attribution?: string;
}

export interface ArticleHeadingAsset {
  text: string;
  align: "left" | "center" | "right";
  level: "h2" | "h3";
}

export type ArticleContentBlock =
  | {
      type: "heading";
      heading: ArticleHeadingAsset;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "quote";
      quote: ArticleQuoteAsset;
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
  syndication: {
    sourceType: "original" | "allied_rss";
    sourceName: string;
    sourceUrl: string;
    originalUrl: string;
    authorName: string;
    attributionLabel: string;
  };
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

export interface PublicArticleComment {
  id: string;
  authorName: string;
  authorAvatarUrl: string;
  authorAvatarAlt: string;
  body: string;
  featured: boolean;
  createdAt: string;
  isOwner: boolean;
}

export interface PublicArticleCommentsPayload {
  editorialNote: string;
  total: number;
  items: PublicArticleComment[];
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
  items: PublicArticlePreview[];
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

export interface DashboardArticleComment {
  id: string;
  articleId: string;
  authorName: string;
  authorAvatarUrl: string;
  authorAvatarAlt: string;
  body: string;
  status: "pending" | "approved" | "hidden" | "rejected";
  censored: boolean;
  censoredTerms: string[];
  featured: boolean;
  moderationNote: string;
  createdAt: string;
  moderatedAt: string | null;
  moderatedBy: {
    id: string;
    name: string;
    email: string;
    role: "admin" | "journalist";
  } | null;
}

export interface DashboardArticleCommentsPayload {
  items: DashboardArticleComment[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    hidden: number;
    rejected: number;
    featured: number;
  };
}

export interface SiteCommunication {
  eyebrow: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
  durationHours: number;
  publishedAt: string | null;
  expiresAt: string;
  version: string;
}

export interface AlliedFeedSource {
  id: string;
  name: string;
  slug: string;
  feedUrl: string;
  siteUrl: string;
  attributionLabel: string;
  logoUrl: string;
  allowedMediaHosts: string[];
  defaultTags: string[];
  defaultCategoryId: string;
  defaultCategoryName: string;
  importMode: "draft" | "review" | "published";
  maxItemsPerSync: number;
  permissionNote: string;
  isActive: boolean;
  lastFetchedAt: string | null;
  lastImportedAt: string | null;
  lastImportCount: number;
  lastSkippedCount: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlliedFeedSyncResult {
  syncedAt: string;
  importedCount: number;
  skippedCount: number;
  items: Array<{
    id: string;
    title: string;
    slug: string;
    status: "draft" | "review" | "changes_requested" | "approved" | "published" | "archived" | "rejected";
  }>;
}

export interface SitePayload {
  featured: PublicArticlePreview | null;
  mostRead: PublicArticlePreview | null;
  latest: PublicArticlePreview[];
  latestPagination: PaginationMeta;
  communication: SiteCommunication | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedArticles {
  items: PublicArticlePreview[];
  pagination: PaginationMeta;
}

export type PublicArticleSort = "latest" | "oldest" | "popular";

export interface PublicArchiveFilterCategory extends Category {
  count: number;
}

export interface PublicArchiveFilterTag {
  value: string;
  label: string;
  count: number;
}

export interface PublicArchiveFiltersPayload {
  categories: PublicArchiveFilterCategory[];
  tags: PublicArchiveFilterTag[];
}

export interface PublicArticleFilters {
  search?: string;
  page?: number;
  limit?: number;
  tag?: string;
  category?: string;
  excludeId?: string;
  sort?: PublicArticleSort;
}

export interface SubscriptionActionPayload {
  message: string;
}

export interface ReaderSubscriptionAccessPayload {
  subscription: {
    id: string;
    name: string;
    email: string;
    plan: "newsletter" | "premium";
    status: "pending" | "active" | "paused" | "cancelled";
    createdAt: string;
    confirmedAt: string | null;
  } | null;
  readerAccount: {
    exists: boolean;
    name: string;
    createdAt: string | null;
  };
}

export interface ReaderAccountPayload {
  user: UserSession;
  subscription: {
    id: string;
    name: string;
    email: string;
    plan: "newsletter" | "premium";
    status: "pending" | "active" | "paused" | "cancelled";
    createdAt: string;
    confirmedAt: string | null;
  } | null;
  permissions: {
    canChangeNameNow: boolean;
    nameChangeAvailableAt: string | null;
  };
}

export interface ReaderOwnComment {
  id: string;
  article: {
    id: string;
    slug: string;
    title: string;
  } | null;
  body: string;
  status: "pending" | "approved" | "hidden" | "rejected";
  featured: boolean;
  censored: boolean;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
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
