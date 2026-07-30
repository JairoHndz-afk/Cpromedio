import mongoose from "mongoose";

const alliedFeedSourceSchema = new mongoose.Schema(
  {
    name: {
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
    feedUrl: {
      type: String,
      required: true,
      trim: true
    },
    siteUrl: {
      type: String,
      default: "",
      trim: true
    },
    attributionLabel: {
      type: String,
      default: "",
      trim: true
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true
    },
    allowedMediaHosts: {
      type: [String],
      default: []
    },
    defaultTags: {
      type: [String],
      default: []
    },
    defaultCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null
    },
    importMode: {
      type: String,
      enum: ["draft", "review", "published"],
      default: "draft"
    },
    maxItemsPerSync: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    permissionNote: {
      type: String,
      default: "",
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastFetchedAt: {
      type: Date,
      default: null
    },
    lastImportedAt: {
      type: Date,
      default: null
    },
    lastImportCount: {
      type: Number,
      default: 0
    },
    lastSkippedCount: {
      type: Number,
      default: 0
    },
    lastError: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

alliedFeedSourceSchema.index({ isActive: 1, updatedAt: -1 });

export const AlliedFeedSource = mongoose.model("AlliedFeedSource", alliedFeedSourceSchema);
