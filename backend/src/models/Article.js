import mongoose from "mongoose";

const moderationEventSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "journalist"],
      required: true
    },
    action: {
      type: String,
      enum: ["created", "updated", "submitted", "approved", "changes_requested", "published", "archived", "rejected", "featured", "unfeatured", "deleted"],
      required: true
    },
    note: {
      type: String,
      default: "",
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const articleContentBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["heading", "paragraph", "quote", "image", "embed"],
      required: true
    },
    text: {
      type: String,
      default: "",
      trim: true
    },
    heading: {
      text: String,
      align: {
        type: String,
        enum: ["left", "center", "right"],
        default: "left"
      },
      level: {
        type: String,
        enum: ["h2", "h3"],
        default: "h2"
      }
    },
    quote: {
      text: String,
      attribution: String
    },
    image: {
      url: String,
      alt: String,
      caption: String
    },
    embed: {
      url: String,
      provider: {
        type: String,
        enum: ["youtube", "vimeo", "twitter", "instagram"]
      },
      title: String
    }
  },
  { _id: false }
);

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    subtitle: {
      type: String,
      trim: true
    },
    excerpt: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value),
        message: "El cuerpo del articulo debe tener un formato valido."
      }
    },
    contentBlocks: {
      type: [articleContentBlockSchema],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "El articulo debe incluir al menos un bloque de contenido."
      }
    },
    cover: {
      url: String,
      alt: String,
      positionX: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      },
      positionY: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      },
      type: {
        type: String,
        enum: ["image", "video", "audio", "infographic"],
        default: "image"
      }
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    tags: {
      type: [String],
      default: []
    },
    format: {
      type: String,
      enum: ["news", "analysis", "opinion", "chronicle", "interview", "fact-check"],
      default: "news"
    },
    status: {
      type: String,
      enum: ["draft", "review", "changes_requested", "approved", "published", "archived", "rejected"],
      default: "draft"
    },
    featured: {
      type: Boolean,
      default: false
    },
    isPremium: {
      type: Boolean,
      default: false
    },
    readingTime: {
      type: Number,
      default: 4
    },
    publishedAt: {
      type: Date
    },
    moderatedAt: {
      type: Date
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    deletionReason: {
      type: String,
      default: "",
      trim: true
    },
    moderationNote: {
      type: String,
      default: "",
      trim: true
    },
    moderationHistory: {
      type: [moderationEventSchema],
      default: []
    },
    seo: {
      title: String,
      description: String
    },
    metrics: {
      views: {
        type: Number,
        default: 0
      },
      shares: {
        type: Number,
        default: 0
      },
      reactions: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true
  }
);

articleSchema.index({
  title: "text",
  excerpt: "text",
  body: "text",
  tags: "text"
});

articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ author: 1, updatedAt: -1 });
articleSchema.index({ deletedAt: 1, updatedAt: -1 });

export const Article = mongoose.model("Article", articleSchema);
