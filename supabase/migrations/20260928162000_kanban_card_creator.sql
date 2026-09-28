create or replace function public.record_kanban_card_creator()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists record_kanban_card_creator on public.kanban_cards;
create trigger record_kanban_card_creator before insert on public.kanban_cards
for each row execute function public.record_kanban_card_creator();
