import { mutateConvexUpsertUserProfile } from "../convex/client.js";
import { getEnv } from "../env.js";

const run = async () => {
  getEnv();

  await mutateConvexUpsertUserProfile({
    authUserId: "seed-uploader",
    email: "uploader@example.com",
    alias: "uploader",
    role: "uploader",
    inviteToken: "invite-dev",
  });

  console.info("Seeded Convex uploader user: seed-uploader");
};

run().catch((error) => {
  console.error("Seed failed", error);
  process.exitCode = 1;
});
