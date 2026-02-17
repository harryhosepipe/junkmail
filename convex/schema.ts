import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userProfiles: defineTable({
    authUserId: v.string(),
    email: v.string(),
    emailLower: v.string(),
    alias: v.string(),
    role: v.string(),
    inviteToken: v.optional(v.string()),
    telegramUserId: v.optional(v.number()),
    telegramUsername: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auth_user_id", ["authUserId"])
    .index("by_email_lower", ["emailLower"])
    .index("by_telegram_user_id", ["telegramUserId"]),
  authTokens: defineTable({
    tokenHash: v.string(),
    userAuthUserId: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user_auth_user_id", ["userAuthUserId"]),
  sessions: defineTable({
    tokenHash: v.string(),
    userAuthUserId: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user_auth_user_id", ["userAuthUserId"]),
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
    voteEventId: v.optional(v.string()),
    matchupTokenId: v.optional(v.string()),
    imageAId: v.string(),
    imageBId: v.string(),
    winnerId: v.string(),
    voterHash: v.string(),
    voterAuthUserId: v.optional(v.string()),
    ipHash: v.string(),
    createdAt: v.number(),
    validationStatus: v.optional(v.string()),
    projectionStatus: v.optional(v.string()),
    projectionAttemptCount: v.optional(v.number()),
    projectedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
  })
    .index("by_vote_event_id", ["voteEventId"])
    .index("by_created_at", ["createdAt"])
    .index("by_winner_id", ["winnerId"])
    .index("by_voter_hash", ["voterHash"])
    .index("by_voter_auth_user_id", ["voterAuthUserId"]),
  matchupTokens: defineTable({
    tokenId: v.string(),
    voterHash: v.string(),
    imageAId: v.string(),
    imageBId: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_token_id", ["tokenId"])
    .index("by_voter_hash", ["voterHash"])
    .index("by_expires_at", ["expiresAt"]),
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
