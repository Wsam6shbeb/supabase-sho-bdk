-- ============================================================
-- Smoke test: security hardening + full order lifecycle.
-- Self-contained (creates its own users/request/provider) and ALWAYS rolls back:
-- it ends with RAISE EXCEPTION 'RESULT ...' so nothing is persisted.
-- Run it in the Supabase SQL editor (or via the MCP execute_sql tool) after any migration.
-- Expected: the RESULT line starts with "PASS" and lists 0 failures.
-- ============================================================
do $$
declare
  req uuid := gen_random_uuid();
  prov uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  rid uuid;
  conv uuid;
  ag public.agreements;
  j record;
  e text;
  n int;
  bal numeric;
  fails text[] := '{}';
  checks int := 0;

begin
  ---------------------------------------------------------------- fixtures (as postgres)
  insert into auth.users(id, instance_id, aud, role, email)
  select u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'smoke-' || u::text || '@example.test'
  from unnest(array[req, prov, stranger]) u;
  insert into public.users(id, full_name) values (req, 'Smoke Requester'), (prov, 'Smoke Provider'), (stranger, 'Smoke Stranger');
  insert into public.provider_profiles(user_id) values (prov);
  insert into public.service_requests(requester_id, raw_text, urgency) values (req, 'smoke request', 'normal') returning id into rid;
  insert into public.candidates(request_id, provider_id, rank, match_score) values (rid, prov, 1, 0.9);
  update public.wallets set available_balance = 1000 where user_id = prov;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', req, 'role', 'authenticated')::text, true);

  ---------------------------------------------------------------- 1) privilege hardening (all must be refused)
  declare
    attempts text[][] := array[
      array['users.is_admin',            'update public.users set is_admin = true where id = auth.uid()'],
      array['users.verification_status', $q$update public.users set verification_status = 'approved' where id = auth.uid()$q$],
      array['request.state',             $q$update public.service_requests set state = 'completed' where requester_id = auth.uid()$q$],
      array['request.delete',            'delete from public.service_requests where requester_id = auth.uid()'],
      array['rating insert',             format('insert into public.ratings(request_id, from_user_id, to_user_id, score) values (%L, %L, %L, 5)', rid, req, prov)],
      array['wallet update',             'update public.wallets set available_balance = 999999'],
      array['ledger insert',             format('insert into public.ledger_entries(user_id, entry_type, amount, balance_after, idempotency_key) values (%L, ''bonus_credit'', 1, 1, ''smoke'')', req)],
      array['direct approve_agreement',  format('select public.approve_agreement(%L, %L)', gen_random_uuid(), prov)],
      array['notification forge',        format('insert into public.notifications(user_id, type, payload) values (%L, ''x'', ''{}'')', req)]
    ];
    a text[];
  begin
    foreach a slice 1 in array attempts loop
      checks := checks + 1;
      begin
        execute a[2];
        get diagnostics n = row_count;
        -- RLS can also refuse silently by matching 0 rows: that counts as refused
        if n > 0 then fails := fails || ('hardening:' || a[1] || ' was ALLOWED'); end if;
      exception when others then null;  -- refused: good
      end;
    end loop;
  end;

  -- a client-created request always starts as 'submitted'
  checks := checks + 1;
  declare st text; newreq uuid;
  begin
    insert into public.service_requests(requester_id, raw_text, state, urgency) values (req, 'x', 'completed', 'normal') returning id into newreq;
    select state::text into st from public.service_requests where id = newreq;
    if st <> 'submitted' then fails := fails || ('forced initial state was ' || st); end if;
  end;

  ---------------------------------------------------------------- 2) conversation + chat
  checks := checks + 1;
  conv := public.open_conversation(rid, prov);
  if conv is distinct from public.open_conversation(rid, prov) then fails := fails || 'open_conversation not idempotent'; end if;

  checks := checks + 1;
  begin
    perform public.open_conversation(rid, stranger);
    fails := fails || 'open_conversation allowed a non-candidate';
  exception when others then null; end;

  checks := checks + 1;
  begin
    insert into public.messages(conversation_id, sender_id, body, message_type) values (conv, req, 'fake', 'system');
    fails := fails || 'client could insert a system message';
  exception when insufficient_privilege then null; end;

  insert into public.messages(conversation_id, sender_id, body, client_dedupe_key) values (conv, req, 'hello', 'k1');
  checks := checks + 1;
  begin
    insert into public.messages(conversation_id, sender_id, body, client_dedupe_key) values (conv, req, 'dup', 'k1');
    fails := fails || 'dedupe key not enforced';
  exception when unique_violation then null; end;

  perform set_config('request.jwt.claims', json_build_object('sub', prov, 'role', 'authenticated')::text, true);
  checks := checks + 1;
  select count(*) into n from public.notifications where user_id = prov and type = 'new_message';
  if n <> 1 then fails := fails || ('message notification count=' || n); end if;
  checks := checks + 1;
  if public.mark_messages_read(conv) <> 1 then fails := fails || 'mark_messages_read'; end if;

  ---------------------------------------------------------------- 3) agreement
  perform set_config('request.jwt.claims', json_build_object('sub', req, 'role', 'authenticated')::text, true);
  ag := public.request_agreement(conv, 4000);
  checks := checks + 1;
  if ag.state <> 'pending' or ag.commission_amount <> 200 then fails := fails || format('agreement %s/%s', ag.state, ag.commission_amount); end if;

  checks := checks + 1;
  begin perform public.respond_agreement(ag.id, true); fails := fails || 'requester approved for provider';
  exception when others then null; end;

  perform set_config('request.jwt.claims', json_build_object('sub', prov, 'role', 'authenticated')::text, true);
  perform public.respond_agreement(ag.id, true);
  reset role;
  select available_balance into bal from public.wallets where user_id = prov;
  checks := checks + 1;
  if bal <> 800 then fails := fails || ('wallet after approval=' || bal); end if;
  set local role authenticated;

  ---------------------------------------------------------------- 4) completion + rating
  perform set_config('request.jwt.claims', json_build_object('sub', req, 'role', 'authenticated')::text, true);
  perform public.complete_request(rid);
  perform public.submit_rating(rid, 4, 'ok');
  checks := checks + 1;
  begin perform public.submit_rating(rid, 5); fails := fails || 'double rating allowed';
  exception when others then null; end;

  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  checks := checks + 1;
  begin perform public.submit_rating(rid, 5); fails := fails || 'stranger rated';
  exception when others then null; end;

  perform set_config('request.jwt.claims', json_build_object('sub', prov, 'role', 'authenticated')::text, true);
  select * into j from public.get_my_provider_jobs();
  checks := checks + 1;
  if j.request_state <> 'completed' or j.rating_received <> 4 then
    fails := fails || format('provider job %s/%s', j.request_state, j.rating_received);
  end if;

  reset role;
  checks := checks + 1;
  select completed_services_count into n from public.provider_profiles where user_id = prov;
  if n <> 1 then fails := fails || ('completed_services_count=' || n); end if;
  checks := checks + 1;
  if (select rating_avg from public.provider_profiles where user_id = prov) <> 4 then fails := fails || 'rating_avg'; end if;
  set local role authenticated;

  ---------------------------------------------------------------- 5) block enforcement (closed conversation is read-only afterwards,
  -- so check the block helper itself)
  perform set_config('request.jwt.claims', json_build_object('sub', req, 'role', 'authenticated')::text, true);
  insert into public.blocks(blocker_id, blocked_id) values (req, prov);
  checks := checks + 1;
  if not public.is_blocked_between(req, prov) then fails := fails || 'is_blocked_between false for the blocker'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  checks := checks + 1;
  if public.is_blocked_between(req, prov) then fails := fails || 'stranger can probe blocks'; end if;

  raise exception 'RESULT % (% checks, % failures)%',
    case when cardinality(fails) = 0 then 'PASS' else 'FAIL' end,
    checks, cardinality(fails),
    case when cardinality(fails) = 0 then '' else ': ' || array_to_string(fails, ' | ') end;
end $$;
