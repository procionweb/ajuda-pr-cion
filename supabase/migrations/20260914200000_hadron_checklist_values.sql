create table public.hadron_option_check_values (
  option_id text not null,
  check_id text not null,
  check1 boolean,
  check2 boolean,
  primary key(option_id,check_id)
);
alter table public.hadron_option_check_values enable row level security;
create policy checklist_staff_read on public.hadron_option_check_values for select to authenticated using(public.is_staff());
grant select on public.hadron_option_check_values to authenticated;
create function public.process_hadron_checklist(p_option_id text,p_column integer,p_values jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare item jsonb;
begin
  if not public.is_staff() then raise exception 'Acesso restrito.'; end if;
  if p_column not in (1,2) or p_column is null or jsonb_typeof(p_values) <> 'array' then raise exception 'Valores inválidos.'; end if;
  for item in select value from jsonb_array_elements(p_values) loop
    insert into public.hadron_option_check_values(option_id,check_id,check1,check2)
      values(p_option_id,item->>'check_id',case when p_column=1 then (item->>'checked')::boolean end,case when p_column=2 then (item->>'checked')::boolean end)
    on conflict(option_id,check_id) do update set
      check1=case when p_column=1 then excluded.check1 else hadron_option_check_values.check1 end,
      check2=case when p_column=2 then excluded.check2 else hadron_option_check_values.check2 end;
  end loop;
end;
$$;
revoke all on function public.process_hadron_checklist(text,integer,jsonb) from public;
grant execute on function public.process_hadron_checklist(text,integer,jsonb) to authenticated;
