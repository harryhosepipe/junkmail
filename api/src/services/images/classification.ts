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

const extractFirstJsonObject = (text: string) => {
  const start = text.indexOf("{");
  if (start < 0) {
    throw new Error("No JSON object found in classification response");
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  throw new Error("Unterminated JSON object in classification response");
};

const getResponseText = (response: any) => {
  const parts: string[] = [];
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    parts.push(response.output_text.trim());
  }
  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === "string" && block.text.trim()) {
        parts.push(block.text.trim());
      }
    }
  }
  return parts.join("\n").trim();
};

const normalizeJsonEnvelope = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }
  return trimmed;
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

  const content = getResponseText(response);
  if (!content) {
    throw new Error("Empty classification response");
  }
  const normalized = normalizeJsonEnvelope(content);
  const jsonText = extractFirstJsonObject(normalized);
  const parsed = JSON.parse(jsonText) as {
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
