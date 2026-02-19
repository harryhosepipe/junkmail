import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { deleteImage } from "../../services/images/actions.js";
import { s3Client, storageBucket } from "../../storage/client.js";

type DeleteImageUseCaseResult =
  | {
      ok: true;
      imageId: string;
      deletedCounts: Record<string, number>;
      storage: {
        attempted: number;
        deleted: number;
        failed: number;
      };
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

export const executeDeleteImage = async (imageId: string): Promise<DeleteImageUseCaseResult> => {
  const result = await deleteImage(imageId);
  if (!result.ok) {
    return result;
  }

  const settled = await Promise.allSettled(
    result.storageKeys.map((key) =>
      s3Client.send(
        new DeleteObjectCommand({
          Bucket: storageBucket,
          Key: key,
        }),
      ),
    ),
  );
  const deleted = settled.filter((item) => item.status === "fulfilled").length;

  return {
    ok: true,
    imageId: result.imageId,
    deletedCounts: result.deletedCounts,
    storage: {
      attempted: settled.length,
      deleted,
      failed: settled.length - deleted,
    },
  };
};
