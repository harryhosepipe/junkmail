import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "crypto";
import { Hono } from "hono";
import { imageQueue } from "../../../platform/queue/index.js";
import { redis } from "../../../platform/queue/connection.js";
import { originalKey } from "../../../platform/storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../../../platform/storage/client.js";
import {
  queryConvexImagesByPerceptualHashAnchor,
  queryConvexRecentImages,
  queryConvexImageByUploadHash,
  mutateConvexRecordImageUploadProcessing,
  mutateConvexUpsertTelegramUser,
} from "../../../platform/convex/client.js";
import { env } from "../../../env.js";
import { serviceUnavailable } from "../../../platform/http/errors.js";
import { getRequestId } from "../../../platform/http/context.js";
import { jsonError } from "../../../platform/http/responses.js";
import {
  computeImageFingerprint,
  isNearDuplicate,
  similarityAnchor,
  type ImageFingerprint,
} from "../../../shared/domain/images/perceptualHash.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const PHASH_ANCHOR_LENGTH = 2;
const RECENT_DUPLICATE_CANDIDATE_LIMIT = 400;

type TelegramUser = {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramChat = {
  id: number;
  type?: string;
  title?: string;
};

type TelegramPhotoSize = {
  file_id: string;
  file_size?: number;
  width?: number;
  height?: number;
};

type TelegramDocument = {
  file_id: string;
  file_size?: number;
  mime_type?: string;
  file_name?: string;
};

type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

const parseAllowedChatIds = () => {
  const raw = (env.TELEGRAM_ALLOWED_CHAT_IDS || "").trim();
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
};

const sanitizeAlias = (value: string) => {
  const collapsed = value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32);
  return collapsed.length >= 2 ? collapsed : "";
};

