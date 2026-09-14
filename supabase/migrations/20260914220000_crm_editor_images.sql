create table public.crm_editor_images (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  filename text not null,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/jpg','image/webp','image/gif')),
  data_url text not null check (length(data_url) <= 14000000 and data_url ~ '^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$')
);
alter table public.crm_editor_images enable row level security;
create policy editor_image_read on public.crm_editor_images for select to authenticated using (public.is_staff());
create policy editor_image_insert on public.crm_editor_images for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
grant select, insert on public.crm_editor_images to authenticated;
