// Crea un usuario del EQUIPO (acceso al panel): titular o contable.
//
//   node scripts/crear-staff.mjs --email=maria@ejemplo.com --nombre="María Gómez" --rol=titular
//
// - Lee las credenciales de Supabase de .env.local (nunca las escribas en este archivo).
// - Si no pasás --password, genera una segura y la muestra UNA sola vez.
// - Es el único camino para crear staff: el panel no permite auto-registro.
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

try { process.loadEnvFile(".env.local"); } catch { /* usa el entorno actual */ }

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const email = arg("email")?.trim().toLowerCase();
const nombre = arg("nombre")?.trim();
const rol = arg("rol") ?? "titular";
let password = arg("password");

if (!email || !nombre || !["titular", "contable"].includes(rol)) {
  console.error('Uso: node scripts/crear-staff.mjs --email=... --nombre="Nombre Apellido" --rol=titular|contable [--password=...]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"); process.exit(1); }

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
if (!password) {
  do { password = Array.from({ length: 14 }, () => ALFABETO[randomInt(ALFABETO.length)]).join(""); }
  while (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password));
}
if (password.length < 10) { console.error("✗ La contraseña debe tener al menos 10 caracteres."); process.exit(1); }

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    app_metadata: { rol: "staff" }, // solo modificable con la clave de servicio
    user_metadata: { nombre },
  });
  if (error) throw error;

  const { error: e2 } = await admin.from("usuarios").insert({ auth_id: data.user.id, nombre, email, rol, activo: true });
  if (e2) { await admin.auth.admin.deleteUser(data.user.id); throw e2; }

  console.log(`✓ Usuario ${rol} creado`);
  console.log(`  Panel:      /panel/login`);
  console.log(`  Email:      ${email}`);
  console.log(`  Contraseña: ${password}`);
  console.log("  Guardala en un gestor de contraseñas: no se vuelve a mostrar.");
} catch (e) {
  console.error("✗ No se pudo crear el usuario:", e.message ?? e);
  process.exit(1);
}
