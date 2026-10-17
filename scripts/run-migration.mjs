import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Uso: DATABASE_URL="postgresql://..." node scripts/run-migration.mjs [setup_completo.sql | 002_roles_y_portal.sql]
// La cadena de conexión NUNCA va escrita en el código: se toma de la variable de entorno.
const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ Falta la variable de entorno DATABASE_URL (cadena de conexión de Supabase → Settings → Database).");
  process.exit(1);
}

// Acepta el nombre de una migración (001_initial_schema.sql) o "setup_completo.sql" (instalación completa).
const archivo = process.argv[2] ?? "setup_completo.sql";
const candidatos = [join(__dirname, "../supabase/migrations", archivo), join(__dirname, "../supabase", archivo)];
const ruta = candidatos.find((r) => existsSync(r));
if (!ruta) { console.error(`✗ No encuentro "${archivo}" en supabase/ ni en supabase/migrations/`); process.exit(1); }
const sql = readFileSync(ruta, "utf8");
const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("✓ Conectado a Supabase");
  await client.query(sql);
  console.log(`✓ ${archivo} ejecutado correctamente`);
} catch (err) {
  console.error("✗ Error:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
