-- ================================================================
-- Verificación de la instalación (SOLO LECTURA: no modifica nada)
-- Pegar en Supabase → SQL Editor → Run. Devuelve una fila por control:
--   estado = OK      → está bien
--   estado = FALTA   → hay que resolverlo (ver docs/puesta-en-marcha.md)
-- ================================================================
select control, esperado, encontrado,
       case when encontrado = esperado then 'OK' else 'FALTA' end as estado
from (
  select 1 as orden, 'Tablas del sistema (parte 001)' as control, '23' as esperado,
         (select count(*)::text from pg_tables where schemaname = 'public') as encontrado
  union all
  select 2, 'Tablas SIN seguridad por fila (RLS)', '0',
         (select count(*)::text from pg_tables where schemaname = 'public' and not rowsecurity)
  union all
  select 3, 'Sucursales de ejemplo cargadas', '2', (select count(*)::text from public.sucursales)
  union all
  select 4, 'Comisiones por defecto cargadas', '1', (select count(*)::text from public.comisiones)
  union all
  select 5, 'Parte 002: columna clientes.acceso_activo', '1',
         (select count(*)::text from information_schema.columns
           where table_schema = 'public' and table_name = 'clientes' and column_name = 'acceso_activo')
  union all
  select 6, 'Parte 002: vista del portal del propietario', '1',
         (select count(*)::text from information_schema.views
           where table_schema = 'public' and table_name = 'portal_alquileres_propietario')
  union all
  select 7, 'Parte 002: funciones de rol (staff, titular, contable, cliente)', '4',
         (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('auth_is_staff', 'auth_is_titular', 'auth_is_contable', 'auth_cliente_id'))
  union all
  select 8, 'Parte 002: políticas titular_full (una por tabla)', '22',
         (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'titular_full')
  union all
  select 9, 'Parte 002: políticas antiguas staff_full eliminadas', '0',
         (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'staff_full')
  union all
  select 10, 'Buckets de archivos (propiedades, pdfs, documentos)', '3',
         (select count(*)::text from storage.buckets where id in ('propiedades', 'pdfs', 'documentos'))
  union all
  select 11, 'Políticas de almacenamiento del proyecto', '5',
         (select count(*)::text from pg_policies where schemaname = 'storage' and policyname in (
             'storage_staff_documentos', 'storage_staff_propiedades', 'storage_propiedades_publico',
             'storage_cliente_documentos', 'storage_cliente_pdfs'))
) c
order by orden;
