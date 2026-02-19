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

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_PROMPT_ID = "pmpt_69964f0c85348190b30ecd9e3c94844d0e11797725242f00";
const DEFAULT_PROMPT_VERSION = "1";
const TITLE_MAX_WORDS = 4;
const CATEGORY_MAX_LENGTH = 80;
const DESCRIPTION_MAX_LENGTH = 500;

const stripKnownLabel = (value: string) =>
  value
    .replace(/^ARTEFACT NAME\s*:\s*/i, "")
    .replace(/^ARTIFACT NAME\s*:\s*/i, "")
    .replace(/^TITLE\s*:\s*/i, "")
    .replace(/^GENRE\s*:\s*/i, "")
    .trim();

const normalizeTitle = (value: unknown) => {
  const raw = typeof value === "string" ? stripKnownLabel(value.trim()) : "";
  if (!raw) return "Untitled";
  const singleLine = raw.split(/\r?\n/)[0]?.trim() || raw;
  const words = singleLine.split(/\s+/).filter(Boolean);
  const limited = words.slice(0, TITLE_MAX_WORDS).join(" ").trim();
  return limited || "Untitled";
};

const normalizeDescription = (value: unknown) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (raw.length <= DESCRIPTION_MAX_LENGTH) return raw;
  return raw.slice(0, DESCRIPTION_MAX_LENGTH).trim();
};

const normalizeCategory = (value: unknown): string => {
  const raw = typeof value === "string" ? stripKnownLabel(value.trim()) : "";
  if (!raw) return "other";
  if (raw.length <= CATEGORY_MAX_LENGTH) return raw;
  return raw.slice(0, CATEGORY_MAX_LENGTH).trim();
};

const safeJsonParse = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

const extractLabeledField = (text: string, label: string) => {
  const re = new RegExp(`(?:^|\\n)\\s*${label}\\s*:\\s*([^\\n]+)`, "i");
  return text.match(re)?.[1]?.trim() || "";
};

const parseClassificationOutput = (content: string) => {
  const parsed = safeJsonParse(content) || {};
  let title = parsed.title;
  let classification = parsed.classification;
  let description = parsed.description;

  if (typeof title === "string") {
    const nested = safeJsonParse(title.trim());
    if (nested) {
      title = nested.title ?? title;
      classification = classification ?? nested.classification;
      description = description ?? nested.description;
    }
  }

  const fallbackTitle =
    extractLabeledField(content, "ARTEFACT NAME") || extractLabeledField(content, "ARTIFACT NAME");
  const fallbackClassification =
    extractLabeledField(content, "GENRE") || extractLabeledField(content, "CLASSIFICATION");
  const fallbackDescription =
    extractLabeledField(content, "DESCRIPTION") ||
    extractLabeledField(content, "WHAT IS HAPPENING \\(LITERAL\\)");

  return {
    title: title ?? fallbackTitle,
    classification: classification ?? fallbackClassification,
    description: description ?? fallbackDescription,
  };
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
              classification: { type: "string" },
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
  const parsed = parseClassificationOutput(content);
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
