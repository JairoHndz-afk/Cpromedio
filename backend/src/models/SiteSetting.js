import mongoose from "mongoose";

const siteCommunicationSchema = new mongoose.Schema(
  {
    eyebrow: {
      type: String,
      trim: true,
      default: "Comunicado editorial"
    },
    title: {
      type: String,
      trim: true,
      default: ""
    },
    message: {
      type: String,
      trim: true,
      default: ""
    },
    ctaLabel: {
      type: String,
      trim: true,
      default: ""
    },
    ctaUrl: {
      type: String,
      trim: true,
      default: ""
    },
    durationHours: {
      type: Number,
      min: 1,
      max: 24 * 31,
      default: 24
    },
    publishedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    version: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    _id: false
  }
);

const siteSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      default: "main"
    },
    featuredArticle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Article",
      default: null
    },
    communication: {
      type: siteCommunicationSchema,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const SiteSetting = mongoose.model("SiteSetting", siteSettingSchema);
