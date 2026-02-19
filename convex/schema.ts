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
    uploadId: v.optional(v.string()),
    uploaderAuthUserId: v.string(),
    uploadHash: v.optional(v.string()),
    perceptualHashAnchor: v.optional(v.string()),
    perceptualHashes: v.optional(v.any()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.string(),
    originalUrl: v.optional(v.string()),
    originalStorageId: v.optional(v.string()),
    storageKeyOriginal: v.optional(v.string()),
    storageKeyCanonical: v.optional(v.string()),
    mime: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    rejectReason: v.optional(v.string()),
    matchedImageId: v.optional(v.string()),
    dedupeScores: v.optional(v.any()),
    category: v.optional(v.string()),
    classificationStatus: v.optional(v.string()),
    classificationError: v.optional(v.string()),
    classificationModel: v.optional(v.string()),
    classifiedAt: v.optional(v.number()),
    variantUrls: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_image_id", ["imageId"])
    .index("by_upload_id", ["uploadId"])
    .index("by_upload_hash", ["uploadHash"])
    .index("by_perceptual_hash_anchor", ["perceptualHashAnchor"])
    .index("by_status", ["status"])
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_category", ["category"])
    .index("by_classification_status", ["classificationStatus"])
    .index("by_uploader_created_at", ["uploaderAuthUserId", "createdAt"]),
  imageFingerprints: defineTable({
    imageId: v.string(),
    sha256Pixels: v.string(),
    phash64: v.string(),
    phashPrefix: v.string(),
    dhash64: v.optional(v.string()),
    canonicalWidth: v.optional(v.number()),
    canonicalHeight: v.optional(v.number()),
    cropBox: v.optional(v.any()),
    cropMeta: v.optional(v.any()),
    workerVersion: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_image_id", ["imageId"])
    .index("by_sha256_pixels", ["sha256Pixels"])
    .index("by_phash_prefix", ["phashPrefix"])
    .index("by_created_at", ["createdAt"]),
  dedupeEvents: defineTable({
    uploadImageId: v.string(),
    decision: v.string(),
    reason: v.string(),
    matchedImageId: v.optional(v.string()),
    scores: v.optional(v.any()),
    metrics: v.optional(v.any()),
    workerVersion: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_upload_image_id", ["uploadImageId"])
    .index("by_created_at", ["createdAt"]),
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
  imageClassifications: defineTable({
    imageId: v.string(),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
    model: v.optional(v.string()),
    classifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_image_id", ["imageId"])
    .index("by_status", ["status"])
    .index("by_updated_at", ["updatedAt"]),
});
