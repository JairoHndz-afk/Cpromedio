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
      enum: ["admin", "journalist"],
      required: true
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

export const User = mongoose.model("User", userSchema);
