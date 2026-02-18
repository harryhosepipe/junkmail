import { mutateConvexSetImagePerceptualHashes, queryConvexPublicImages } from "../convex/client.js";
import { computeImageFingerprint, similarityAnchor } from "../services/images/perceptualHash.js";

const ANCHOR_LENGTH = 2;

async function main() {
  const rows = await queryConvexPublicImages(2000);
  const targets = rows.filter((row) => !row.perceptualHashAnchor && row.originalUrl);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of targets) {
    try {
      const response = await fetch(row.originalUrl || "");
      if (!response.ok) {
        failed += 1;
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      const fingerprint = await computeImageFingerprint(bytes);
      const anchor = similarityAnchor(fingerprint, ANCHOR_LENGTH);

      const result = await mutateConvexSetImagePerceptualHashes({
        imageId: row.imageId,
        perceptualHashAnchor: anchor,
        perceptualHashes: fingerprint,
        updatedAt: Date.now(),
      });
      if (result?.ok) updated += 1;
      else skipped += 1;
    } catch {
      failed += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        targeted: targets.length,
        updated,
        skipped,
        failed,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
