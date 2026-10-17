-- ################################################################
--  MG REAL ESTATE · INSTALACIÓN COMPLETA DE LA BASE DE DATOS
--  (generado con "npm run build:sql" a partir de las migraciones 001 + 002;
--   no lo edites a mano: cambiá las migraciones y volvé a generarlo)
--
--  CÓMO USARLO (proyecto de Supabase NUEVO y VACÍO):
--    1. Supabase → SQL Editor → "New query".
--    2. Pegá TODO este archivo y apretá "Run".
--    3. Si aparece un aviso de "operaciones destructivas" (por los DROP POLICY IF EXISTS
--       de la parte 002) es normal: en un proyecto vacío no hay nada que perder.
--    4. Debe terminar con "Success". Si algo falla, NO queda nada a medias
--       (todo corre en una transacción): corregí el error y volvé a ejecutar.
--
--  NO lo ejecutes dos veces: la parte 001 crea tablas y fallará si ya existen.
-- ################################################################

begin;

-- ================================================================
-- PARTE 1 de 2 · ESQUEMA (tablas + RLS + políticas base)
-- ================================================================
-- ================================================================
-- 001 · Esquema inicial — MG Real Estate
-- Tablas del sistema: sucursales, usuarios (equipo), clientes, propiedades, leads,
-- captaciones, tasaciones, contratos, alquileres, liquidaciones, recibos, caja,
-- finanzas, documentos, agenda, comisiones, favoritos y auditoría.
-- Incluye RLS activado en TODAS las tablas. Ejecutar antes de 002.
-- ================================================================

-- pg_cron (ajuste automático de alquileres) es OPCIONAL: si tu plan no lo permite,
-- el resto del esquema se instala igual. Se puede activar después en
-- Supabase → Database → Extensions.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron no se pudo activar (%). Se continúa sin él.', sqlerrm;
end $$;

-- ----------------------------------------------------------------
-- SUCURSALES
-- ----------------------------------------------------------------
create table sucursales (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  nombre        text not null,
  direccion     text,
  ciudad        text,
  provincia     text,
  principal     boolean default false
);

insert into sucursales (nombre, direccion, ciudad, provincia, principal)
values ('San Martín', 'Callejón Fernández 672', 'San Martín', 'Mendoza', true),
       ('Junín', null, 'Junín', 'Mendoza', false);

-- ----------------------------------------------------------------
-- USUARIOS (staff — espeja auth.users)
-- ----------------------------------------------------------------
create table usuarios (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  sucursal_id   uuid references sucursales(id),
  auth_id       uuid not null unique,
  nombre        text not null,
  email         text not null,
  rol           text not null check (rol in ('titular','contable')),
  activo        boolean default true
);

-- ----------------------------------------------------------------
-- CLIENTES (propietarios, inquilinos, leads)
-- ----------------------------------------------------------------
create table clientes (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  sucursal_id   uuid references sucursales(id),
  nombre        text not null,
  apellido      text not null,
  dni           text,
  cuit          text,
  telefono      text,
  whatsapp      text,
  email         text,
  direccion     text,
  tipo          text not null check (tipo in ('propietario','inquilino','lead','otro')),
  auth_id       uuid unique,   -- null si no tiene acceso al portal
  observaciones text
);

-- ----------------------------------------------------------------
-- PROPIEDADES
-- ----------------------------------------------------------------
create table propiedades (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  sucursal_id         uuid references sucursales(id),
  codigo              text unique not null,
  titulo              text not null,
  tipo                text not null check (tipo in ('Casa','Departamento','PH','Finca','Oficina','Local','Lote')),
  operacion           text not null check (operacion in ('Venta','Alquiler')),
  precio              numeric not null,
  moneda              text not null default 'USD' check (moneda in ('USD','ARS')),
  direccion           text,
  barrio              text,
  ciudad              text,
  provincia           text,
  lat                 numeric,
  lng                 numeric,
  ambientes           int,
  dormitorios         int,
  banos               int,
  cocheras            int,
  m2_cubiertos        numeric,
  m2_totales          numeric,
  antiguedad          int,
  estado_conservacion text,
  patio               boolean,
  expensas            numeric,
  descripcion         text,
  estado              text not null default 'Activa' check (estado in ('Activa','Reservada','Vendida','Alquilada')),
  publicada_web       boolean not null default false,
  propietario_id      uuid references clientes(id),
  servicios           jsonb   -- {agua, gas, cloacas, internet, luz, pileta}
);

