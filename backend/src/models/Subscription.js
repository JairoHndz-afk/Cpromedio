import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    plan: {
      type: String,
      enum: ["newsletter", "premium"],
      default: "newsletter"
    },
    interests: {
      type: [String],
      default: []
    },
    source: {
      type: String,
      default: "site"
    },
    status: {
      type: String,
      enum: ["pending", "active", "paused", "cancelled"],
      default: "pending"
    },
    confirmationTokenHash: {
      type: String,
      default: ""
    },
    confirmationTokenExpiresAt: {
      type: Date,
      default: null
    },
    unsubscribeTokenHash: {
      type: String,
      default: ""
    },
    confirmedAt: {
      type: Date,
      default: null
    },
    welcomeSentAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

subscriptionSchema.index({ confirmationTokenHash: 1 }, { sparse: true });
subscriptionSchema.index({ unsubscribeTokenHash: 1 }, { sparse: true });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
