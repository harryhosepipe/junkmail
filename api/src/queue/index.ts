import { Queue } from "bullmq";
import { redis } from "./connection.js";

export const imageQueue = new Queue("image-processing", {
  connection: redis
});