create table propiedad_medios (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  propiedad_id  uuid not null references propiedades(id) on delete cascade,
  tipo          text not null check (tipo in ('foto','video','plano','tour','adjunto')),
  url           text not null,
  orden         int not null default 0
);

-- ----------------------------------------------------------------
-- LEADS (CRM)
-- ----------------------------------------------------------------
create table leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  sucursal_id     uuid references sucursales(id),
  cliente_id      uuid references clientes(id),
  nombre          text not null,
  interes         text,
  propiedad_id    uuid references propiedades(id),
  valor_estimado  numeric,
  origen          text check (origen in ('Web','WhatsApp','Instagram','ZonaProp','Argenprop','Mercado Libre','Referido')),
  etapa           text not null default 'nuevo'
                  check (etapa in ('nuevo','contactado','visita','negociacion','reserva','cerrada')),
  asignado_a      uuid references usuarios(id)
);

create table lead_actividades (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  lead_id     uuid not null references leads(id) on delete cascade,
  tipo        text not null check (tipo in ('llamada','email','whatsapp','reunion','visita','nota')),
  detalle     text,
  fecha       timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- CAPTACIONES
-- ----------------------------------------------------------------
create table captaciones (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  sucursal_id     uuid references sucursales(id),
  cliente_id      uuid not null references clientes(id),
  direccion       text not null,
  tipo            text not null,
  operacion       text not null check (operacion in ('Venta','Alquiler')),
  valor_pretendido numeric,
  etapa           text not null default 'Pendiente'
                  check (etapa in ('Pendiente','Tasando','Negociando','Autorizada','Publicada')),
  proxima_accion  text
);

-- ----------------------------------------------------------------
-- TASACIONES
-- ----------------------------------------------------------------
create table tasaciones (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  sucursal_id         uuid references sucursales(id),
  numero              text not null,   -- INF-AAAA-NNN
  propiedad_ref       text,
  direccion           text not null,
  tipo                text not null,
  estado_conservacion text,
  zona                text,
  m2_terreno          numeric,
  m2_cubierto         numeric,
  precio_m2_terreno   numeric,
  precio_m2_cubierto  numeric,
  antiguedad_anios    int,
  score_transporte    int check (score_transporte between 1 and 5),
  score_servicios     int check (score_servicios between 1 and 5),
  score_seguridad     int check (score_seguridad between 1 and 5),
  score_entorno       int check (score_entorno between 1 and 5),
  valor_min           numeric,
  valor_recomendado   numeric,
  valor_optimo        numeric,
  valor_final         numeric,
  observaciones       text,
  pdf_url             text
);

-- ----------------------------------------------------------------
-- CONTRATOS
-- ----------------------------------------------------------------
create table contratos (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  sucursal_id   uuid references sucursales(id),
  tipo          text not null
                check (tipo in ('alq_viv','alq_com','compraventa','comodato','reserva','admin')),
  propiedad_id  uuid references propiedades(id),
  parte_a_id    uuid not null references clientes(id),
  parte_b_id    uuid not null references clientes(id),
  monto         numeric,
  moneda        text not null default 'ARS' check (moneda in ('USD','ARS')),
  indice_ajuste text check (indice_ajuste in ('ICL','IPC','CasaPropia','Anual')),
  fecha_inicio  date,
  fecha_fin     date,
  estado        text not null default 'borrador'
                check (estado in ('borrador','enviado','firmado')),
  pdf_url       text,
  cuerpo        jsonb
);

create table firmas (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  contrato_id  uuid not null references contratos(id) on delete cascade,
  firmante     text not null,
  fecha        date not null,
  hora         time not null,
  ip           text,
  usuario      text
);

-- ----------------------------------------------------------------
-- ALQUILERES (contrato vigente)
-- ----------------------------------------------------------------
create table alquileres (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  sucursal_id      uuid references sucursales(id),
  contrato_id      uuid not null references contratos(id),
  propiedad_id     uuid not null references propiedades(id),
  inquilino_id     uuid not null references clientes(id),
  propietario_id   uuid not null references clientes(id),
  canon            numeric not null,
  proximo_ajuste   date not null,
  indice           text not null check (indice in ('ICL','IPC','CasaPropia','Anual')),
  dia_vencimiento  int not null default 10,
  estado_pago      text not null default 'al_dia'
                   check (estado_pago in ('al_dia','pendiente','vencido')),
  dias_mora        int not null default 0
);

-- ----------------------------------------------------------------
-- ÍNDICES (ICL, IPC, Casa Propia) — para ajuste automático
-- ----------------------------------------------------------------
create table indices (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  fecha       date not null,
  tipo        text not null check (tipo in ('ICL','IPC','CasaPropia')),
  valor       numeric not null,
  unique(fecha, tipo)
);

-- ----------------------------------------------------------------
-- LIQUIDACIONES
-- ----------------------------------------------------------------
create table liquidaciones (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  sucursal_id      uuid references sucursales(id),
  propietario_id   uuid not null references clientes(id),
  propiedad_id     uuid not null references propiedades(id),
  periodo          text not null,   -- ej. "2025-06"
  alquiler_cobrado numeric not null,
  comision         numeric not null,
  gastos           numeric not null default 0,
  retencion        numeric not null default 0,
  neto             numeric not null,
  estado           text not null default 'Pendiente'
                   check (estado in ('Pendiente','Aprobada','Pagada')),
  pdf_url          text
);

-- ----------------------------------------------------------------
-- RECIBOS
-- ----------------------------------------------------------------
create table recibos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  sucursal_id uuid references sucursales(id),
  numero      text not null,   -- #0001
  cliente_id  uuid not null references clientes(id),
  concepto    text not null,
  honorarios  numeric not null,
  iva         numeric not null default 0,
  total       numeric not null,
  moneda      text not null default 'ARS' check (moneda in ('USD','ARS')),
  qr_payload  text,
  pdf_url     text,
  enviado_por text check (enviado_por in ('email','whatsapp')),
  fecha       date not null default current_date
);

