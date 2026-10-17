// Diagnóstico de la conexión con Supabase. Uso: npm run verificar:supabase
// Lee .env.local, NO imprime claves y dice qué falta arreglar, en orden.
import { lookup } from "node:dns/promises";

try { process.loadEnvFile(".env.local"); } catch { console.log("⚠ No se pudo leer .env.local (se usa el entorno actual)\n"); }

const env = process.env;
let problemas = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const mal = (m, ayuda) => { problemas++; console.log(`  ✗ ${m}${ayuda ? `\n      → ${ayuda}` : ""}`); };
const aviso = (m) => console.log(`  ⚠ ${m}`);
const titulo = (t) => console.log(`\n${t}`);

/** Decodifica el payload de un JWT (sin verificarlo) solo para saber su rol. */
function rolDeJwt(k) {
  try { return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role; } catch { return null; }
}

titulo("1. Variables de entorno");
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const service = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
for (const [k, v] of [["NEXT_PUBLIC_SUPABASE_URL", url], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anon], ["SUPABASE_SERVICE_ROLE_KEY", service]]) {
  v ? ok(`${k} definida`) : mal(`${k} no está definida`, "Copiala de Supabase → Project Settings → API");
}
if (!url) process.exit(1);

titulo("2. Dirección del proyecto");
let host = "";
try { host = new URL(url).hostname; } catch { mal("La URL no es válida", "Debe verse así: https://abcdefghijklmnopqrst.supabase.co"); process.exit(1); }
const ref = host.replace(/\.supabase\.co$/, "");
/^[a-z]{20}$/.test(ref) ? ok(`El identificador del proyecto tiene el formato correcto (${ref.length} letras)`)
  : mal(`El identificador "${ref}" tiene ${ref.length} caracteres y debería tener 20 letras minúsculas`, "Probablemente esté incompleto o mal copiado.");
try { await lookup(host); ok(`El servidor ${host} existe (DNS resuelve)`); }
catch { mal(`El servidor ${host} NO existe (DNS no resuelve)`, "Corregí NEXT_PUBLIC_SUPABASE_URL. Si el proyecto fue borrado, creá uno nuevo en supabase.com."); console.log("\n✗ Sin servidor no se puede seguir. Corregí la URL y volvé a correr este comando."); process.exit(1); }

titulo("3. Claves");
const PELIGRO = "Esa variable viaja al navegador: cualquiera podría leer y borrar toda tu base. Reemplazala YA por la clave pública y rotá la secreta en Supabase.";
if (anon) {
  const r = rolDeJwt(anon);
  if (anon.startsWith("sb_publishable_")) ok("La clave pública es del formato nuevo (sb_publishable_…)");
  else if (anon.startsWith("sb_secret_") || r === "service_role") mal("¡PELIGRO! NEXT_PUBLIC_SUPABASE_ANON_KEY contiene una clave SECRETA", PELIGRO);
  else r === "anon" ? ok("La clave pública (anon, formato legado) es de rol anon") : mal("La clave pública no tiene un formato reconocido", "Copiala de Project Settings → API Keys.");
}
if (service) {
  const r = rolDeJwt(service);
  if (service.startsWith("sb_secret_")) ok("La clave secreta es del formato nuevo (sb_secret_…)");
  else r === "service_role" ? ok("La clave secreta (service_role, formato legado) es correcta")
    : mal("SUPABASE_SERVICE_ROLE_KEY no es una clave secreta", "Usá la clave 'secret' (o 'service_role' en la pestaña legado) de Project Settings → API Keys.");
}

const H = (k) => (k?.startsWith("sb_") ? { apikey: k } : { apikey: k, Authorization: `Bearer ${k}` });
async function get(path, key) {
  try { const res = await fetch(url + path, { headers: H(key), signal: AbortSignal.timeout(15000) }); return { status: res.status, body: await res.json().catch(() => null) }; }
  catch (e) { return { status: 0, error: e.message }; }
}

titulo("4. Conexión y autenticación");
const h = await get("/auth/v1/settings", anon);
if (h.status === 200) {
  ok("El servicio de autenticación responde");
  h.body?.disable_signup === true ? ok("Registro abierto DESACTIVADO (correcto: solo la inmobiliaria crea usuarios)")
    : mal("El registro abierto está ACTIVADO", "Supabase → Authentication → Sign In / Providers → desactivá 'Allow new users to sign up'.");
} else mal(`La autenticación no responde (HTTP ${h.status || h.error})`, "Revisá la clave anon y que el proyecto no esté pausado.");

titulo("5. Base de datos (requiere clave service_role)");
if (service) {
  const t = await get("/rest/v1/usuarios?select=id&limit=1", service);
  if (t.status === 200) ok("Migración 001 aplicada (existe la tabla usuarios)");
  else if (t.status === 404 || t.body?.code === "PGRST205") mal("La base todavía no está instalada", "Pegá supabase/setup_completo.sql en Supabase → SQL Editor y ejecutalo (docs/puesta-en-marcha.md, paso 2).");
  else mal(`No se pudo consultar la base (HTTP ${t.status || t.error})`, "Revisá la clave service_role.");

  if (t.status === 200) {
    const c = await get("/rest/v1/clientes?select=acceso_activo&limit=1", service);
    c.status === 200 ? ok("Migración 002 aplicada (roles y portal)") : mal("Falta la parte 002 (roles y portal)", "Pegá supabase/migrations/002_roles_y_portal.sql en el SQL Editor (es repetible).");

    const v = await get("/rest/v1/portal_alquileres_propietario?select=id&limit=1", service);
    v.status === 200 ? ok("Existe la vista del portal (portal_alquileres_propietario)") : mal("Falta la vista del portal", "Aplicá la migración 002 completa.");
    const bk = await get("/storage/v1/bucket", service);
    const nombres = Array.isArray(bk.body) ? bk.body.map((b) => b.name) : [];
    const faltan = ["propiedades", "pdfs", "documentos"].filter((n) => !nombres.includes(n));
    faltan.length === 0 ? ok("Existen los 3 buckets de archivos (propiedades, pdfs, documentos)") : mal(`Faltan buckets de archivos: ${faltan.join(", ")}`, "Se crean con la migración 002.");

    const u = await get("/rest/v1/usuarios?select=id&rol=eq.titular&activo=eq.true", service);
    Array.isArray(u.body) && u.body.length > 0 ? ok(`Hay ${u.body.length} usuario(s) titular activo(s)`)
      : mal("No hay ningún usuario titular", 'node scripts/crear-staff.mjs --email=... --nombre="..." --rol=titular');
  }
}

titulo("Resultado");
if (problemas === 0) console.log("✅ Todo en orden: la conexión y la configuración de seguridad están correctas.");
else console.log(`❌ ${problemas} problema(s) para resolver (arriba, en orden).`);
process.exit(problemas ? 1 : 0);
