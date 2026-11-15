import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Called by the database (pg_net) when a notification is created/updated; sends a push through Expo
// to all of the user's registered devices. Auth: x-push-secret is compared with a secret stored in Vault.

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type ExpoTicket = {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1) verify the shared secret with the database
  const provided = req.headers.get("x-push-secret") ?? "";
  const { data: expected, error: secretError } = await supabase.rpc("get_push_secret");
  if (secretError || !expected || provided !== expected) {
    return reply({ error: "forbidden" }, 403);
  }

  let notificationId: string | undefined;
  try {
    ({ notification_id: notificationId } = await req.json());
  } catch {
    return reply({ error: "invalid_json" }, 400);
  }
  if (!notificationId) return reply({ error: "notification_id_required" }, 400);

  // 2) the notification and the user's devices (through a narrow RPC: service_role has no table grants)
  const { data: target, error: targetError } = await supabase.rpc("get_push_targets", {
    p_notification_id: notificationId,
  });
  if (targetError) return reply({ error: "lookup_failed" }, 500);
  if (!target) return reply({ error: "notification_not_found" }, 404);

  const notification = target as {
    notification_id: string;
    type: string;
    payload: Record<string, unknown> | null;
    tokens: string[];
  };
  if (!notification.tokens?.length) return reply({ sent: 0, reason: "no_devices" });

  const payload = notification.payload ?? {};
  const messages = notification.tokens.map((token) => ({
    to: token,
    title: typeof payload.title === "string" ? payload.title : "شو بدك",
    body: typeof payload.body === "string" ? payload.body : "",
    sound: "default",
    priority: "high",
    channelId: "default",
    data: {
      notification_id: notification.notification_id,
      type: notification.type,
      route: typeof payload.route === "string" ? payload.route : null,
      conversation_id: typeof payload.conversation_id === "string" ? payload.conversation_id : null,
    },
  }));

  // 3) send through Expo (up to 100 per request) and drop devices that are no longer valid
  let sent = 0;
  const invalidTokens: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      console.error("expo push failed", response.status, await response.text());
      continue;
    }
    const { data: tickets } = (await response.json()) as { data?: ExpoTicket[] };
    (tickets ?? []).forEach((ticket, index) => {
      if (ticket.status === "ok") sent += 1;
      else if (ticket.details?.error === "DeviceNotRegistered") invalidTokens.push(batch[index].to);
      else console.error("expo ticket error", ticket.message);
    });
  }

  if (invalidTokens.length) {
    await supabase.rpc("remove_push_tokens", { p_tokens: invalidTokens });
  }

  return reply({ sent, removed: invalidTokens.length });
});