-- ----------------------------------------------------------------
-- CAJA DIARIA
-- ----------------------------------------------------------------
create table caja_cierres (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  sucursal_id      uuid references sucursales(id),
  fecha            date not null,
  apertura         numeric not null default 0,
  total_ingresos   numeric not null default 0,
  total_egresos    numeric not null default 0,
  saldo            numeric not null default 0,
  tipo             text not null default 'diario' check (tipo in ('diario','mensual'))
);

create table movimientos_caja (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  sucursal_id uuid references sucursales(id),
  fecha       date not null default current_date,
  hora        time not null default current_time,
  concepto    text not null,
  categoria   text,
  medio       text not null check (medio in ('efectivo','transferencia','cheque','tarjeta')),
  monto       numeric not null,
  es_ingreso  boolean not null,
  cierre_id   uuid references caja_cierres(id)
);

-- ----------------------------------------------------------------
-- FINANZAS
-- ----------------------------------------------------------------
create table movimientos_finanzas (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  sucursal_id uuid references sucursales(id),
  concepto    text not null,
  fecha       date not null default current_date,
  categoria   text not null,
  monto       numeric not null,
  moneda      text not null default 'ARS' check (moneda in ('USD','ARS')),
  es_ingreso  boolean not null
);

-- ----------------------------------------------------------------
-- DOCUMENTOS
-- ----------------------------------------------------------------
create table documentos (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  sucursal_id  uuid references sucursales(id),
  nombre       text not null,
  categoria    text not null
               check (categoria in ('contratos','escrituras','tasaciones','recibos','dni','comprobantes')),
  vinculado_a  text,
  storage_path text not null,
  version      int not null default 1,
  permiso      text not null default 'equipo'
               check (permiso in ('privado','equipo','solo_lectura')),
  subido_por   uuid references usuarios(id)
);

