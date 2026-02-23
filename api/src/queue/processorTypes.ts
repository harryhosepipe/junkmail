export type ImageProcessJobData = {
  imageId: string;
  key: string;
  ext: "jpg" | "png";
  contentType: string;
  uploadId?: string;
  dedupeV2?: boolean;
};

export type VoteProcessJobData = {
  voteEventId: string;
  createdAt: number;
};
