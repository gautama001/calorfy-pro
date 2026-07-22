-- Actionable professional portfolio read model.
-- Signals remain permission-aware and never infer a medical diagnosis.

create table if not exists public.professional_client_sync_state (
  relationship_id uuid primary key references public.professional_client_relationships(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('weight', 'goals', 'diary', 'permissions', 'relationship')),
  updated_at timestamptz not null default now()
);

alter table public.professional_client_sync_state enable row level security;
revoke all on table public.professional_client_sync_state from public;
grant select on table public.professional_client_sync_state to authenticated;

drop policy if exists "professional_sync_select_participant" on public.professional_client_sync_state;
create policy "professional_sync_select_participant"
on public.professional_client_sync_state for select to authenticated
using (
  exists (
    select 1 from public.professional_client_relationships relationship
    where relationship.id = professional_client_sync_state.relationship_id
      and relationship.status = 'active'
      and (select auth.uid()) in (relationship.professional_id, relationship.client_id)
  )
);

create or replace function public.touch_professional_client_sync_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_user_id uuid;
  affected_event_type text;
begin
  if tg_table_name = 'weight_entries' then
    affected_user_id := coalesce(new.user_id, old.user_id);
    affected_event_type := 'weight';
  elsif tg_table_name = 'user_goals' then
    affected_user_id := coalesce(new.user_id, old.user_id);
    affected_event_type := 'goals';
  elsif tg_table_name = 'meals' then
    affected_user_id := coalesce(new.user_id, old.user_id);
    affected_event_type := 'diary';
  end if;

  insert into public.professional_client_sync_state (relationship_id, client_id, event_type, updated_at)
  select relationship.id, relationship.client_id, affected_event_type, now()
  from public.professional_client_relationships relationship
  where relationship.client_id = affected_user_id and relationship.status = 'active'
  on conflict (relationship_id) do update
  set event_type = excluded.event_type, updated_at = excluded.updated_at;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists professional_sync_weight on public.weight_entries;
create trigger professional_sync_weight
after insert or update or delete on public.weight_entries
for each row execute function public.touch_professional_client_sync_state();

drop trigger if exists professional_sync_goals on public.user_goals;
create trigger professional_sync_goals
after insert or update or delete on public.user_goals
for each row execute function public.touch_professional_client_sync_state();

drop trigger if exists professional_sync_diary on public.meals;
create trigger professional_sync_diary
after insert or update or delete on public.meals
for each row execute function public.touch_professional_client_sync_state();

create or replace function public.touch_professional_sync_from_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.professional_client_sync_state (relationship_id, client_id, event_type, updated_at)
  select relationship.id, relationship.client_id, 'permissions', now()
  from public.professional_client_relationships relationship
  where relationship.id = coalesce(new.relationship_id, old.relationship_id)
  on conflict (relationship_id) do update
  set event_type = excluded.event_type, updated_at = excluded.updated_at;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists professional_sync_permissions on public.professional_client_permissions;
create trigger professional_sync_permissions
after insert or update or delete on public.professional_client_permissions
for each row execute function public.touch_professional_sync_from_permissions();

insert into public.professional_client_sync_state (relationship_id, client_id, event_type, updated_at)
select relationship.id, relationship.client_id, 'relationship', relationship.updated_at
from public.professional_client_relationships relationship
where relationship.status = 'active'
on conflict (relationship_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'professional_client_sync_state'
  ) then
    alter publication supabase_realtime add table public.professional_client_sync_state;
  end if;
end;
$$;

drop function if exists public.get_professional_client_summaries();

create function public.get_professional_client_summaries()
returns table (
  relationship_id uuid,
  client_id uuid,
  display_name text,
  started_at timestamptz,
  share_diary boolean,
  share_weight boolean,
  share_goals boolean,
  share_photos boolean,
  current_weight_kg numeric,
  last_weight_on date,
  target_weight_kg numeric,
  calorie_goal integer,
  attention_status text,
  next_review_on date,
  tags text[],
  last_meal_at timestamptz,
  last_sync_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    relationship.id,
    relationship.client_id,
    coalesce(nullif(trim(profile.display_name), ''), 'Cliente Calorfy'),
    relationship.started_at,
    permission.share_diary,
    permission.share_weight,
    permission.share_goals,
    permission.share_photos,
    case when permission.share_weight then latest_weight.weight_kg else null end,
    case when permission.share_weight then latest_weight.measured_on else null end,
    case when permission.share_goals then goal.target_weight_kg else null end,
    case when permission.share_goals then goal.calorie_goal else null end,
    coalesce(context.status, 'up_to_date'),
    context.next_review_on,
    coalesce(context.tags, '{}'),
    case when permission.share_diary then latest_meal.eaten_at else null end,
    sync.updated_at
  from public.professional_client_relationships relationship
  join public.professional_client_permissions permission
    on permission.relationship_id = relationship.id
  left join public.profiles profile
    on profile.id = relationship.client_id
  left join public.user_goals goal
    on goal.user_id = relationship.client_id
  left join public.professional_client_contexts context
    on context.relationship_id = relationship.id
  left join public.professional_client_sync_state sync
    on sync.relationship_id = relationship.id
  left join lateral (
    select entry.weight_kg, entry.measured_on
    from public.weight_entries entry
    where entry.user_id = relationship.client_id
    order by entry.measured_on desc, entry.created_at desc
    limit 1
  ) latest_weight on true
  left join lateral (
    select meal.eaten_at
    from public.meals meal
    where meal.user_id = relationship.client_id
    order by meal.eaten_at desc
    limit 1
  ) latest_meal on true
  where relationship.professional_id = auth.uid()
    and relationship.status = 'active'
  order by relationship.updated_at desc;
$$;

revoke all on function public.get_professional_client_summaries() from public;
grant execute on function public.get_professional_client_summaries() to authenticated;
grant select on table public.professional_client_contexts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'professional_client_contexts'
  ) then
    alter publication supabase_realtime add table public.professional_client_contexts;
  end if;
end;
$$;

notify pgrst, 'reload schema';
