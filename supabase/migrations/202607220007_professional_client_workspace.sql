-- Private professional workspace. Nothing in these tables is exposed to clients.

create table if not exists public.professional_client_contexts (
  relationship_id uuid primary key references public.professional_client_relationships(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'up_to_date' check (status in ('needs_attention', 'following', 'up_to_date')),
  next_review_on date,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, client_id)
);

create table if not exists public.professional_client_notes (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.professional_client_relationships(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professional_client_notes_owner_idx
  on public.professional_client_notes (professional_id, client_id, created_at desc);

alter table public.professional_client_contexts enable row level security;
alter table public.professional_client_notes enable row level security;
revoke all on table public.professional_client_contexts from public;
revoke all on table public.professional_client_notes from public;

drop policy if exists "professional_context_owner" on public.professional_client_contexts;
create policy "professional_context_owner"
on public.professional_client_contexts for all to authenticated
using (professional_id = (select auth.uid()))
with check (
  professional_id = (select auth.uid())
  and exists (
    select 1 from public.professional_client_relationships relationship
    where relationship.id = professional_client_contexts.relationship_id
      and relationship.professional_id = (select auth.uid())
      and relationship.client_id = professional_client_contexts.client_id
      and relationship.status = 'active'
  )
);

drop policy if exists "professional_notes_owner" on public.professional_client_notes;
create policy "professional_notes_owner"
on public.professional_client_notes for all to authenticated
using (professional_id = (select auth.uid()))
with check (
  professional_id = (select auth.uid())
  and exists (
    select 1 from public.professional_client_relationships relationship
    where relationship.id = professional_client_notes.relationship_id
      and relationship.professional_id = (select auth.uid())
      and relationship.client_id = professional_client_notes.client_id
      and relationship.status = 'active'
  )
);

create or replace function public.get_professional_client_workspace(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  relationship public.professional_client_relationships%rowtype;
begin
  select * into relationship
  from public.professional_client_relationships
  where professional_id = auth.uid() and client_id = p_client_id and status = 'active';
  if relationship.id is null then raise exception 'Active relationship not found'; end if;

  return jsonb_build_object(
    'context', (select to_jsonb(context) - 'professional_id' - 'client_id'
      from public.professional_client_contexts context
      where context.relationship_id = relationship.id),
    'notes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', note.id, 'body', note.body, 'createdAt', note.created_at, 'updatedAt', note.updated_at
    ) order by note.created_at desc)
      from public.professional_client_notes note
      where note.relationship_id = relationship.id), '[]'::jsonb)
  );
end;
$$;

create or replace function public.save_professional_client_context(
  p_client_id uuid, p_status text, p_next_review_on date default null, p_tags text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  relationship public.professional_client_relationships%rowtype;
  saved public.professional_client_contexts%rowtype;
begin
  if p_status not in ('needs_attention', 'following', 'up_to_date') then raise exception 'Invalid status'; end if;
  if coalesce(array_length(p_tags, 1), 0) > 12 then raise exception 'Too many tags'; end if;
  select * into relationship from public.professional_client_relationships
  where professional_id = auth.uid() and client_id = p_client_id and status = 'active';
  if relationship.id is null then raise exception 'Active relationship not found'; end if;

  insert into public.professional_client_contexts
    (relationship_id, professional_id, client_id, status, next_review_on, tags, updated_at)
  values
    (relationship.id, relationship.professional_id, relationship.client_id, p_status, p_next_review_on,
     coalesce((select array_agg(distinct left(trim(tag), 40)) from unnest(coalesce(p_tags, '{}')) tag where trim(tag) <> ''), '{}'), now())
  on conflict (relationship_id) do update set
    status = excluded.status, next_review_on = excluded.next_review_on, tags = excluded.tags, updated_at = now()
  returning * into saved;
  return to_jsonb(saved) - 'professional_id' - 'client_id';
end;
$$;

create or replace function public.create_professional_client_note(p_client_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  relationship public.professional_client_relationships%rowtype;
  saved public.professional_client_notes%rowtype;
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 5000 then raise exception 'Invalid note'; end if;
  select * into relationship from public.professional_client_relationships
  where professional_id = auth.uid() and client_id = p_client_id and status = 'active';
  if relationship.id is null then raise exception 'Active relationship not found'; end if;
  insert into public.professional_client_notes (relationship_id, professional_id, client_id, body)
  values (relationship.id, relationship.professional_id, relationship.client_id, trim(p_body))
  returning * into saved;
  return jsonb_build_object('id', saved.id, 'body', saved.body, 'createdAt', saved.created_at, 'updatedAt', saved.updated_at);
end;
$$;

create or replace function public.delete_professional_client_note(p_note_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.professional_client_notes
  where id = p_note_id and professional_id = auth.uid();
  if not found then raise exception 'Note not found'; end if;
end;
$$;

revoke all on function public.get_professional_client_workspace(uuid) from public;
revoke all on function public.save_professional_client_context(uuid, text, date, text[]) from public;
revoke all on function public.create_professional_client_note(uuid, text) from public;
revoke all on function public.delete_professional_client_note(uuid) from public;
grant execute on function public.get_professional_client_workspace(uuid) to authenticated;
grant execute on function public.save_professional_client_context(uuid, text, date, text[]) to authenticated;
grant execute on function public.create_professional_client_note(uuid, text) to authenticated;
grant execute on function public.delete_professional_client_note(uuid) to authenticated;

notify pgrst, 'reload schema';
