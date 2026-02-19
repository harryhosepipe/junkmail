import OpenAI from "openai";
import { env } from "../../env.js";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_PROMPT_ID = "pmpt_69964f0c85348190b30ecd9e3c94844d0e11797725242f00";
const DEFAULT_PROMPT_VERSION = "1";
const DEFAULT_TIMEOUT_MS = 30000;

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
  const configuredTimeoutMs = Number(env.IMAGE_CLASSIFICATION_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeoutMs)
    ? Math.max(1000, Math.floor(configuredTimeoutMs))
    : DEFAULT_TIMEOUT_MS;
  const client = new OpenAI({ apiKey });
  const requestBody = {
    prompt: {
      id: promptId,
      version: promptVersion,
    },
    input: [
      {
        role: "user" as const,
        content: [
          {
            type: "input_image" as const,
            image_url: imageUrl,
            detail: "low" as const,
          },
        ],
      },
    ],
  };
  const runRequest = (ms: number) =>
    client.responses.create(requestBody, {
      signal: AbortSignal.timeout(ms),
    });

  let response;
  try {
    response = await runRequest(timeoutMs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isAbort = /aborted|abort/i.test(message);
    if (!isAbort) {
      throw error;
    }
    response = await runRequest(timeoutMs * 2);
  }

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
