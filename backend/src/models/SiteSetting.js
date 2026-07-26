import mongoose from "mongoose";

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
    }
  },
  {
    timestamps: true
  }
);

export const SiteSetting = mongoose.model("SiteSetting", siteSettingSchema);
