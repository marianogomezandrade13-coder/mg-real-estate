-- ================================================================
-- 002 · Roles del equipo, políticas del portal y almacenamiento
-- Ejecutar DESPUÉS de 001_initial_schema.sql:
--   DATABASE_URL="postgresql://..." node scripts/run-migration.mjs 002_roles_y_portal.sql
-- (o pegar en Supabase → SQL Editor). Es idempotente: se puede correr más de una vez.
--
-- Modelo de acceso:
--   · STAFF   → tabla `usuarios`  (rol titular | contable)  → panel interno
--   · CLIENTE → tabla `clientes`  (tipo propietario | inquilino) → portal
--   Un mismo login (auth.users) es de una sola de las dos familias. La barrera
--   real es RLS: aunque alguien manipule la interfaz, la base no le entrega
--   filas que no le corresponden.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Funciones auxiliares endurecidas (search_path fijo)
-- ----------------------------------------------------------------
create or replace function auth_is_staff()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from usuarios where auth_id = auth.uid() and activo = true);
$$;

create or replace function auth_is_titular()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from usuarios where auth_id = auth.uid() and rol = 'titular' and activo = true);
$$;

create or replace function auth_is_contable()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from usuarios where auth_id = auth.uid() and rol = 'contable' and activo = true);
$$;

create or replace function auth_cliente_id()
returns uuid language sql security definer stable set search_path = public as $$
  select id from clientes where auth_id = auth.uid() limit 1;
$$;

-- ----------------------------------------------------------------
-- 2. Staff: el TITULAR ve y modifica todo; el CONTABLE solo finanzas
--    (Finanzas, Caja, Liquidaciones, Recibos) y LEE el resto. No accede
--    a usuarios, comisiones ni auditoría.
-- ----------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'sucursales','usuarios','clientes','propiedades','propiedad_medios','leads','lead_actividades',
    'captaciones','tasaciones','contratos','firmas','alquileres','indices','liquidaciones','recibos',
    'caja_cierres','movimientos_caja','movimientos_finanzas','documentos','eventos_agenda','comisiones','auditoria'
  ] loop
    execute format('drop policy if exists "staff_full" on %I', t);
    execute format('drop policy if exists "titular_full" on %I', t);
    execute format('create policy "titular_full" on %I for all to authenticated using (auth_is_titular()) with check (auth_is_titular())', t);
  end loop;

  -- Contable: lectura general
  foreach t in array array[
    'sucursales','clientes','propiedades','propiedad_medios','leads','lead_actividades','captaciones',
    'tasaciones','contratos','firmas','alquileres','indices','documentos','eventos_agenda'
  ] loop
    execute format('drop policy if exists "contable_read" on %I', t);
    execute format('create policy "contable_read" on %I for select to authenticated using (auth_is_contable())', t);
  end loop;

  -- Contable: control total de sus módulos
  foreach t in array array['liquidaciones','recibos','caja_cierres','movimientos_caja','movimientos_finanzas'] loop
    execute format('drop policy if exists "contable_full" on %I', t);
    execute format('create policy "contable_full" on %I for all to authenticated using (auth_is_contable()) with check (auth_is_contable())', t);
  end loop;
end $$;

-- Cada persona debe poder leer SU PROPIA fila para saber qué rol tiene
drop policy if exists "usuarios_self_read" on usuarios;
create policy "usuarios_self_read" on usuarios for select to authenticated using (auth_id = auth.uid());

drop policy if exists "clientes_self_read" on clientes;
create policy "clientes_self_read" on clientes for select to authenticated using (auth_id = auth.uid());

-- ----------------------------------------------------------------
-- 3. Documentos: el cliente solo ve lo que el equipo marcó como "cliente"
-- ----------------------------------------------------------------
alter table documentos drop constraint if exists documentos_permiso_check;
alter table documentos add constraint documentos_permiso_check
  check (permiso in ('privado','equipo','solo_lectura','cliente'));

drop policy if exists "propietario_documentos" on documentos;
create policy "propietario_documentos" on documentos for select to authenticated using (
  permiso = 'cliente' and (
    vinculado_a in (select codigo from propiedades where propietario_id = auth_cliente_id())
    or vinculado_a = auth_cliente_id()::text
  )
);

drop policy if exists "inquilino_documentos" on documentos;
create policy "inquilino_documentos" on documentos for select to authenticated using (
  permiso = 'cliente' and (
    vinculado_a = auth_cliente_id()::text
    or vinculado_a in (
      select p.codigo from propiedades p join alquileres a on a.propiedad_id = p.id
      where a.inquilino_id = auth_cliente_id()
    )
  )
);

