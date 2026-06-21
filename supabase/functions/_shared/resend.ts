// @ts-nocheck

import type { EmailTemplate } from "./emailTemplates.ts";

type EmailMessage = EmailTemplate & {
  to: string | string[];
  from?: string;
  reply_to?: string;
  tags?: Array<{ name: string; value: string }>;
};

const RESEND_API_BASE_URL = "https://api.resend.com";
export const RESEND_BATCH_LIMIT = 100;

function getFromAddress() {
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "no-reply@letsfindpeople.com";
  const fromName = Deno.env.get("RESEND_FROM_NAME") || "LetsFindPeople";
  return `${fromName} <${fromEmail}>`;
}

function getApiKey() {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  return apiKey;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function resendRequest(path: string, body: unknown, idempotencyKey?: string) {
  const response = await fetch(`${RESEND_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error || `Resend request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function withDefaults(message: EmailMessage) {
  return {
    from: message.from || getFromAddress(),
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.reply_to ? { reply_to: message.reply_to } : {}),
    ...(message.tags ? { tags: message.tags } : {}),
  };
}

export async function sendEmail(message: EmailMessage, idempotencyKey?: string) {
  return resendRequest("/emails", withDefaults(message), idempotencyKey);
}

export async function sendBatchEmails(messages: EmailMessage[], idempotencyKey?: string) {
  if (messages.length > RESEND_BATCH_LIMIT) {
    throw new Error(`Resend batch email limit is ${RESEND_BATCH_LIMIT}`);
  }
  if (messages.length === 0) return { data: [] };

  return resendRequest(
    "/emails/batch",
    messages.map((message) => withDefaults(message)),
    idempotencyKey,
  );
}
