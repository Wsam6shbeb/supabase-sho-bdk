-- سجل الطلبات يعرض الطلبات للطرفين، ويحدد الطرف الآخر حسب المستخدم الحالي.
create or replace function public.get_my_order_history_v2()
returns table(
  request_id uuid,
  description text,
  state text,
  region text,
  is_urgent boolean,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz,
  rating_deadline timestamptz,
  provider_id uuid,
  provider_name text,
  agreed_price numeric,
  commission_amount numeric,
  my_rating integer,
  my_comment text,
  my_tags text[],
  customer_id uuid,
  customer_name text,
  my_role text
)
language sql
security definer
set search_path = public
as $function$
  select
    sr.id,
    sr.raw_text,
    case
      when sr.state = 'cancelled' and exists (
        select 1 from public.reports rep
         where rep.request_id = sr.id and rep.reason = 'non_execution'
      ) then 'not_executed_review'
      else sr.state::text
    end,
    sr.region,
    sr.urgency::text = 'urgent',
    sr.created_at,
    sr.updated_at,
    sr.completed_at,
    case when sr.state = 'completion_pending_rating'
         then sr.completed_at + make_interval(hours => coalesce(
              (select (value)::text::integer from public.app_settings where key = 'rating_window_hours'), 48))
    end,
    a.provider_id,
    pu.full_name,
    a.price,
    a.commission_amount,
    r.score::int,
    r.comment,
    r.tags,
    sr.requester_id,
    cu.full_name,
    case when sr.requester_id = auth.uid() then 'customer' else 'provider' end
  from public.service_requests sr
  join lateral (
    select ag.*
      from public.agreements ag
     where ag.request_id = sr.id
       and (ag.requester_id = auth.uid() or ag.provider_id = auth.uid())
       and (
         ag.state = 'active'
         or (ag.state = 'cancelled' and exists (
           select 1 from public.reports rep
            where rep.request_id = sr.id and rep.reason = 'non_execution'
         ))
       )
     order by ag.created_at desc
     limit 1
  ) a on true
  left join public.users pu on pu.id = a.provider_id
  left join public.users cu on cu.id = sr.requester_id
  left join public.ratings r on r.request_id = sr.id and r.from_user_id = auth.uid()
  where auth.uid() is not null
    and (sr.requester_id = auth.uid() or a.provider_id = auth.uid())
    and sr.state in ('completion_pending_rating', 'completed', 'cancelled', 'expired')
  order by coalesce(sr.completed_at, sr.updated_at) desc;
$function$;

grant execute on function public.get_my_order_history_v2() to authenticated;
