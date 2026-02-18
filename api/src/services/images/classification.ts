import OpenAI from "openai";
import { env } from "../../env.js";

export const IMAGE_CATEGORIES = [
  "flyer",
  "coupon",
  "political",
  "real_estate",
  "charity",
  "event",
  "restaurant_menu",
  "services",
  "retail",
  "other",
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(IMAGE_CATEGORIES);
const DEFAULT_MODEL = "gpt-4o-mini";
const TITLE_MAX_LENGTH = 120;

const SYSTEM_PROMPT = [
  "You classify junk mail images for a public gallery.",
  "Return a concise title and one category from the allowed enum.",
  "Do not include personal names unless necessary for identifying the mail piece.",
  "Avoid markdown or extra fields.",
].join(" ");

const USER_PROMPT = "Classify this uploaded junk mail image and generate a short title.";

const normalizeTitle = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Untitled";
  if (raw.length <= TITLE_MAX_LENGTH) return raw;
  return raw.slice(0, TITLE_MAX_LENGTH).trim();
};

const normalizeCategory = (value: unknown): ImageCategory => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (CATEGORY_SET.has(raw)) return raw as ImageCategory;
  return "other";
};

export const isClassificationEnabled = () => Boolean(env.IMAGE_CLASSIFICATION_ENABLED ?? true);

export const sanitizeClassificationError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.slice(0, 300);
  }
  return "classification_failed";
};

export const classifyImageByUrl = async (imageUrl: string) => {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "replace-me") {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const model = env.OPENAI_MODEL_VISION || DEFAULT_MODEL;
  const timeoutMs = Number(env.IMAGE_CLASSIFICATION_TIMEOUT_MS ?? 10000);
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create(
    {
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            { type: "text", text: USER_PROMPT },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "junkmail_image_classification",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              category: { type: "string", enum: IMAGE_CATEGORIES },
            },
            required: ["title", "category"],
          },
        },
      },
    },
    {
      signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 10000),
    },
  );

  const content = completion.choices[0]?.message?.content || "";
  const parsed = JSON.parse(content || "{}") as { title?: unknown; category?: unknown };
  return {
    title: normalizeTitle(parsed.title),
    category: normalizeCategory(parsed.category),
    model,
  };
};
