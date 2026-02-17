import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import { users } from "./schema.js";
import { mutateConvexUpsertUserProfile } from "../convex/client.js";

const run = async () => {
  await db
    .insert(users)
    .values({
      email: "uploader@example.com",
      alias: "uploader",
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
      alias: "uploader",
      role: "uploader",
    });
  } catch {
    // Local seed still works when Convex is not configured.
  }

  console.info(`Seeded auth user: ${uploaderId}`);
};

run()
  .then(() => pool.end())
  .catch(async (err) => {
    await pool.end();
    throw err;
  });