-- ----------------------------------------------------------------
-- AGENDA
-- ----------------------------------------------------------------
create table eventos_agenda (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  sucursal_id     uuid references sucursales(id),
  titulo          text not null,
  fecha           date not null,
  hora            time not null,
  tipo            text not null check (tipo in ('visita','cobro','renovacion','reunion')),
  propiedad_id    uuid references propiedades(id),
  cliente_id      uuid references clientes(id),
  google_event_id text
);

-- ----------------------------------------------------------------
-- COMISIONES (config por sucursal o global)
-- ----------------------------------------------------------------
create table comisiones (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  sucursal_id         uuid references sucursales(id),
  admin_alquiler_pct  numeric not null default 10,
  venta_pct           numeric not null default 6,
  tasacion_pct        numeric not null default 1
);

-- Insertar configuración default
insert into comisiones (admin_alquiler_pct, venta_pct, tasacion_pct)
values (10, 6, 1);

-- ----------------------------------------------------------------
-- FAVORITOS (sitio público)
-- ----------------------------------------------------------------
create table favoritos (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  cliente_id   uuid references clientes(id),
  session_key  text,
  propiedad_id uuid not null references propiedades(id) on delete cascade,
  unique(cliente_id, propiedad_id),
  unique(session_key, propiedad_id)
);

-- ----------------------------------------------------------------
-- AUDITORÍA
-- ----------------------------------------------------------------
create table auditoria (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  usuario_id  uuid references usuarios(id),
  accion      text not null,
  entidad     text not null,
  entidad_id  uuid,
  payload     jsonb,
  fecha       timestamptz not null default now()
);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

alter table sucursales          enable row level security;
alter table usuarios            enable row level security;
alter table clientes            enable row level security;
alter table propiedades         enable row level security;
alter table propiedad_medios    enable row level security;
alter table leads               enable row level security;
alter table lead_actividades    enable row level security;
alter table captaciones         enable row level security;
alter table tasaciones          enable row level security;
alter table contratos           enable row level security;
alter table firmas              enable row level security;
alter table alquileres          enable row level security;
alter table indices             enable row level security;
alter table liquidaciones       enable row level security;
alter table recibos             enable row level security;
alter table caja_cierres        enable row level security;
alter table movimientos_caja    enable row level security;
alter table movimientos_finanzas enable row level security;
alter table documentos          enable row level security;
alter table eventos_agenda      enable row level security;
alter table comisiones          enable row level security;
alter table favoritos           enable row level security;
alter table auditoria           enable row level security;

-- Helper: saber si el usuario autenticado es staff (titular o contable)
create or replace function auth_is_staff()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from usuarios
    where auth_id = auth.uid() and activo = true
  );
$$;

-- Helper: saber si el usuario autenticado es titular
create or replace function auth_is_titular()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from usuarios
    where auth_id = auth.uid() and rol = 'titular' and activo = true
  );
$$;

-- Helper: obtener el cliente_id del usuario autenticado (portal)
create or replace function auth_cliente_id()
returns uuid language sql security definer stable as $$
  select id from clientes where auth_id = auth.uid() limit 1;
$$;

-- ----------------------------------------------------------------
-- Políticas: STAFF ve todo
-- ----------------------------------------------------------------
create policy "staff_full" on sucursales           for all using (auth_is_staff());
create policy "staff_full" on usuarios             for all using (auth_is_staff());
create policy "staff_full" on clientes             for all using (auth_is_staff());
create policy "staff_full" on propiedades          for all using (auth_is_staff());
create policy "staff_full" on propiedad_medios     for all using (auth_is_staff());
create policy "staff_full" on leads                for all using (auth_is_staff());
create policy "staff_full" on lead_actividades     for all using (auth_is_staff());
create policy "staff_full" on captaciones          for all using (auth_is_staff());
create policy "staff_full" on tasaciones           for all using (auth_is_staff());
create policy "staff_full" on contratos            for all using (auth_is_staff());
create policy "staff_full" on firmas               for all using (auth_is_staff());
create policy "staff_full" on alquileres           for all using (auth_is_staff());
create policy "staff_full" on indices              for all using (auth_is_staff());
create policy "staff_full" on liquidaciones        for all using (auth_is_staff());
create policy "staff_full" on recibos              for all using (auth_is_staff());
create policy "staff_full" on caja_cierres         for all using (auth_is_staff());
create policy "staff_full" on movimientos_caja     for all using (auth_is_staff());
create policy "staff_full" on movimientos_finanzas for all using (auth_is_staff());
create policy "staff_full" on documentos           for all using (auth_is_staff());
create policy "staff_full" on eventos_agenda       for all using (auth_is_staff());
create policy "staff_full" on comisiones           for all using (auth_is_staff());
create policy "staff_full" on auditoria            for all using (auth_is_staff());