const aliasFromTelegramUser = (user: TelegramUser) => {
  if (user.username) {
    const alias = sanitizeAlias(user.username);
    if (alias) return alias;
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join("_");
  const alias = sanitizeAlias(name);
  if (alias) return alias;

  return `tg_${user.id}`;
};

const telegramToken = () => env.TELEGRAM_BOT_TOKEN || "";

const telegramApiBase = () => `https://api.telegram.org/bot${telegramToken()}`;
const telegramFileBase = () => `https://api.telegram.org/file/bot${telegramToken()}`;

const fetchTelegramFilePath = async (fileId: string) => {
  const token = telegramToken();
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const url = new URL(`${telegramApiBase()}/getFile`);
  url.searchParams.set("file_id", fileId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Telegram getFile failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    result?: { file_path?: string };
  };

  const filePath = payload?.result?.file_path;
  if (!payload?.ok || !filePath) {
    throw new Error("Telegram getFile response missing file_path");
  }

  return filePath;
};

const downloadTelegramFile = async (filePath: string) => {
  const token = telegramToken();
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const url = `${telegramFileBase()}/${filePath}`;
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Telegram file download failed: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const resolveOrCreateTelegramUploader = async (sender: TelegramUser) => {
  const email = `tg-${sender.id}@telegram.local`;
  const alias = aliasFromTelegramUser(sender);
  const result = await mutateConvexUpsertTelegramUser({
    telegramUserId: sender.id,
    email,
    alias,
    role: "uploader",
    telegramUsername: sender.username || undefined,
  });
  return result.authUserId;
};

const telegramRouter = new Hono();

telegramRouter.post("/webhook", async (c) => {
  const secretRequired = (env.TELEGRAM_WEBHOOK_SECRET_TOKEN || "").trim();
  if (secretRequired) {
    const provided = c.req.header("x-telegram-bot-api-secret-token") || "";
    if (provided !== secretRequired) {
      return jsonError(c, 401, "Unauthorized");
    }
  }

  const update = (await c.req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) {
    return jsonError(c, 400, "Invalid payload");
  }

  const message = update.message || update.edited_message;
  if (!message) {
    // Telegram expects 200s; acknowledge irrelevant updates.
    return c.json({ ok: true });
  }

  // Telegram may retry webhook deliveries. Cache update ids briefly so we do not
  // duplicate image ingest when the same update is delivered again.
  try {
    const claim = await redis.set(`telegram:update:${update.update_id}`, "1", "EX", 60 * 60, "NX");
    if (claim !== "OK") {
      return c.json({ ok: true, duplicate: true });
    }
  } catch {
    // If Redis is unavailable we still continue. Duplicate protection becomes best-effort.
  }

  const chatId = String(message.chat?.id ?? "");
  if (!chatId) {
    return c.json({ ok: true });
  }

  const allowedChatIds = parseAllowedChatIds();
  if (allowedChatIds.size > 0 && !allowedChatIds.has(chatId)) {
    return c.json({ ok: true });
  }

  const sender = message.from;
  if (!sender || sender.is_bot) {
    return c.json({ ok: true });
  }

  let fileId = "";
  let contentType = "";
  let ext: "jpg" | "png" = "jpg";
  let fileSize = 0;

  const photos = message.photo;
  if (Array.isArray(photos) && photos.length) {
    const chosen = photos[photos.length - 1];
    fileId = chosen.file_id;
    fileSize = chosen.file_size ?? 0;
    contentType = "image/jpeg";
    ext = "jpg";
  } else if (message.document?.file_id) {
    const mime = message.document.mime_type || "";
    if (!mime.startsWith("image/")) {
      return c.json({ ok: true });
    }
    if (mime === "image/png") {
      contentType = "image/png";
      ext = "png";
    } else if (mime === "image/jpeg") {
      contentType = "image/jpeg";
      ext = "jpg";
    } else {
      return c.json({ ok: true });
    }

    fileId = message.document.file_id;
    fileSize = message.document.file_size ?? 0;
  } else {
    return c.json({ ok: true });
  }

  if (fileSize > MAX_UPLOAD_BYTES) {
    return c.json({ ok: true });
  }

  try {
    const uploaderId = await resolveOrCreateTelegramUploader(sender);

    const filePath = await fetchTelegramFilePath(fileId);
    const data = await downloadTelegramFile(filePath);

    if (data.length > MAX_UPLOAD_BYTES) {
      return c.json({ ok: true });
    }

    const uploadHash = createHash("sha256").update(data).digest("hex");
    const existing = await queryConvexImageByUploadHash(uploadHash);
    if (existing) {
      return c.json({ ok: true, duplicate: true, imageId: existing.imageId });
    }
    const fingerprint = await computeImageFingerprint(data);
    const anchor = similarityAnchor(fingerprint, PHASH_ANCHOR_LENGTH);
    const anchored = await queryConvexImagesByPerceptualHashAnchor(anchor, 128);
    const seen = new Set<string>();
    const candidates = [];
    for (const candidate of anchored) {
      if (!candidate?.imageId || seen.has(candidate.imageId)) continue;
      seen.add(candidate.imageId);
      candidates.push(candidate);
    }
    const recent = await queryConvexRecentImages(RECENT_DUPLICATE_CANDIDATE_LIMIT);
    for (const candidate of recent) {
      if (!candidate?.imageId || seen.has(candidate.imageId)) continue;
      seen.add(candidate.imageId);
      candidates.push(candidate);
    }

    const near = candidates.find((candidate) =>
      isNearDuplicate({
        incoming: fingerprint,
        existing: candidate.perceptualHashes as Partial<ImageFingerprint> | undefined,
      }),
    );
    if (near) {
      return c.json({ ok: true, duplicate: true, duplicateType: "near", imageId: near.imageId });
    }

    const imageId = randomUUID();
    const key = originalKey(imageId, ext);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: storageBucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );

    const originalUrl = publicObjectUrl(key);

    await mutateConvexRecordImageUploadProcessing({
      imageId,
      uploaderAuthUserId: uploaderId,
      uploadHash,
      perceptualHashAnchor: anchor,
      perceptualHashes: fingerprint,
      status: "processing",
      originalUrl,
      variantUrls: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await imageQueue.add(
      "process",
      {
        imageId,
        key,
        ext,
        contentType,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    return c.json({ ok: true, imageId }, 201);
  } catch (err) {
    const requestId = getRequestId(c);
    console.error("[telegram] ingest failed", {
      requestId,
      updateId: update.update_id,
      message: err instanceof Error ? err.message : String(err),
    });
    throw serviceUnavailable("Telegram ingest unavailable");
  }
});

export default telegramRouter;
