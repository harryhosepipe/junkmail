import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  inviteToken: text("invite_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploaderId: uuid("uploader_id")
    .references(() => users.id)
    .notNull(),
  status: text("status").notNull(),
  originalUrl: text("original_url").notNull(),
  variantUrls: jsonb("variant_urls").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageAId: uuid("image_a_id")
    .references(() => images.id)
    .notNull(),
  imageBId: uuid("image_b_id")
    .references(() => images.id)
    .notNull(),
  winnerId: uuid("winner_id")
    .references(() => images.id)
    .notNull(),
  voterHash: text("voter_hash").notNull(),
  ipHash: text("ip_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const ratings = pgTable("ratings", {
  imageId: uuid("image_id")
    .primaryKey()
    .references(() => images.id),
  score: doublePrecision("score").notNull(),
  uncertainty: doublePrecision("uncertainty").notNull(),
  comparisonsCount: integer("comparisons_count").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
