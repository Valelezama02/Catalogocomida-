-- ════════════════════════════════════════════════════════════════
--  Despensa — grupo familiar
--  Pegar completo en Supabase → SQL Editor → New query → Run.
--  Se puede correr más de una vez sin dañar nada.
-- ════════════════════════════════════════════════════════════════

-- Familias: cada casa tiene un código para unirse (ej. K7P-4QX)
create table if not exists public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mi casa',
  join_code   text not null unique,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Miembros: quién es quién (cuenta con correo ↔ perfil de la casa)
create table if not exists public.members (
  family_id    uuid not null references public.families(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  email        text,
  person_id    text,                -- perfil en la app: rosita, tati, erica…
  role         text not null default 'member' check (role in ('admin', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Datos de la casa: productos, personas, compras, usos, conteos, planes…
-- Un registro por cosa; nunca se borra de verdad (deleted = true).
create table if not exists public.records (
  family_id   uuid not null references public.families(id) on delete cascade,
  kind        text not null check (kind in ('product', 'person', 'movement', 'receipt', 'plan', 'alias', 'settings', 'checked')),
  id          text not null,
  data        jsonb,
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (family_id, kind, id)
);
create index if not exists records_family_updated on public.records (family_id, updated_at);

-- La hora y el autor de cada cambio los pone el servidor
create or replace function public.records_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists records_stamp on public.records;
create trigger records_stamp before insert or update on public.records
  for each row execute function public.records_stamp();

-- ───────────── Ayudantes de permisos ─────────────
create or replace function public.is_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where family_id = fid and user_id = auth.uid());
$$;

create or replace function public.is_admin(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where family_id = fid and user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.new_join_code() returns text
language plpgsql set search_path = public as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- sin 0/O ni 1/I/L para no confundir
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    c := substr(c, 1, 3) || '-' || substr(c, 4, 3);
    exit when not exists (select 1 from families where join_code = c);
  end loop;
  return c;
end $$;

-- ───────────── Acciones ─────────────
-- Crear la familia (quien la crea queda como administradora)
create or replace function public.create_family(p_name text, p_display_name text, p_person_id text)
returns public.families
language plpgsql security definer set search_path = public as $$
declare f families;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  insert into families (name, join_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Mi casa'), new_join_code(), auth.uid())
  returning * into f;
  insert into members (family_id, user_id, display_name, email, person_id, role)
  values (f.id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Sin nombre'), auth.email(), p_person_id, 'admin');
  return f;
end $$;

-- Unirse con el código
create or replace function public.join_family(p_code text, p_display_name text, p_person_id text)
returns public.families
language plpgsql security definer set search_path = public as $$
declare f families;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select * into f from families where join_code = upper(trim(p_code));
  if not found then raise exception 'Ese código no existe. Revísalo con quien te lo pasó.'; end if;
  insert into members (family_id, user_id, display_name, email, person_id, role)
  values (f.id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'Sin nombre'), auth.email(), p_person_id, 'member')
  on conflict (family_id, user_id) do update
    set display_name = excluded.display_name, person_id = excluded.person_id;
  return f;
end $$;

-- Cambiar el código (si se filtró). Solo administradora.
create or replace function public.regenerate_join_code(fid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_admin(fid) then raise exception 'Solo la administradora puede cambiar el código'; end if;
  c := new_join_code();
  update families set join_code = c where id = fid;
  return c;
end $$;

-- Sacar a alguien de la familia. Solo administradora.
create or replace function public.remove_member(fid uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(fid) then raise exception 'Solo la administradora puede sacar personas'; end if;
  if uid = auth.uid() then raise exception 'No te puedes sacar a ti misma'; end if;
  delete from members where family_id = fid and user_id = uid;
end $$;

-- Dar o quitar permiso de administración. Solo administradora.
create or replace function public.set_member_role(fid uuid, uid uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(fid) then raise exception 'Solo la administradora puede cambiar permisos'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Permiso no válido'; end if;
  if uid = auth.uid() and p_role = 'member' then raise exception 'No te puedes quitar el permiso a ti misma'; end if;
  update members set role = p_role where family_id = fid and user_id = uid;
end $$;

-- ───────────── Seguridad: cada familia solo ve lo suyo ─────────────
alter table public.families enable row level security;
alter table public.members  enable row level security;
alter table public.records  enable row level security;

drop policy if exists "ver mi familia" on public.families;
create policy "ver mi familia" on public.families for select to authenticated using (public.is_member(id));

drop policy if exists "ver miembros de mi familia" on public.members;
create policy "ver miembros de mi familia" on public.members for select to authenticated using (public.is_member(family_id));

drop policy if exists "editar mi perfil" on public.members;
create policy "editar mi perfil" on public.members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "salir de la familia" on public.members;
create policy "salir de la familia" on public.members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "leer datos de mi familia" on public.records;
create policy "leer datos de mi familia" on public.records for select to authenticated using (public.is_member(family_id));

drop policy if exists "agregar datos a mi familia" on public.records;
create policy "agregar datos a mi familia" on public.records for insert to authenticated with check (public.is_member(family_id));

drop policy if exists "cambiar datos de mi familia" on public.records;
create policy "cambiar datos de mi familia" on public.records for update to authenticated
  using (public.is_member(family_id)) with check (public.is_member(family_id));

-- Permisos de tablas: nadie sin sesión entra; las familias y los permisos
-- solo se crean/cambian con las acciones de arriba.
revoke all on public.families, public.members, public.records from anon;
revoke all on public.families, public.members, public.records from authenticated;
grant select on public.families to authenticated;
grant select, delete on public.members to authenticated;
grant update (display_name, person_id) on public.members to authenticated;
grant select, insert, update on public.records to authenticated;

revoke all on function public.is_member(uuid), public.is_admin(uuid), public.new_join_code(),
  public.create_family(text, text, text), public.join_family(text, text, text),
  public.regenerate_join_code(uuid), public.remove_member(uuid, uuid),
  public.set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.is_member(uuid), public.is_admin(uuid),
  public.create_family(text, text, text), public.join_family(text, text, text),
  public.regenerate_join_code(uuid), public.remove_member(uuid, uuid),
  public.set_member_role(uuid, uuid, text) to authenticated;

-- Cambios en vivo: cuando alguien anota algo, los demás celulares se enteran
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
