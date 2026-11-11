-- 003 · Evitar duplicados (opcional, recomendado). Ejecutar UNA vez en Supabase → SQL Editor.
-- Si algún comando falla con "could not create unique index", es porque ya hay datos repetidos:
-- primero hay que borrar el duplicado desde el panel y volver a correrlo.

-- Una propiedad no puede tener dos alquileres activos a la vez.
create unique index if not exists alquileres_una_por_propiedad on alquileres (propiedad_id);

-- Un mismo período no puede liquidarse dos veces para la misma propiedad.
create unique index if not exists liquidaciones_periodo_propiedad on liquidaciones (propiedad_id, periodo);

-- El código de propiedad ya es único; se refuerza sin distinguir mayúsculas.
create unique index if not exists propiedades_codigo_ci on propiedades (upper(codigo));

-- Un mismo email no se repite entre clientes (los vacíos no cuentan).
create unique index if not exists clientes_email_unico on clientes (lower(email)) where email is not null and email <> '';
