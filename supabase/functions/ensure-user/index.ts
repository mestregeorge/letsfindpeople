// supabase/functions/ensure-user/index.ts
// @ts-nocheck
// Ensures a user row exists in the public.users table for the authenticated caller.
// Uses the service-role key to bypass RLS, so it can check banned/deleted status
// and create new rows atomically.
//
// Invoked from the frontend via:
//   supabase.functions.invoke('ensure-user', { body: { email } })
// The Supabase JS client automatically includes the caller's JWT in the
// Authorization header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function writeLog(
  supabase: ReturnType<typeof createClient>,
  idUser: number | null,
  action: string,
  status: string,
  reason?: string
) {
  const { data: actionRow } = await supabase
    .from("actions")
    .select("id_action")
    .eq("name", action)
    .maybeSingle();
  const actionId = actionRow?.id_action ?? null;
  if (!actionId) return;
  await supabase
    .from("logs")
    .insert({ id_user: idUser, id_action: actionId, status, reason: reason ?? null })
    .then(({ error }) => {
      if (error) console.error("[writeLog]", error.message);
    });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify the caller's JWT and extract their UID.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUid = user.id;
  const email = user.email ?? "";

  // Service-role client — bypasses RLS for all subsequent operations.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Lookup by supabase_uid (returning user).
  const { data: byUid } = await supabase
    .from("users")
    .select("id_user, is_deleted, is_banned, suspended_until")
    .eq("supabase_uid", supabaseUid)
    .maybeSingle();

  if (byUid) {
    if (byUid.is_deleted) {
      await writeLog(supabase, byUid.id_user, "LOG_IN", "Error", "Account has been deleted");
      return json({ error: "ACCOUNT_DELETED" });
    }
    if (byUid.is_banned) {
      await writeLog(supabase, byUid.id_user, "LOG_IN", "Error", "Account is banned");
      return json({ error: "ACCOUNT_BANNED" });
    }
    if (byUid.suspended_until && new Date(byUid.suspended_until).getTime() > Date.now()) {
      await writeLog(supabase, byUid.id_user, "LOG_IN", "Blocked", "Account is temporarily suspended");
      return json({ error: "ACCOUNT_SUSPENDED", suspendedUntil: byUid.suspended_until }, 403);
    }
    await writeLog(supabase, byUid.id_user, "LOG_IN", "Success");
    return json({ user: byUid, created: false });
  }

  // 2. Lookup by email — links an orphan row (e.g. seeded data) to the new UID.
  const { data: byEmail } = await supabase
    .from("users")
    .select("id_user, is_deleted, is_banned, suspended_until")
    .eq("email", email)
    .maybeSingle();

  if (byEmail) {
    if (byEmail.is_deleted) {
      await writeLog(supabase, byEmail.id_user, "LOG_IN", "Error", "Account has been deleted");
      return json({ error: "ACCOUNT_DELETED" });
    }
    if (byEmail.is_banned) {
      await writeLog(supabase, byEmail.id_user, "LOG_IN", "Error", "Account is banned");
      return json({ error: "ACCOUNT_BANNED" });
    }
    if (byEmail.suspended_until && new Date(byEmail.suspended_until).getTime() > Date.now()) {
      await writeLog(supabase, byEmail.id_user, "LOG_IN", "Blocked", "Account is temporarily suspended");
      return json({ error: "ACCOUNT_SUSPENDED", suspendedUntil: byEmail.suspended_until }, 403);
    }
    await supabase
      .from("users")
      .update({ supabase_uid: supabaseUid })
      .eq("id_user", byEmail.id_user);
    await writeLog(supabase, byEmail.id_user, "LOG_IN", "Success");
    return json({ user: byEmail, created: false });
  }

  // 3. Brand-new user — create the row.
  const { data: newUser, error: insertErr } = await supabase
    .from("users")
    .insert({ supabase_uid: supabaseUid, email, id_type: 1 })
    .select("id_user")
    .single();

  if (insertErr) {
    // Duplicate key means a concurrent request already created the row.
    if (insertErr.code === "23505") {
      const { data: existing } = await supabase
        .from("users")
        .select("id_user")
        .eq("supabase_uid", supabaseUid)
        .maybeSingle();
      if (existing) {
        await writeLog(supabase, existing.id_user, "CREATE_ACCOUNT", "Success");
        return json({ user: existing, created: true });
      }
    }
    await writeLog(supabase, null, "CREATE_ACCOUNT", "Error", insertErr.message);
    return json({ error: insertErr.message }, 500);
  }

  await writeLog(supabase, newUser.id_user, "CREATE_ACCOUNT", "Success");
  return json({ user: newUser, created: true });
});
