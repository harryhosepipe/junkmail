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
const DEFAULT_PROMPT_ID = "pmpt_69964f0c85348190b30ecd9e3c94844d0e11797725242f00";
const DEFAULT_PROMPT_VERSION = "1";
const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;

const normalizeTitle = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Untitled";
  if (raw.length <= TITLE_MAX_LENGTH) return raw;
  return raw.slice(0, TITLE_MAX_LENGTH).trim();
};

const normalizeDescription = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (raw.length <= DESCRIPTION_MAX_LENGTH) return raw;
  return raw.slice(0, DESCRIPTION_MAX_LENGTH).trim();
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

  const promptId = env.OPENAI_PROMPT_ID || DEFAULT_PROMPT_ID;
  const promptVersion = env.OPENAI_PROMPT_VERSION || DEFAULT_PROMPT_VERSION;
  const timeoutMs = Number(env.IMAGE_CLASSIFICATION_TIMEOUT_MS ?? 10000);
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create(
    {
      prompt: {
        id: promptId,
        version: promptVersion,
      },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "low",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "junkmail_image_classification",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              classification: { type: "string", enum: IMAGE_CATEGORIES },
              description: { type: "string" },
            },
            required: ["title", "classification", "description"],
          },
        },
      },
    },
    {
      signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 10000),
    },
  );

  const content = response.output_text || "";
  const parsed = JSON.parse(content || "{}") as {
    title?: unknown;
    classification?: unknown;
    description?: unknown;
  };
  return {
    title: normalizeTitle(parsed.title),
    category: normalizeCategory(parsed.classification),
    description: normalizeDescription(parsed.description),
    model:
      response.model ||
      env.OPENAI_MODEL_VISION ||
      DEFAULT_MODEL,
  };
};