-- ----------------------------------------------------------------
-- 4. Propietario: solo sus liquidaciones ya aprobadas o pagadas
-- ----------------------------------------------------------------
drop policy if exists "propietario_liquidaciones" on liquidaciones;
create policy "propietario_liquidaciones" on liquidaciones for select to authenticated using (
  propietario_id = auth_cliente_id() and estado in ('Aprobada','Pagada')
);

-- ----------------------------------------------------------------
-- 5. Inquilino: puede ver la propiedad que alquila (y solo esa)
-- ----------------------------------------------------------------
drop policy if exists "inquilino_propiedad" on propiedades;
create policy "inquilino_propiedad" on propiedades for select to authenticated using (
  id in (select propiedad_id from alquileres where inquilino_id = auth_cliente_id())
);

-- ----------------------------------------------------------------
-- 6. Vista para el propietario: alquileres de SUS propiedades con el
--    nombre del inquilino y NADA más (sin DNI, teléfono ni email).
-- ----------------------------------------------------------------
create or replace view portal_alquileres_propietario as
select a.id, a.propiedad_id, a.canon, a.proximo_ajuste, a.indice, a.estado_pago, a.dias_mora,
       (c.nombre || ' ' || c.apellido) as inquilino
from alquileres a
join clientes c on c.id = a.inquilino_id
where a.propietario_id = auth_cliente_id();

revoke all on portal_alquileres_propietario from anon, public;
grant select on portal_alquileres_propietario to authenticated;

-- ----------------------------------------------------------------
-- 7. Storage: buckets y políticas
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('propiedades', 'propiedades', true),
  ('pdfs', 'pdfs', false),
  ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists "storage_staff_documentos" on storage.objects;
create policy "storage_staff_documentos" on storage.objects for all to authenticated
  using (bucket_id in ('documentos','pdfs') and auth_is_staff())
  with check (bucket_id in ('documentos','pdfs') and auth_is_staff());

drop policy if exists "storage_staff_propiedades" on storage.objects;
create policy "storage_staff_propiedades" on storage.objects for all to authenticated
  using (bucket_id = 'propiedades' and auth_is_staff())
  with check (bucket_id = 'propiedades' and auth_is_staff());

drop policy if exists "storage_propiedades_publico" on storage.objects;
create policy "storage_propiedades_publico" on storage.objects for select to anon, authenticated
  using (bucket_id = 'propiedades');

-- El cliente descarga solo archivos cuyo registro en `documentos` puede ver
-- (la subconsulta ya está filtrada por las políticas de arriba).
drop policy if exists "storage_cliente_documentos" on storage.objects;
create policy "storage_cliente_documentos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and exists (select 1 from documentos d where d.storage_path = storage.objects.name));

-- ----------------------------------------------------------------
-- 8. Índices que sostienen las políticas (evitan escaneos completos)
-- ----------------------------------------------------------------
create index if not exists idx_propiedades_propietario on propiedades (propietario_id);
create index if not exists idx_alquileres_inquilino    on alquileres (inquilino_id);
create index if not exists idx_alquileres_propietario  on alquileres (propietario_id);
create index if not exists idx_liquidaciones_propietario on liquidaciones (propietario_id);
create index if not exists idx_recibos_cliente         on recibos (cliente_id);
create index if not exists idx_documentos_vinculado    on documentos (vinculado_a);

-- ----------------------------------------------------------------
-- 9. Suspensión inmediata de accesos de clientes
--    Si `acceso_activo = false`, auth_cliente_id() devuelve NULL y TODAS las
--    políticas del portal dejan de entregar filas al instante (no hay que
--    esperar a que expire la sesión).
-- ----------------------------------------------------------------
alter table clientes add column if not exists acceso_activo boolean not null default true;

create or replace function auth_cliente_id()
returns uuid language sql security definer stable set search_path = public as $$
  select id from clientes where auth_id = auth.uid() and acceso_activo = true limit 1;
$$;

-- ----------------------------------------------------------------
-- 10. Descarga de PDFs del portal (bucket "pdfs"): el cliente solo puede
--     leer los archivos de SUS liquidaciones, recibos y contratos. Las
--     subconsultas se evalúan con las políticas del propio usuario.
-- ----------------------------------------------------------------
drop policy if exists "storage_cliente_pdfs" on storage.objects;
create policy "storage_cliente_pdfs" on storage.objects for select to authenticated
  using (
    bucket_id = 'pdfs' and (
      exists (select 1 from liquidaciones l where l.pdf_url = storage.objects.name)
      or exists (select 1 from recibos r where r.pdf_url = storage.objects.name)
      or exists (select 1 from contratos c where c.pdf_url = storage.objects.name)
    )
  );
