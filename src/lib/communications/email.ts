import "server-only";

import { getServerEnv } from "@/lib/env";
import { log } from "@/lib/security/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string }>;
}

class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    const id = `console-${crypto.randomUUID()}`;
    log("info", "email.console", {
      id,
      subject: message.subject,
      recipientDomain: message.to.split("@")[1] ?? "unknown",
    });
    return { id };
  }
}

class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Email provider returned ${response.status}.`);
    }

    const payload = (await response.json()) as { id: string };
    return { id: payload.id };
  }
}

export function getEmailProvider(): EmailProvider {
  const env = getServerEnv();
  if (env.EMAIL_PROVIDER === "resend") {
    return new ResendEmailProvider(env.RESEND_API_KEY!, env.EMAIL_FROM!);
  }
  return new ConsoleEmailProvider();
}

export async function sendConfirmationEmail(message: EmailMessage) {
  try {
    return await getEmailProvider().send(message);
  } catch (error) {
    log("error", "email.failed", {
      message: error instanceof Error ? error.message : "Unknown email failure",
      subject: message.subject,
    });
    return null;
  }
}
