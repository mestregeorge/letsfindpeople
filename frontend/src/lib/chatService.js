import { supabase } from "./supabaseClient";

export const CHAT_RETENTION_DAYS = 7;
export const CHAT_MAX_MESSAGE_LENGTH = 500;
export const CHAT_GIF_PREFIX = "[gif]";

function normalizeChatGifUrl(url) {
  try {
    const parsedUrl = new URL(String(url || "").trim());
    return parsedUrl.protocol === "https:" ? parsedUrl.href : "";
  } catch {
    return "";
  }
}

export function getChatGifUrl(messageBody) {
  const body = String(messageBody || "").trim();
  if (!body.startsWith(CHAT_GIF_PREFIX)) return "";

  return normalizeChatGifUrl(body.slice(CHAT_GIF_PREFIX.length));
}

export function createChatGifMessage(gifUrl) {
  const url = normalizeChatGifUrl(gifUrl);
  if (!url) throw new Error("Choose a valid GIF.");

  const body = `${CHAT_GIF_PREFIX}${url}`;
  if (body.length > CHAT_MAX_MESSAGE_LENGTH) {
    throw new Error(`GIF link must be ${CHAT_MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  return body;
}

function mapChatMessage(row) {
  return {
    id: row.id_chat_message,
    userId: row.id_user,
    body: row.body || "",
    createdAt: row.created_at,
    author: {
      firstName: row.first_name || "",
      lastName: row.last_name || "",
      email: row.email || "",
      profileUrl: row.profile_url || null,
    },
  };
}

export async function listGlobalChatMessages() {
  const { data, error } = await supabase.rpc("list_global_chat_messages");
  if (error) throw new Error(error.message);
  return (data || []).map(mapChatMessage);
}

export async function sendGlobalChatMessage(message) {
  const body = String(message || "").trim();
  if (!body) throw new Error("Message cannot be empty.");
  if (body.length > CHAT_MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${CHAT_MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  const { data, error } = await supabase.rpc("send_global_chat_message", {
    p_body: body,
  });
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapChatMessage(row) : null;
}

export function subscribeToGlobalChatMessages(onChange) {
  return supabase
    .channel("global-chat-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "global_chat_messages" },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "global_chat_messages" },
      onChange
    )
    .subscribe();
}

export function removeGlobalChatSubscription(channel) {
  if (!channel) return Promise.resolve();
  return supabase.removeChannel(channel);
}
