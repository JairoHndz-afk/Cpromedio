import mongoose from "mongoose";

const articleViewSchema = new mongoose.Schema(
  {
    article: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      required: true,
      index: true
    },
    fingerprint: {
      type: String,
      required: true,
      trim: true
    },
    windowStartsAt: {
      type: Date,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

articleViewSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
articleViewSchema.index({ article: 1, fingerprint: 1, windowStartsAt: 1 }, { unique: true });

export const ArticleView = mongoose.model("ArticleView", articleViewSchema);
