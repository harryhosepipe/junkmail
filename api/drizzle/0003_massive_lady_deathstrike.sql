ALTER TABLE "users" ADD COLUMN "alias" text;
--> statement-breakpoint
UPDATE "users"
SET "alias" = COALESCE(NULLIF(split_part("email", '@', 1), ''), ('user-' || left("id"::text, 8)))
WHERE "alias" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "alias" SET NOT NULL;
