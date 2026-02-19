import OpenAI from "openai";
import { env } from "../../env.js";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_PROMPT_ID = "pmpt_69964f0c85348190b30ecd9e3c94844d0e11797725242f00";
const DEFAULT_PROMPT_VERSION = "1";

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
    },
    {
      signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 10000),
    },
  );

  const content = response.output_text || "{}";
  const parsed = JSON.parse(content) as {
    title?: unknown;
    classification?: unknown;
    description?: unknown;
  };
  if (
    typeof parsed.title !== "string" ||
    typeof parsed.classification !== "string" ||
    typeof parsed.description !== "string"
  ) {
    throw new Error("Invalid classification JSON response");
  }

  return {
    title: parsed.title,
    category: parsed.classification,
    description: parsed.description,
    model:
      response.model ||
      env.OPENAI_MODEL_VISION ||
      DEFAULT_MODEL,
  };
};
