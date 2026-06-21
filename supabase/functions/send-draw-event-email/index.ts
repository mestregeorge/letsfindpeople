// supabase/functions/send-draw-event-email/index.ts
// @ts-nocheck

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildDrawEventStartedEmail } from "../_shared/emailTemplates.ts";
import { RESEND_BATCH_LIMIT, sendBatchEmails } from "../_shared/resend.ts";

const USERS_PAGE_SIZE = 1000;

function isSuspended(user: unknown) {
  return user?.suspended_until && new Date(user.suspended_until).getTime() > Date.now();
}

function parsePositiveInteger(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function getRecipientLimit() {
  const raw = Number(Deno.env.get("DRAW_EVENT_EMAIL_MAX_RECIPIENTS") || 0);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function loadRecipients(supabase: ReturnType<typeof createClient>) {
  const recipientLimit = getRecipientLimit();
  const recipients = [];
  let from = 0;

  while (true) {
    const to = from + USERS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("users")
      .select("id_user, email, first_name, last_name, id_type, suspended_until")
      .eq("is_deleted", false)
      .eq("is_banned", false)
      .not("email", "is", null)
      .range(from, to);

    if (error) throw error;

    const activeRecipients = (data || [])
      .filter((user) => user.email && user.id_type !== 2 && !isSuspended(user))
      .map((user) => ({
        id: user.id_user,
        email: user.email,
      }));

    for (const recipient of activeRecipients) {
      recipients.push(recipient);
      if (recipientLimit && recipients.length >= recipientLimit) return recipients;
    }

    if (!data || data.length < USERS_PAGE_SIZE) return recipients;
    from += USERS_PAGE_SIZE;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(req, { error: "Missing authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json(req, { error: "Unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const drawEventId = parsePositiveInteger(body.drawEventId ?? body.draw_event_id);
  if (!drawEventId) return json(req, { error: "drawEventId is required" }, 400);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: adminUser, error: adminError } = await supabase
    .from("users")
    .select("id_user, id_type, is_deleted, is_banned, suspended_until")
    .eq("supabase_uid", user.id)
    .maybeSingle();

  if (adminError) return json(req, { error: adminError.message }, 500);
  if (!adminUser || adminUser.id_type !== 2 || adminUser.is_deleted || adminUser.is_banned || isSuspended(adminUser)) {
    return json(req, { error: "Admin access required" }, 403);
  }

  const { data: drawEvent, error: drawError } = await supabase
    .from("draw_events")
    .select("id_draw_event, title, body, is_disabled, email_sent_at, email_recipient_count")
    .eq("id_draw_event", drawEventId)
    .maybeSingle();

  if (drawError) return json(req, { error: drawError.message }, 500);
  if (!drawEvent) return json(req, { error: "Draw event not found" }, 404);
  if (drawEvent.is_disabled) return json(req, { error: "Draw event is disabled" }, 400);
  if (drawEvent.email_sent_at) {
    return json(req, {
      ok: true,
      skipped: true,
      recipientCount: drawEvent.email_recipient_count || 0,
    });
  }

  const { data: notification } = await supabase
    .from("site_notifications")
    .select("cover_url")
    .eq("draw_event_id", drawEventId)
    .eq("notification_type", "draw_event")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    const recipients = await loadRecipients(supabase);
    const template = buildDrawEventStartedEmail({
      title: drawEvent.title,
      body: drawEvent.body,
      coverUrl: notification?.cover_url || "",
    });

    let sentCount = 0;
    const batches = chunk(recipients, RESEND_BATCH_LIMIT);
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      await sendBatchEmails(
        batch.map((recipient) => ({
          to: recipient.email,
          ...template,
          tags: [
            { name: "kind", value: "draw_event_started" },
            { name: "draw_event_id", value: String(drawEventId) },
          ],
        })),
        `draw-event-${drawEventId}-batch-${i}`,
      );
      sentCount += batch.length;
    }

    const { error: updateError } = await supabase
      .from("draw_events")
      .update({
        email_sent_at: new Date().toISOString(),
        email_recipient_count: sentCount,
      })
      .eq("id_draw_event", drawEventId)
      .is("email_sent_at", null);

    if (updateError) throw updateError;

    return json(req, { ok: true, skipped: false, recipientCount: sentCount });
  } catch (err) {
    console.error("[send-draw-event-email]", (err as Error).message);
    return json(req, { error: (err as Error).message }, 500);
  }
});
