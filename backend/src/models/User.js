import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
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
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["admin", "journalist", "reader"],
      required: true
    },
    avatar: {
      url: {
        type: String,
        default: "",
        trim: true
      },
      alt: {
        type: String,
        default: "",
        trim: true
      }
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null
    },
    nameChangedAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ["active", "blocked", "disabled"],
      default: "active"
    },
    sessionVersion: {
      type: Number,
      default: 0,
      min: 0
    },
    lastLoginAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ subscription: 1 }, { sparse: true, unique: true });

export const User = mongoose.model("User", userSchema);