-- ----------------------------------------------------------------
-- Políticas: PROPIETARIO (portal)
-- ----------------------------------------------------------------
create policy "propietario_propiedades" on propiedades
  for select using (propietario_id = auth_cliente_id());

create policy "propietario_liquidaciones" on liquidaciones
  for select using (propietario_id = auth_cliente_id());

create policy "propietario_documentos" on documentos
  for select using (
    vinculado_a = (select codigo from propiedades where propietario_id = auth_cliente_id() limit 1)
    or vinculado_a = auth_cliente_id()::text
  );

-- ----------------------------------------------------------------
-- Políticas: INQUILINO (portal)
-- ----------------------------------------------------------------
create policy "inquilino_alquiler" on alquileres
  for select using (inquilino_id = auth_cliente_id());

create policy "inquilino_contrato" on contratos
  for select using (
    parte_a_id = auth_cliente_id() or parte_b_id = auth_cliente_id()
  );

create policy "inquilino_recibos" on recibos
  for select using (cliente_id = auth_cliente_id());

create policy "inquilino_documentos" on documentos
  for select using (vinculado_a = auth_cliente_id()::text);

-- ----------------------------------------------------------------
-- Propiedades publicadas: acceso público (sitio web)
-- ----------------------------------------------------------------
create policy "publico_propiedades_web" on propiedades
  for select using (publicada_web = true and estado = 'Activa');

create policy "publico_medios" on propiedad_medios
  for select using (
    exists (
      select 1 from propiedades
      where id = propiedad_id and publicada_web = true and estado = 'Activa'
    )
  );

-- Favoritos: cada sesión/usuario gestiona los suyos
create policy "favoritos_own" on favoritos
  for all using (
    cliente_id = auth_cliente_id()
    or (cliente_id is null and session_key is not null)
  );

-- Índices: lectura pública (usados por el sitio y el portal)
create policy "indices_read" on indices for select using (true);

-- ================================================================
-- STORAGE BUCKETS
-- ================================================================
-- Ejecutar manualmente en Supabase → Storage o vía API:
--
-- insert into storage.buckets (id, name, public)
--   values ('propiedades', 'propiedades', true),
--          ('pdfs', 'pdfs', false),
--          ('documentos', 'documentos', false);

-- ================================================================
-- CRON JOB — Ajuste automático de alquileres (pg_cron)  ·  PLANTILLA, NO ESTÁ ACTIVO
-- Requiere habilitar pg_cron en Supabase → Database → Extensions y confirmar cómo se
-- guarda cada índice en `indices.valor` (acá se asume que es el factor de ajuste).
-- ================================================================
-- select cron.schedule(
--   'ajuste-alquileres',
--   '0 8 * * *',   -- todos los días a las 08:00 UTC
--   $$
--     update alquileres a
--     set
--       canon          = a.canon * i.valor,
--       proximo_ajuste = a.proximo_ajuste + interval '3 months'
--     from indices i
--     where a.proximo_ajuste <= current_date
--       and i.tipo = a.indice
--       and i.fecha = (select max(fecha) from indices where tipo = a.indice);
--   $$
-- );

-- ================================================================
-- PARTE 2 de 2 · ROLES DEL EQUIPO, PORTAL DE CLIENTES Y ALMACENAMIENTO
-- ================================================================
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

commit;
