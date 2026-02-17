import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userProfiles: defineTable({
    authUserId: v.string(),
    email: v.string(),
    emailLower: v.string(),
    alias: v.string(),
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
    voterAuthUserId: v.optional(v.string()),
    ipHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_winner_id", ["winnerId"])
    .index("by_voter_hash", ["voterHash"])
    .index("by_voter_auth_user_id", ["voterAuthUserId"]),
  images: defineTable({
    imageId: v.string(),
    uploaderAuthUserId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.string(),
    originalUrl: v.optional(v.string()),
    originalStorageId: v.optional(v.string()),
    variantUrls: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_image_id", ["imageId"])
    .index("by_status", ["status"])
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_uploader_created_at", ["uploaderAuthUserId", "createdAt"]),
  imageComments: defineTable({
    commentId: v.string(),
    imageId: v.string(),
    userAuthUserId: v.string(),
    userAlias: v.string(),
    body: v.string(),
    createdAt: v.number(),
  })
    .index("by_comment_id", ["commentId"])
    .index("by_image_created_at", ["imageId", "createdAt"])
    .index("by_user_created_at", ["userAuthUserId", "createdAt"]),
});
