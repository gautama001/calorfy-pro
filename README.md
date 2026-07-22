# Calorfy Pro Web

Dashboard profesional independiente de la aplicación móvil de Calorfy. Usa el
mismo proyecto de Supabase, pero cuenta con su propio build y despliegue.

## Desarrollo local

1. Copiar `.env.example` como `.env.local`.
2. Completar la URL y la clave publicable de Supabase.
3. Ejecutar `npm install`.
4. Ejecutar `npm run dev`.

## Variables de entorno

- `VITE_SUPABASE_URL`: URL pública del proyecto Supabase.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: clave publicable; nunca usar `service_role`.
- `VITE_CONSUMER_CONNECT_URL`: URL donde la app del cliente recibe una invitación.

## Despliegue en Hostinger

- Repositorio recomendado: `gautama001/calorfy-pro`.
- Rama: `main`.
- Directorio raíz: la raíz del repositorio (`.`).
- Node.js: `22`.
- Instalación: `npm install`.
- Build: `npm run build`.
- Directorio de salida: `dist`.
- Dominio: `pro.calorfy.com`.

Si se despliega directamente desde el monorepo `gautama001/calorfy`, el
directorio raíz debe configurarse como `pro-web`.

En Supabase Auth se deben permitir estas Redirect URLs:

- `https://pro.calorfy.com`
- `https://pro.calorfy.com/**`

## Privacidad

El dashboard obtiene clientes mediante `get_professional_client_summaries()`.
La función solo devuelve relaciones activas y pone en `null` cualquier dato de
salud cuyo permiso no haya sido autorizado explícitamente por el cliente.
