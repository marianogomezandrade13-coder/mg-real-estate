# Puesta en marcha — MG Real Estate (cuenta de Supabase nueva)

Tiempo estimado: 30–40 minutos. En cualquier momento corré `npm run verificar:supabase`: te dice qué falta y en qué orden.

> **Antes de empezar:** el proyecto anterior (`ptxpfeqrdfsyihzfdubt`) ya no existe. Lo que sigue arma todo desde cero.
> Los datos viejos, si los hubiera, no se recuperan de acá.

---

## Paso 1 · Crear la cuenta y el proyecto

1. Entrá a <https://supabase.com> → **Start your project** → registrate (email o GitHub). Usá un email que sea de la inmobiliaria, no personal.
2. Creá una **Organization** (por ejemplo `MG Real Estate`).
3. **New project** con estos datos:
   | Campo | Valor |
   |---|---|
   | Name | `mg-real-estate` |
   | Database Password | pulsá **Generate a password** y guardala en un gestor de contraseñas (1Password, Bitwarden, el de Google…). **No la pegues en ningún archivo del proyecto.** |
   | Region | **South America (São Paulo)** — es la más cercana a Mendoza |
   | Plan | ver la nota de abajo |
4. Esperá 1–2 minutos a que el proyecto termine de crearse.

> **Sobre el plan:** en el plan gratuito Supabase **pausa** los proyectos que pasan una semana sin actividad
> (probablemente eso le pasó al anterior). Para un negocio con clientes que entran al portal conviene el plan **Pro**
> (incluye copias de seguridad diarias y no se pausa). Confirmá precios y condiciones vigentes en <https://supabase.com/pricing>.

## Paso 2 · Instalar la base de datos (el SQL)

1. En el proyecto: menú izquierdo → **SQL Editor** → **New query**.
2. Abrí el archivo **`supabase/setup_completo.sql`** de este proyecto, seleccioná **todo** (Ctrl+A), copiá (Ctrl+C).
3. Pegalo en el editor y apretá **Run** (o Ctrl+Enter).
4. Si aparece un aviso de *"potentially destructive operations"* por los `DROP POLICY IF EXISTS`: es normal (el proyecto está vacío). Confirmá.
5. Debe terminar en **Success. No rows returned**.
6. Comprobá: menú **Table Editor** → deberías ver **23 tablas** (`propiedades`, `clientes`, `usuarios`, `alquileres`, `liquidaciones`, `recibos`, …) y en **Storage** los buckets `propiedades`, `pdfs` y `documentos`.

**Qué incluye ese archivo:** las 23 tablas, la seguridad por fila (RLS) en todas, los roles (titular / contable / propietario / inquilino),
la vista que permite al propietario ver a su inquilino sin exponer sus datos personales, los 3 buckets de archivos con sus permisos,
y dos sucursales de ejemplo (San Martín y Junín) y las comisiones por defecto (10 % / 6 % / 1 %).

**Si algo falla:** todo corre en una sola transacción, así que **no queda nada a medias**. Leé el mensaje de error, corregí y volvé a ejecutar.
**No lo ejecutes dos veces** en un proyecto que ya lo tiene: falla a propósito para no pisar datos.

**Avisos normales del "Security Advisor"** de Supabase: puede marcar la vista `portal_alquileres_propietario` como *"Security Definer View"*.
Es intencional: la vista filtra por el propietario logueado y así evita exponer datos del inquilino.

## Paso 3 · Copiar las claves al proyecto

1. Supabase → **Project Settings** (engranaje) → **API Keys** (en algunas versiones: **API**).
2. Copiá tres datos y ponelos en el archivo **`.env.local`** (en la carpeta del proyecto), reemplazando los que hay:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave PÚBLICA: "anon public" o "publishable">
SUPABASE_SERVICE_ROLE_KEY=<clave SECRETA: "service_role" o "secret">
```

> ⚠️ La clave **secreta** da acceso total a la base. **Nunca** va en una variable que empiece con `NEXT_PUBLIC_`,
> no se pega en chats ni se sube a ningún repositorio.

3. Verificá: `npm run verificar:supabase` → los pasos 1 a 5 deben quedar en ✓ (solo faltará el titular).

## Paso 4 · Cerrar el registro abierto

Supabase → **Authentication** → **Sign In / Providers** → apagá **"Allow new users to sign up"**.
Así solo la inmobiliaria puede crear usuarios (desde el panel o con el script del paso 5).

## Paso 5 · Crear el usuario titular (el primero)

En una terminal, dentro de la carpeta del proyecto:

```bash
node scripts/crear-staff.mjs --email=tu@mail.com --nombre="Tu Nombre" --rol=titular
```

Imprime una **contraseña generada, una sola vez**. Guardala. Para sumar a la contable: mismo comando con `--rol=contable`.

Verificá: `npm run verificar:supabase` → todo en ✓ ("✅ Todo en orden").

## Paso 6 · Probar el sistema completo

1. `npm run dev` y entrá a <http://localhost:3000/portal> con el titular.
2. **Accesos de clientes → Nuevo cliente con acceso**: creá un propietario de prueba (te muestra su contraseña temporal una sola vez).
3. **Propiedades → Cargar propiedad**: asignale ese propietario.
4. En una **ventana privada** entrá a <http://localhost:3000/portal> con ese usuario: te pide cambiar la contraseña y luego muestra **solo** su propiedad.
5. Probá con un segundo cliente: no debe ver nada del primero.

## Paso 7 · Publicar (Vercel)

1. Vercel → tu proyecto → **Settings → Environment Variables**: cargá las **mismas tres variables** del paso 3 (Production y Preview).
2. **Redeploy** (volver a publicar).
3. Supabase → **Authentication → URL Configuration** → **Site URL**: poné el dominio real del sitio.
4. ⚠️ Hasta que este paso esté hecho, la versión publicada anteriormente puede tener el panel sin protección.

---

## Mantenimiento

| Tarea | Comando |
|---|---|
| Diagnóstico de conexión y configuración | `npm run verificar:supabase` |
| Regenerar el SQL completo tras cambiar una migración | `npm run build:sql` |
| Probar la seguridad (54 casos) en un Postgres local | `npm run test:rls` |
| Actualizar un proyecto **ya instalado** con cambios de la parte 002 | `DATABASE_URL="postgresql://…" node scripts/run-migration.mjs 002_roles_y_portal.sql` (o pegar `002_roles_y_portal.sql` en el SQL Editor; es repetible) |

Copias de seguridad: en Pro son diarias automáticas. Igual conviene bajar una copia manual antes de cambios grandes
(**Database → Backups**).
