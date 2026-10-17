// Banco de pruebas de seguridad (RLS). Ejecuta las migraciones REALES (001 + 002) en Postgres (PGlite) con los roles de Supabase simulados
// y comprueba qué ve y qué puede modificar cada tipo de usuario. Uso: npm run test:rls (repetir cada vez que cambie una política).
const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs");
const MIG = require("path").join(__dirname, "..", "migrations") + "/";

const U = {
  T: "00000000-0000-0000-0000-0000000000a1", C: "00000000-0000-0000-0000-0000000000a2",
  PA: "00000000-0000-0000-0000-0000000000b1", PB: "00000000-0000-0000-0000-0000000000b2",
  IX: "00000000-0000-0000-0000-0000000000c1", IY: "00000000-0000-0000-0000-0000000000c2",
  PS: "00000000-0000-0000-0000-0000000000d1",
};
const ID = (n) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "  ✓" : "  ✗ FALLA"} ${name}${!cond && extra ? "  → " + extra : ""}`); };

(async () => {
  const db = new PGlite();

  // ---------- Simulación mínima de Supabase ----------
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean default false);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated; grant all on storage.objects, storage.buckets to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
  `);

  // ---------- Instalación REAL: el mismo archivo que se pega en Supabase ----------
  const setup = fs.readFileSync(MIG + "../setup_completo.sql", "utf8");
  const m2 = fs.readFileSync(MIG + "002_roles_y_portal.sql", "utf8");
  try { await db.exec(setup); console.log("✓ setup_completo.sql aplicado (001 + 002 en una transacción)"); } catch (e) { console.log("✗ setup_completo.sql falló:", e.message); process.exit(1); }
  ok("instalación: tablas creadas (23) y RLS activo en todas", Number((await db.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n) === 23 &&
    Number((await db.query("select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity")).rows[0].n) === 0);
  try { await db.exec(m2); ok("la parte 002 es idempotente (sirve para actualizar un proyecto existente)", true); } catch (e) { ok("la parte 002 es idempotente", false, e.message); }
  try { await db.exec(setup); ok("ejecutar setup_completo dos veces falla con error claro", false, "no falló"); }
  catch (e) { ok("ejecutar setup_completo dos veces falla con error claro (y no corrompe nada)", /already exists/i.test(e.message), e.message); await db.exec("rollback").catch(() => {}); }

  // Atomicidad: una instalación con un error a la mitad no debe dejar NINGUNA tabla.
  const limpio = new PGlite();
  await limpio.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create schema storage; create table storage.buckets (id text primary key, name text, public boolean);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);`);
  try { await limpio.exec(setup.replace("create table auditoria (", "create table auditoria_rota (id uuid primary key, x int references tabla_que_no_existe(id)); create table auditoria (")); } catch { /* esperado */ }
  await limpio.exec("rollback").catch(() => {});
  const restantes = Number((await limpio.query("select count(*)::int n from pg_tables where schemaname='public'")).rows[0].n);
  ok("atomicidad: si la instalación falla a la mitad no queda ninguna tabla", restantes === 0, "quedaron " + restantes);

  // ---------- Datos de prueba (como superusuario) ----------
  await db.exec(`
    insert into usuarios (auth_id,nombre,email,rol) values ('${U.T}','Titular','t@x.com','titular'),('${U.C}','Contable','c@x.com','contable');
    insert into clientes (id,nombre,apellido,tipo,auth_id,email,dni,acceso_activo) values
      ('${ID(1)}','Ana','A','propietario','${U.PA}','a@x.com','111',true),
      ('${ID(2)}','Beto','B','propietario','${U.PB}','b@x.com','222',true),
      ('${ID(3)}','Ximena','X','inquilino','${U.IX}','x@x.com','333',true),
      ('${ID(4)}','Yago','Y','inquilino','${U.IY}','y@x.com','444',true),
      ('${ID(5)}','Sara','S','propietario','${U.PS}','s@x.com','555',false),
      ('${ID(6)}','Lead','Sinacceso','lead',null,null,'666',true);
    insert into propiedades (id,codigo,titulo,tipo,operacion,precio,moneda,estado,publicada_web,propietario_id) values
      ('${ID(11)}','MG-A1','Depto A1','Departamento','Alquiler',480000,'ARS','Alquilada',false,'${ID(1)}'),
      ('${ID(12)}','MG-A2','Casa A2','Casa','Venta',100000,'USD','Activa',true,'${ID(1)}'),
      ('${ID(13)}','MG-B1','Depto B1','Departamento','Alquiler',350000,'ARS','Alquilada',false,'${ID(2)}'),
      ('${ID(14)}','MG-PUB','Publicada','Casa','Venta',90000,'USD','Activa',true,null),
      ('${ID(15)}','MG-S1','Casa S1','Casa','Venta',80000,'USD','Activa',false,'${ID(5)}');
    insert into contratos (id,tipo,propiedad_id,parte_a_id,parte_b_id,monto,moneda,estado) values
      ('${ID(21)}','alq_viv','${ID(11)}','${ID(1)}','${ID(3)}',480000,'ARS','firmado'),
      ('${ID(22)}','alq_viv','${ID(13)}','${ID(2)}','${ID(4)}',350000,'ARS','firmado');
    insert into alquileres (id,contrato_id,propiedad_id,inquilino_id,propietario_id,canon,proximo_ajuste,indice) values
      ('${ID(31)}','${ID(21)}','${ID(11)}','${ID(3)}','${ID(1)}',480000,'2026-08-01','ICL'),
      ('${ID(32)}','${ID(22)}','${ID(13)}','${ID(4)}','${ID(2)}',350000,'2026-09-01','IPC');
    insert into liquidaciones (id,propietario_id,propiedad_id,periodo,alquiler_cobrado,comision,neto,estado) values
      ('${ID(41)}','${ID(1)}','${ID(11)}','2026-05',480000,48000,432000,'Pagada'),
      ('${ID(42)}','${ID(1)}','${ID(11)}','2026-06',480000,48000,432000,'Aprobada'),
      ('${ID(43)}','${ID(1)}','${ID(11)}','2026-07',480000,48000,432000,'Pendiente'),
      ('${ID(44)}','${ID(2)}','${ID(13)}','2026-06',350000,35000,315000,'Aprobada');
    insert into recibos (id,numero,cliente_id,concepto,honorarios,total) values
      ('${ID(51)}','#1','${ID(3)}','Alquiler X',1,480000),('${ID(52)}','#2','${ID(4)}','Alquiler Y',1,350000);
    insert into documentos (id,nombre,categoria,vinculado_a,storage_path,permiso) values
      ('${ID(61)}','Contrato A1 (cliente)','contratos','MG-A1','d/61.pdf','cliente'),
      ('${ID(62)}','Interno A1 (equipo)','contratos','MG-A1','d/62.pdf','equipo'),
      ('${ID(63)}','DNI de X (cliente)','dni','${ID(3)}','d/63.pdf','cliente'),
      ('${ID(64)}','Contrato B1','contratos','MG-B1','d/64.pdf','cliente'),
      ('${ID(65)}','Escritura A2','escrituras','MG-A2','d/65.pdf','cliente');
    insert into leads (nombre) values ('Lead de prueba');
    insert into movimientos_finanzas (concepto,categoria,monto,es_ingreso) values ('Ingreso','Alquileres',100,true);
    insert into storage.objects (bucket_id,name) values ('documentos','d/61.pdf'),('documentos','d/62.pdf'),('documentos','d/64.pdf');
  `);

  // ---------- Utilidades de prueba ----------
  async function como(rol, uid, fn) {
    await db.exec(`set role ${rol}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
    try { return await fn(); } finally { await db.exec("reset role"); await db.query(`select set_config('request.jwt.claim.sub','',false)`); }
  }
  const rows = async (sql) => { try { return (await db.query(sql)).rows; } catch (e) { return { error: e.message }; } };
  const n = async (sql) => { const r = await rows(sql); return r.error ? `ERROR: ${r.error}` : r.length; };
  const codes = async (sql, col) => { const r = await rows(sql); return r.error ? r : r.map((x) => x[col]).sort(); };
  const denied = async (sql) => { const r = await rows(sql); return !!r.error || r.length === 0; }; // error de permisos o 0 filas afectadas
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  // ===== PROPIETARIO A =====
  console.log("\nPropietario A (dueña de MG-A1 y MG-A2, tiene 1 inquilino):");
  await como("authenticated", U.PA, async () => {
    const props = await codes("select codigo from propiedades", "codigo");
    ok("ve sus 2 propiedades + las publicadas (públicas), NO las de B/S", eq(props, ["MG-A1", "MG-A2", "MG-PUB"]), JSON.stringify(props));
    ok("solo ve liquidaciones propias Aprobadas/Pagadas (no Pendiente, no de B)", eq(await codes("select periodo from liquidaciones", "periodo"), ["2026-05", "2026-06"]));
    const docs = await codes("select nombre from documentos", "nombre");
    ok("ve documentos 'cliente' de TODAS sus propiedades (A1 y A2), no los internos ni los de B", eq(docs, ["Contrato A1 (cliente)", "Escritura A2"]), JSON.stringify(docs));
    const v = await rows("select inquilino, canon from portal_alquileres_propietario");
    ok("vista de alquileres: solo el suyo, con nombre del inquilino", !v.error && v.length === 1 && v[0].inquilino === "Ximena X", JSON.stringify(v));
    const cols = await rows("select * from portal_alquileres_propietario limit 1");
    ok("la vista NO expone DNI/teléfono/email del inquilino", !cols.error && !("dni" in cols[0]) && !("email" in cols[0]) && !("telefono" in cols[0]));
    ok("solo puede leer SU fila de clientes (no la de otros)", (await n("select 1 from clientes")) === 1);
    ok("no ve alquileres crudos (solo vía vista)", (await n("select 1 from alquileres")) === 0);
    ok("no ve recibos", (await n("select 1 from recibos")) === 0);
    ok("no ve leads / usuarios / comisiones / auditoría / finanzas",
      (await n("select 1 from leads")) === 0 && (await n("select 1 from usuarios")) === 0 && (await n("select 1 from comisiones")) === 0 && (await n("select 1 from movimientos_finanzas")) === 0);
    ok("NO puede modificar liquidaciones", await denied(`update liquidaciones set neto = 1 returning id`));
    ok("NO puede modificar propiedades ni cambiar su propietario", await denied(`update propiedades set propietario_id = '${ID(2)}' returning id`));
    ok("NO puede convertirse en otro cliente (update clientes)", await denied(`update clientes set tipo='inquilino' returning id`));
    ok("NO puede insertar recibos", await denied(`insert into recibos (numero,cliente_id,concepto,honorarios,total) values ('#9','${ID(1)}','x',1,1) returning id`));
    ok("NO puede borrar documentos", await denied(`delete from documentos returning id`));
    const st = await codes("select name from storage.objects where bucket_id='documentos'", "name");
    ok("storage: solo puede firmar archivos de SUS documentos visibles", eq(st, ["d/61.pdf"]), JSON.stringify(st));
  });

  // ===== PROPIETARIO B =====
  console.log("\nPropietario B (aislamiento entre propietarios):");
  await como("authenticated", U.PB, async () => {
    ok("B ve solo sus liquidaciones", eq(await codes("select periodo from liquidaciones", "periodo"), ["2026-06"]));
    const v = await rows("select inquilino from portal_alquileres_propietario");
    ok("B ve solo a su inquilino", !v.error && v.length === 1 && v[0].inquilino === "Yago Y", JSON.stringify(v));
    ok("B no ve documentos de A", eq(await codes("select nombre from documentos", "nombre"), ["Contrato B1"]));
  });

  // ===== INQUILINO X =====
  console.log("\nInquilino X:");
  await como("authenticated", U.IX, async () => {
    ok("ve su alquiler (solo el suyo)", (await n("select 1 from alquileres")) === 1);
    ok("ve su contrato", (await n("select 1 from contratos")) === 1);
    ok("ve solo sus recibos", eq(await codes("select numero from recibos", "numero"), ["#1"]));
    const props = await codes("select codigo from propiedades", "codigo");
    ok("ve la propiedad que alquila + publicadas, no las otras", eq(props, ["MG-A1", "MG-A2", "MG-PUB"]), JSON.stringify(props));
    const docs = await codes("select nombre from documentos", "nombre");
    ok("documentos: el 'cliente' de su propiedad y el suyo personal; NO el interno ni ajenos", eq(docs, ["Contrato A1 (cliente)", "DNI de X (cliente)"]), JSON.stringify(docs));
    ok("NO ve liquidaciones", (await n("select 1 from liquidaciones")) === 0);
    ok("NO ve otros clientes (solo su fila)", (await n("select 1 from clientes")) === 1);
    ok("NO ve la vista de propietario (no es propietario)", (await n("select 1 from portal_alquileres_propietario")) === 0);
    ok("NO puede modificar su alquiler ni su canon", await denied(`update alquileres set canon = 1 returning id`));
    ok("NO puede modificar recibos", await denied(`update recibos set total = 0 returning id`));
  });

  // ===== INQUILINO Y =====
  console.log("\nInquilino Y (aislamiento entre inquilinos):");
  await como("authenticated", U.IY, async () => {
    ok("Y ve solo su recibo", eq(await codes("select numero from recibos", "numero"), ["#2"]));
    ok("Y no ve contrato/alquiler de X", (await n("select 1 from alquileres")) === 1 && (await n("select 1 from contratos")) === 1);
    ok("Y no ve documentos de X", eq(await codes("select nombre from documentos", "nombre"), ["Contrato B1"]));
  });

  // ===== SUSPENDIDO =====
  console.log("\nPropietaria suspendida (acceso_activo = false):");
  await como("authenticated", U.PS, async () => {
    ok("no ve NINGUNA propiedad propia ni liquidaciones ni documentos",
      !(await codes("select codigo from propiedades", "codigo")).includes("MG-S1") && (await n("select 1 from liquidaciones")) === 0 && (await n("select 1 from documentos")) === 0);
  });

  // ===== CONTABLE =====
  console.log("\nContable:");
  await como("authenticated", U.C, async () => {
    ok("lee propiedades y clientes", (await n("select 1 from propiedades")) === 5 && (await n("select 1 from clientes")) === 6);
    ok("puede leer y escribir finanzas", (await n("select 1 from movimientos_finanzas")) === 1 &&
      !(await rows(`insert into movimientos_finanzas (concepto,categoria,monto,es_ingreso) values ('Gasto','Varios',5,false) returning id`)).error);
    ok("puede gestionar liquidaciones", (await n("select 1 from liquidaciones")) === 4 && !(await denied(`update liquidaciones set estado='Pagada' where id='${ID(42)}' returning id`)));
    ok("puede emitir recibos", !(await rows(`insert into recibos (numero,cliente_id,concepto,honorarios,total) values ('#7','${ID(3)}','x',1,1) returning id`)).error);
    ok("NO puede crear/modificar propiedades", await denied(`update propiedades set precio = 1 returning id`) && (await denied(`insert into propiedades (codigo,titulo,tipo,operacion,precio) values ('X','x','Casa','Venta',1) returning id`)));
    ok("NO puede modificar clientes", await denied(`update clientes set nombre='Hack' returning id`));
    ok("NO ve comisiones ni auditoría", (await n("select 1 from comisiones")) === 0 && (await n("select 1 from auditoria")) === 0);
    ok("solo ve su propia fila de usuarios (no la del titular)", (await n("select 1 from usuarios")) === 1);
    ok("NO puede crear usuarios del equipo (escalada de privilegios)", await denied(`insert into usuarios (auth_id,nombre,email,rol) values ('${U.PA}','x','x','titular') returning id`));
  });

  // ===== TITULAR =====
  console.log("\nTitular:");
  await como("authenticated", U.T, async () => {
    ok("ve todo: propiedades, clientes, liquidaciones, usuarios, comisiones", (await n("select 1 from propiedades")) === 5 && (await n("select 1 from clientes")) === 6 &&
      (await n("select 1 from liquidaciones")) === 4 && (await n("select 1 from usuarios")) === 2 && (await n("select 1 from comisiones")) === 1);
    ok("puede crear clientes y modificar propiedades", !(await rows(`insert into clientes (nombre,apellido,tipo) values ('N','N','inquilino') returning id`)).error &&
      !(await denied(`update propiedades set precio = 1 where id='${ID(12)}' returning id`)));
    ok("puede registrar auditoría", !(await rows(`insert into auditoria (usuario_id,accion,entidad,fecha) values ((select id from usuarios where auth_id='${U.T}'),'x','clientes',now()) returning id`)).error);
  });

  // ===== ANÓNIMO / SIN ROL =====
  console.log("\nVisitante sin sesión (anon) y usuario autenticado sin fila (registro abierto):");
  await como("anon", null, async () => {
    const p = await codes("select codigo from propiedades", "codigo");
    ok("anon: solo propiedades publicadas y activas (sitio público)", eq(p, ["MG-A2", "MG-PUB"]), JSON.stringify(p));
    ok("anon: nada de clientes, liquidaciones, recibos, documentos, usuarios",
      (await n("select 1 from clientes")) === 0 && (await n("select 1 from liquidaciones")) === 0 && (await n("select 1 from recibos")) === 0 &&
      (await n("select 1 from documentos")) === 0 && (await n("select 1 from usuarios")) === 0);
    const v = await rows("select 1 from portal_alquileres_propietario");
    ok("anon: sin acceso a la vista del portal", !!v.error || v.length === 0);
    ok("anon: no puede insertar propiedades", await denied(`insert into propiedades (codigo,titulo,tipo,operacion,precio) values ('Z','z','Casa','Venta',1) returning id`));
  });
  await como("authenticated", "00000000-0000-0000-0000-0000000000ff", async () => {
    ok("usuario que se registró solo (sin fila en usuarios/clientes): no ve datos privados",
      (await n("select 1 from clientes")) === 0 && (await n("select 1 from liquidaciones")) === 0 && (await n("select 1 from usuarios")) === 0 &&
      (await n("select 1 from documentos")) === 0 && (await n("select 1 from recibos")) === 0);
    ok("…y tampoco puede escribir nada", await denied(`insert into clientes (nombre,apellido,tipo) values ('a','b','propietario') returning id`));
  });

  console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} pruebas correctas, ${fail} con fallas`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERROR DEL BANCO DE PRUEBAS:", e); process.exit(2); });
