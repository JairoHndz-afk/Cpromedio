import mongoose from "mongoose";

const articleCommentSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true
    },
    authorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    authorName: {
      type: String,
      required: true,
      trim: true
    },
    authorAvatarUrl: {
      type: String,
      default: "",
      trim: true
    },
    authorAvatarAlt: {
      type: String,
      default: "",
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["pending", "approved", "hidden", "rejected"],
      default: "approved"
    },
    censored: {
      type: Boolean,
      default: false
    },
    censoredTerms: {
      type: [String],
      default: []
    },
    featured: {
      type: Boolean,
      default: false
    },
    likedBy: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      default: []
    },
    dislikedBy: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ],
      default: []
    },
    moderationNote: {
      type: String,
      default: "",
      trim: true
    },
    moderatedAt: {
      type: Date,
      default: null
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

articleCommentSchema.index({ article: 1, status: 1, featured: -1, createdAt: -1 });
articleCommentSchema.index({ article: 1, createdAt: -1 });
articleCommentSchema.index({ authorUser: 1, createdAt: -1 });
articleCommentSchema.index({ moderatedBy: 1, moderatedAt: -1 });

export const ArticleComment = mongoose.model("ArticleComment", articleCommentSchema);
