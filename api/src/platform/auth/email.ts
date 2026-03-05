type SendMagicLinkArgs = {
  to: string;
  link: string;
};

import { env } from "../../env.js";

const provider = (env.EMAIL_PROVIDER ?? "console").toLowerCase();
const from = env.EMAIL_FROM ?? "junkmail <noreply@example.com>";
const isLocalDev = (env.APP_ENV ?? "local") === "local" && env.NODE_ENV !== "production";

export const sendMagicLinkEmail = async ({ to, link }: SendMagicLinkArgs) => {
  if (provider === "resend") {
    const apiKey = env.EMAIL_API_KEY;
    if (!apiKey) {
      throw new Error("EMAIL_API_KEY is required for Resend");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your Junkmail login link",
        text: `Use this link to log in: ${link}`,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Resend failed: ${response.status} ${message}`);
    }

    return;
  }

  // In local dev, console mode is intentionally explicit so developers can copy the link.
  if (isLocalDev) {
    console.info("Magic link (dev)", { to, link });
    return;
  }

  // Outside local dev, never log raw auth tokens.
  let safeLink = link;
  try {
    const parsed = new URL(link);
    parsed.searchParams.delete("token");
    safeLink = parsed.toString();
  } catch {
    safeLink = "[invalid-link]";
  }

  console.info("Magic link", { to, link: safeLink });
};
