// Genera supabase/setup_completo.sql = 001 + 002 en UNA sola transacción (todo o nada).
// Uso: node scripts/generar-sql-completo.mjs      (o: npm run build:sql)
// Es el archivo que se pega en Supabase → SQL Editor al crear una cuenta/proyecto nuevo.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase");
const leer = (f) => readFileSync(join(raiz, "migrations", f), "utf8").trim();

const salida = `-- ################################################################
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
${leer("001_initial_schema.sql")}

-- ================================================================
-- PARTE 2 de 2 · ROLES DEL EQUIPO, PORTAL DE CLIENTES Y ALMACENAMIENTO
-- ================================================================
${leer("002_roles_y_portal.sql")}

commit;
`;

writeFileSync(join(raiz, "setup_completo.sql"), salida);
console.log(`✓ supabase/setup_completo.sql generado (${salida.split("\n").length} líneas)`);
