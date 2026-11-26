import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "verification-docs";
const USER_BATCH_LIMIT = 500;
const PAGE_SIZE = 1000;

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function threeCalendarMonthsAgo(): string {
  const cutoff = new Date();
  const originalDay = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0),
  ).getUTCDate();
  cutoff.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return cutoff.toISOString();
}

async function listFilesRecursively(
  supabase: ReturnType<typeof createClient>,
  folder: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 10) throw new Error("storage_folder_depth_exceeded");

  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) throw new Error("storage_list_failed");

    const entries = data ?? [];
    for (const entry of entries) {
      if (!entry.name) continue;
      const path = `${folder}/${entry.name}`;

      if (entry.id === null) {
        paths.push(...await listFilesRecursively(supabase, path, depth + 1));
      } else {
        paths.push(path);
      }
    }

    if (entries.length < PAGE_SIZE) break;
    offset += entries.length;
  }

  return paths;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return reply({ error: "server_configuration_error" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const providedSecret = req.headers.get("x-cleanup-secret") ?? "";
  if (!providedSecret) return reply({ error: "forbidden" }, 403);

  const { data: expectedSecret, error: secretError } = await supabase.rpc(
    "get_verification_cleanup_secret",
  );
  if (
    secretError ||
    typeof expectedSecret !== "string" ||
    !constantTimeEqual(providedSecret, expectedSecret)
  ) {
    return reply({ error: "forbidden" }, 403);
  }

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id")
    .not("deleted_at", "is", null)
    .lte("deleted_at", threeCalendarMonthsAgo())
    .order("deleted_at", { ascending: true })
    .limit(USER_BATCH_LIMIT);

  if (usersError) {
    console.error("verification cleanup could not load eligible accounts");
    return reply({ error: "eligible_accounts_lookup_failed" }, 500);
  }

  let processedAccounts = 0;
  let deletedFiles = 0;
  let clearedVerificationRecords = 0;
  let failedAccounts = 0;

  for (const user of users ?? []) {
    try {
      const paths = await listFilesRecursively(supabase, user.id);

      for (let i = 0; i < paths.length; i += PAGE_SIZE) {
        const batch = paths.slice(i, i + PAGE_SIZE);
        const { data: removed, error: removeError } = await supabase.storage
          .from(BUCKET)
          .remove(batch);

        if (removeError) throw new Error("storage_remove_failed");
        deletedFiles += removed?.length ?? batch.length;
      }

      const { data: cleared, error: clearError } = await supabase.rpc(
        "clear_expired_verification_file_urls",
        { p_user_id: user.id },
      );

      if (clearError) throw new Error("verification_urls_clear_failed");
      clearedVerificationRecords += typeof cleared === "number" ? cleared : 0;
      processedAccounts += 1;
    } catch (error) {
      failedAccounts += 1;
      console.error(
        "verification cleanup failed for one eligible account",
        error instanceof Error ? error.message : "unknown_error",
      );
    }
  }

  const result = {
    eligibleAccounts: users?.length ?? 0,
    processedAccounts,
    deletedFiles,
    clearedVerificationRecords,
    failedAccounts,
  };

  return reply(result, failedAccounts > 0 ? 500 : 200);
});
