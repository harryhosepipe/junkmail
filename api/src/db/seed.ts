import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import { images, ratings, users } from "./schema.js";
import { mutateConvexUpsertUserProfile } from "../convex/client.js";

const run = async () => {
  await db
    .insert(users)
    .values({
      email: "uploader@example.com",
      role: "uploader",
      inviteToken: "invite-dev",
    })
    .onConflictDoNothing();

  const uploadedBy = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "uploader@example.com"))
    .limit(1);

  const uploaderId = uploadedBy[0]?.id;
  if (!uploaderId) {
    throw new Error("Seed failed: uploader user missing");
  }

  try {
    await mutateConvexUpsertUserProfile({
      authUserId: uploaderId,
      email: "uploader@example.com",
      role: "uploader",
    });
  } catch {
    // Local seed still works when Convex is not configured.
  }

  const seeded = await db
    .insert(images)
    .values([
      {
        uploaderId,
        status: "public",
        originalUrl: "https://example.com/junkmail-1.jpg",
        variantUrls: {
          thumb: "https://example.com/junkmail-1-thumb.jpg",
          feed: "https://example.com/junkmail-1-feed.jpg",
          full: "https://example.com/junkmail-1-full.jpg",
        },
      },
      {
        uploaderId,
        status: "public",
        originalUrl: "https://example.com/junkmail-2.jpg",
        variantUrls: {
          thumb: "https://example.com/junkmail-2-thumb.jpg",
          feed: "https://example.com/junkmail-2-feed.jpg",
          full: "https://example.com/junkmail-2-full.jpg",
        },
      },
      {
        uploaderId,
        status: "public",
        originalUrl: "https://example.com/junkmail-3.jpg",
        variantUrls: {
          thumb: "https://example.com/junkmail-3-thumb.jpg",
          feed: "https://example.com/junkmail-3-feed.jpg",
          full: "https://example.com/junkmail-3-full.jpg",
        },
      },
    ])
    .returning({ id: images.id });

  if (seeded.length) {
    await db.insert(ratings).values(
      seeded.map((row) => ({
        imageId: row.id,
        score: 0,
        uncertainty: 1,
        comparisonsCount: 0,
      })),
    );
  }
};

run()
  .then(() => pool.end())
  .catch(async (err) => {
    await pool.end();
    throw err;
  });
