# RedSokappy

PWA para la gestión de miembros y asistencia de la Soka Gakkai del Paraguay.
Stack: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind + Supabase (Auth + Postgres + RLS).

## Requisitos previos
- La base de datos en Supabase ya creada (ejecutar `supabase/schema.sql` y luego `data.sql`).
- Node.js 18+ instalado (solo si vas a correrlo en tu computadora).

## 1. Configurar las credenciales
1. Copiá `.env.local.example` y renombralo a `.env.local`.
2. En Supabase: **Project Settings → Data API** (o **API**). Copiá:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Crear tu primer usuario para entrar
La app usa el login de Supabase (Supabase Auth). Para poder ingresar:
1. En Supabase: **Authentication → Users → Add user**.
2. Poné tu correo y una contraseña. (Desactivá "confirm email" o confirmalo.)
3. (Opcional, para permisos) En **Table Editor → perfiles**, insertá una fila:
   - `id` = el ID del usuario que acabás de crear (lo ves en Authentication → Users)
   - `id_rol` = `3` (ADMINISTRADOR)
   - `id_persona` = tu id en la tabla `personas` (opcional)

## 3. Correr en tu computadora (opcional, para probar)
```bash
npm install
npm run dev
```
Abrí http://localhost:3000 e ingresá con el correo/contraseña del paso 2.

## 4. Publicar en Vercel
1. Subí esta carpeta a un repositorio de GitHub.
2. En vercel.com → **Add New → Project** → importá el repo.
3. En **Environment Variables** cargá las mismas dos variables del `.env.local`.
4. **Deploy**. Listo: te queda una URL pública instalable como app en el celular.

## Pantallas incluidas
- **/login** — ingreso con correo y contraseña.
- **/inicio** — resumen (cantidad de miembros, reuniones, últimas reuniones).
- **/miembros** — listado de miembros con su división y han.
