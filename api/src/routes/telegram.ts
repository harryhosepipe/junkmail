import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { images, ratings, users } from "../db/schema.js";
import { imageQueue } from "../queue/index.js";
import { originalKey } from "../storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

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
  const raw = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "").trim();
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

const telegramToken = () => process.env.TELEGRAM_BOT_TOKEN || "";

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
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramUserId, sender.id))
    .limit(1);

  if (existing[0]?.id) {
    // Keep username fresh if present.
    if (sender.username) {
      await db
        .update(users)
        .set({ telegramUsername: sender.username })
        .where(eq(users.id, existing[0].id));
    }
    return existing[0].id;
  }

  const email = `tg-${sender.id}@telegram.local`;
  const alias = aliasFromTelegramUser(sender);

  const inserted = await db
    .insert(users)
    .values({
      email,
      alias,
      role: "uploader",
      inviteToken: null,
      telegramUserId: sender.id,
      telegramUsername: sender.username || null,
    })
    .returning({ id: users.id });

  return inserted[0]?.id as string;
};

const telegramRouter = new Hono();

telegramRouter.post("/webhook", async (c) => {
  const secretRequired = (process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN || "").trim();
  if (secretRequired) {
    const provided = c.req.header("x-telegram-bot-api-secret-token") || "";
    if (provided !== secretRequired) {
      return c.json({ ok: false, error: { message: "Unauthorized" } }, 401);
    }
  }

  const update = (await c.req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) {
    return c.json({ ok: false, error: { message: "Invalid payload" } }, 400);
  }

  const message = update.message || update.edited_message;
  if (!message) {
    // Telegram expects 200s; acknowledge irrelevant updates.
    return c.json({ ok: true });
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

  const uploaderId = await resolveOrCreateTelegramUploader(sender);

  const filePath = await fetchTelegramFilePath(fileId);
  const data = await downloadTelegramFile(filePath);

  if (data.length > MAX_UPLOAD_BYTES) {
    return c.json({ ok: true });
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

  await db.insert(images).values({
    id: imageId,
    uploaderId,
    title: null,
    description: null,
    status: "processing",
    originalUrl,
    variantUrls: {},
  });

  await db.insert(ratings).values({
    imageId,
    score: 0,
    uncertainty: 1,
    comparisonsCount: 0,
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
});

export default telegramRouter;
