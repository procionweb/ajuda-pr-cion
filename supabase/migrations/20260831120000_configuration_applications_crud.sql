insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-logos',
  'application-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists application_logos_public_read on storage.objects;
create policy application_logos_public_read
  on storage.objects for select
  using (bucket_id = 'application-logos');

drop policy if exists application_logos_authenticated_insert on storage.objects;
create policy application_logos_authenticated_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'application-logos');

drop policy if exists application_logos_authenticated_update on storage.objects;
create policy application_logos_authenticated_update
  on storage.objects for update to authenticated
  using (bucket_id = 'application-logos')
  with check (bucket_id = 'application-logos');

drop policy if exists application_logos_authenticated_delete on storage.objects;
create policy application_logos_authenticated_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'application-logos');

create or replace function public.configuration_application_save(
  application_id uuid,
  application_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
  clean_name text := nullif(trim(application_payload ->> 'name'), '');
  clean_type text := upper(nullif(trim(application_payload ->> 'app_type'), ''));
  clean_build text := nullif(trim(application_payload ->> 'build_version'), '');
  clean_database text := nullif(trim(application_payload ->> 'db_version'), '');
  clean_image text := nullif(trim(application_payload ->> 'image_url'), '');
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  if clean_name is null then
    raise exception 'Informe a descrição do aplicativo.';
  end if;

  if application_id is null then
    insert into public.auth_aplicativos (
      legacy_id,
      name,
      app_type,
      version,
      status,
      active,
      source_payload,
      crm_created_at,
      crm_updated_at
    ) values (
      'crm-' || gen_random_uuid()::text,
      clean_name,
      clean_type,
      clean_build,
      'Ativo',
      true,
      jsonb_strip_nulls(jsonb_build_object(
        'app_build_version', clean_build,
        'app_db_version', clean_database,
        'app_image', clean_image
      )),
      now(),
      now()
    )
    returning id into saved_id;
  else
    update public.auth_aplicativos
       set name = clean_name,
           app_type = clean_type,
           version = clean_build,
           source_payload = coalesce(source_payload, '{}'::jsonb)
             || jsonb_strip_nulls(jsonb_build_object(
               'app_build_version', clean_build,
               'app_db_version', clean_database,
               'app_image', clean_image
             )),
           crm_updated_at = now()
     where id = application_id
     returning id into saved_id;

    if saved_id is null then
      raise exception 'Aplicativo não encontrado.';
    end if;
  end if;

  return saved_id;
end;
$$;

create or replace function public.configuration_application_delete(application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'É necessário estar autenticado.';
  end if;

  delete from public.auth_aplicativos where id = application_id;
  if not found then
    raise exception 'Aplicativo não encontrado.';
  end if;
end;
$$;

revoke all on function public.configuration_application_save(uuid, jsonb) from public;
revoke all on function public.configuration_application_delete(uuid) from public;
grant execute on function public.configuration_application_save(uuid, jsonb) to authenticated;
grant execute on function public.configuration_application_delete(uuid) to authenticated;

notify pgrst, 'reload schema';
