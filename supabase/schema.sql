-- Esquema consolidado de la base de datos de Delú Gastos (Supabase / Postgres).
-- Ya está aplicado en el proyecto "delu-gastos"; se guarda aquí como referencia.

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text,
  rol text not null default 'pendiente' check (rol in ('admin','registrador','pendiente')),
  creado_en timestamptz not null default now()
);

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color text not null default '#8a6d5b',
  icono text not null default '•',
  activa boolean not null default true,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

create table public.metodos_pago (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  orden int not null default 0
);

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default (now() at time zone 'America/Bogota')::date,
  monto numeric(14,2) not null check (monto > 0),
  categoria_id uuid references public.categorias(id) on delete set null,
  metodo_pago_id uuid references public.metodos_pago(id) on delete set null,
  proveedor text,
  descripcion text,
  factura_path text,
  creado_por uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index gastos_fecha_idx on public.gastos (fecha desc);
create index gastos_categoria_idx on public.gastos (categoria_id);
create index gastos_metodo_idx on public.gastos (metodo_pago_id);
create index gastos_creado_por_idx on public.gastos (creado_por);

-- Funciones de rol
create or replace function public.es_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol = 'admin');
$$;
create or replace function public.es_miembro() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.perfiles p where p.id = (select auth.uid()) and p.rol in ('admin','registrador'));
$$;
revoke execute on function public.es_admin() from public, anon;
revoke execute on function public.es_miembro() from public, anon;

-- Primer usuario = admin; los siguientes quedan pendientes hasta que el admin los apruebe
create or replace function public.crear_perfil() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre, email, rol)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'nombre',''), split_part(new.email,'@',1)),
          new.email,
          case when exists (select 1 from public.perfiles) then 'pendiente' else 'admin' end);
  return new;
end; $$;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.crear_perfil();

-- La aprobación del admin reemplaza la confirmación por correo
create or replace function public.autoconfirmar_email() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is null then new.email_confirmed_at = now(); end if;
  return new;
end; $$;
create trigger autoconfirmar before insert on auth.users for each row execute function public.autoconfirmar_email();

create or replace function public.tocar_actualizado() returns trigger language plpgsql set search_path = '' as $$
begin new.actualizado_en = now(); return new; end; $$;
create trigger gastos_actualizado before update on public.gastos for each row execute function public.tocar_actualizado();

-- Un admin no puede quitarse a sí mismo el rol
create or replace function public.proteger_admin() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.id = (select auth.uid()) and old.rol = 'admin' and new.rol <> 'admin' then
    raise exception 'No puedes quitarte el rol de administrador';
  end if;
  return new;
end; $$;
create trigger perfiles_proteger_admin before update on public.perfiles for each row execute function public.proteger_admin();

revoke execute on function public.crear_perfil() from public, anon, authenticated;
revoke execute on function public.autoconfirmar_email() from public, anon, authenticated;

-- Seguridad por filas
alter table public.perfiles enable row level security;
alter table public.categorias enable row level security;
alter table public.metodos_pago enable row level security;
alter table public.gastos enable row level security;

create policy "ver perfiles" on public.perfiles for select to authenticated using (id = (select auth.uid()) or (select public.es_admin()));
create policy "admin edita perfiles" on public.perfiles for update to authenticated using ((select public.es_admin())) with check ((select public.es_admin()));

create policy "leer categorias" on public.categorias for select to authenticated using ((select public.es_miembro()));
create policy "admin categorias ins" on public.categorias for insert to authenticated with check ((select public.es_admin()));
create policy "admin categorias upd" on public.categorias for update to authenticated using ((select public.es_admin()));
create policy "admin categorias del" on public.categorias for delete to authenticated using ((select public.es_admin()));
create policy "leer metodos" on public.metodos_pago for select to authenticated using ((select public.es_miembro()));
create policy "admin metodos ins" on public.metodos_pago for insert to authenticated with check ((select public.es_admin()));
create policy "admin metodos upd" on public.metodos_pago for update to authenticated using ((select public.es_admin()));
create policy "admin metodos del" on public.metodos_pago for delete to authenticated using ((select public.es_admin()));

create policy "ver gastos" on public.gastos for select to authenticated
  using ((select public.es_admin()) or ((select public.es_miembro()) and creado_por = (select auth.uid())));
create policy "crear gastos" on public.gastos for insert to authenticated
  with check ((select public.es_miembro()) and creado_por = (select auth.uid()));
create policy "editar gastos" on public.gastos for update to authenticated
  using ((select public.es_admin()) or ((select public.es_miembro()) and creado_por = (select auth.uid())));
create policy "borrar gastos" on public.gastos for delete to authenticated
  using ((select public.es_admin()) or ((select public.es_miembro()) and creado_por = (select auth.uid())));

-- Fotos de facturas (bucket privado, carpeta por usuario)
insert into storage.buckets (id, name, public) values ('facturas','facturas', false);
create policy "subir facturas" on storage.objects for insert to authenticated
  with check (bucket_id = 'facturas' and (select public.es_miembro()) and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "ver facturas" on storage.objects for select to authenticated
  using (bucket_id = 'facturas' and ((select public.es_admin()) or (storage.foldername(name))[1] = (select auth.uid())::text));
create policy "borrar facturas" on storage.objects for delete to authenticated
  using (bucket_id = 'facturas' and ((select public.es_admin()) or (storage.foldername(name))[1] = (select auth.uid())::text));

-- Datos iniciales
insert into public.categorias (nombre, color, icono, orden) values
 ('Mercancía','#b07d62','💎',1), ('Arriendo','#6b7f99','🏠',2), ('Servicios','#5f9e8f','💡',3),
 ('Nómina','#9a6fb0','👥',4), ('Pauta / Publicidad','#d1795b','📣',5), ('Transporte y envíos','#c9a24a','🚚',6),
 ('Empaques','#7fa35a','🎁',7), ('Papelería y aseo','#8f8f8f','🧴',8), ('Impuestos','#a85a5a','🧾',9), ('Otros','#7a6a5f','•',10);
insert into public.metodos_pago (nombre, orden) values
 ('Efectivo',1),('Transferencia',2),('Nequi',3),('Daviplata',4),('Tarjeta débito',5),('Tarjeta crédito',6);
