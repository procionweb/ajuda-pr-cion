create table if not exists public.hadron_option_locks (
  option_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  operator text not null,
  locked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hadron_option_locks enable row level security;

drop policy if exists hadron_option_locks_authenticated_read on public.hadron_option_locks;
create policy hadron_option_locks_authenticated_read
  on public.hadron_option_locks for select to authenticated using (true);

create or replace function public.acquire_hadron_option_lock(
  target_option_id text,
  target_operator text
)
returns table (acquired boolean, locked_by text)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_lock public.hadron_option_locks%rowtype;
begin
  insert into public.hadron_option_locks (option_id, user_id, operator)
  values (target_option_id, auth.uid(), target_operator)
  on conflict (option_id) do nothing;

  select * into current_lock
  from public.hadron_option_locks
  where option_id = target_option_id;

  if current_lock.user_id = auth.uid() then
    update public.hadron_option_locks
    set operator = target_operator, updated_at = now()
    where option_id = target_option_id;
    return query select true, target_operator;
  end if;

  return query select false, current_lock.operator;
end;
$$;

create or replace function public.release_hadron_option_lock(target_option_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.hadron_option_locks
  where option_id = target_option_id and user_id = auth.uid();
$$;

revoke all on function public.acquire_hadron_option_lock(text, text) from public;
revoke all on function public.release_hadron_option_lock(text) from public;
grant execute on function public.acquire_hadron_option_lock(text, text) to authenticated;
grant execute on function public.release_hadron_option_lock(text) to authenticated;
