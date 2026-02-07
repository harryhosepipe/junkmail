import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userProfiles: defineTable({
    authUserId: v.string(),
    email: v.string(),
    emailLower: v.string(),
    alias: v.optional(v.string()),
    role: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auth_user_id", ["authUserId"])
    .index("by_email_lower", ["emailLower"]),
  imageRatings: defineTable({
    imageId: v.string(),
    score: v.number(),
    uncertainty: v.number(),
    comparisonsCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_image_id", ["imageId"])
    .index("by_comparisons", ["comparisonsCount"])
    .index("by_updated_at", ["updatedAt"]),
  votes: defineTable({
    imageAId: v.string(),
    imageBId: v.string(),
    winnerId: v.string(),
    voterHash: v.string(),
    ipHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_winner_id", ["winnerId"]),
});
