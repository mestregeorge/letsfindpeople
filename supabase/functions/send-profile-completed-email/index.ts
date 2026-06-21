// supabase/functions/send-profile-completed-email/index.ts
// @ts-nocheck

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { buildProfileCompletedEmail } from "../_shared/emailTemplates.ts";
import { sendEmail } from "../_shared/resend.ts";

function isSuspended(user: unknown) {
  return user?.suspended_until && new Date(user.suspended_until).getTime() > Date.now();
}

function getDisplayName(dbUser: unknown, authUser: unknown) {
  const metadata = authUser?.user_metadata ?? {};
  const authName =
    metadata.full_name ||
    metadata.name ||
    [metadata.given_name, metadata.family_name].filter(Boolean).join(" ");
  const dbName = [dbUser?.first_name, dbUser?.last_name].filter(Boolean).join(" ");
  return String(dbName || authName || dbUser?.email || authUser?.email || "").trim();
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: dbUser, error: dbError } = await supabase
    .from("users")
    .select("id_user, email, first_name, last_name, is_deleted, is_banned, suspended_until, profile_completed_at, profile_completed_email_sent_at")
    .eq("supabase_uid", user.id)
    .maybeSingle();

  if (dbError) return json(req, { error: dbError.message }, 500);
  if (!dbUser) return json(req, { error: "User not found" }, 404);
  if (dbUser.is_deleted || dbUser.is_banned || isSuspended(dbUser)) {
    return json(req, { error: "Account is not active" }, 403);
  }
  if (dbUser.profile_completed_email_sent_at) {
    return json(req, { ok: true, skipped: true });
  }
  if (!dbUser.email) return json(req, { error: "User email is missing" }, 400);

  const template = buildProfileCompletedEmail({
    displayName: getDisplayName(dbUser, user),
  });

  try {
    await sendEmail(
      {
        to: dbUser.email,
        ...template,
        tags: [
          { name: "kind", value: "profile_completed" },
          { name: "user_id", value: String(dbUser.id_user) },
        ],
      },
      `profile-completed-${dbUser.id_user}`,
    );

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("users")
      .update({
        profile_completed_at: dbUser.profile_completed_at || now,
        profile_completed_email_sent_at: now,
      })
      .eq("id_user", dbUser.id_user)
      .is("profile_completed_email_sent_at", null);

    if (updateError) throw updateError;

    return json(req, { ok: true, skipped: false });
  } catch (err) {
    console.error("[send-profile-completed-email]", (err as Error).message);
    return json(req, { error: (err as Error).message }, 500);
  }
});
