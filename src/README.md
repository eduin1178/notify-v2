Notify — Next.js 16 + Drizzle + Neon + tenancy foundation.

## Setup local

1. **Variables de entorno**

   Copiá `.env.example` a `.env.local` y completá los valores. Generá `ENCRYPTION_KEY_V1` con:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Postgres de tests (Docker)**

   Los tests de integración corren contra Postgres 16 local en Docker, no contra Neon (decisión D7 del design `platform-foundation`). Levantá el contenedor con:

   ```bash
   docker compose -f docker-compose.test.yml up -d
   ```

   Eso expone Postgres en `localhost:5432` con creds `test:test`, base `notify_test`. Los datos viven en `tmpfs`, así que se pierden al bajar el contenedor — exactamente lo que querés en tests.

   Para bajarlo: `docker compose -f docker-compose.test.yml down`.

3. **Postgres de dev (Neon)**

   Para `npm run dev` y `npm run db:studio` apuntá `DATABASE_URL` (en `.env.local`) a tu branch `development` de Neon.

4. **Migraciones**

   ```bash
   npm run db:generate   # genera SQL desde src/infrastructure/db/schema/
   npm run db:migrate    # aplica migrations a la DB de DATABASE_URL
   ```

## Comandos

```bash
npm run dev          # Next.js dev server
npm run build        # build de producción
npm run start        # servir build

npm run lint         # ESLint (incluye boundaries hexagonales)
npm run lint:fix     # ESLint con autofix
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (single shot)
npm run test:watch   # vitest watch mode

npm run db:generate  # drizzle-kit generate
npm run db:migrate   # tsx ./infrastructure/db/migrate.ts
npm run db:studio    # drizzle-kit studio (UI)
```

## Rotación de la encryption key

Las credenciales BYO (tokens Cloud API, sesiones WAHA, API keys OpenRouter) se cifran con AES-256-GCM versionado. Para rotar:

1. Generá una key nueva: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
2. Agregala a `.env.local` como `ENCRYPTION_KEY_V2` — **mantené `ENCRYPTION_KEY_V1`** para que las filas viejas se sigan pudiendo desencriptar.
3. Cambiá `CURRENT_VERSION` en `infrastructure/crypto/encryption.ts` a `2`. Los nuevos `encrypt()` usan v2; los `decrypt()` despachan por prefijo `v1:` o `v2:`.
4. Cuando todas las filas estén re-cifradas (job de migración futuro), podés eliminar `ENCRYPTION_KEY_V1` y la versión 1 del dispatch.

## CI

CI corre `lint`, `typecheck` y `test` en cada PR. Los tres son required checks de `main`. **Configuralo manualmente** en GitHub → Settings → Branches → Branch protection rules: marca como required los jobs `lint`, `typecheck`, `test` (definidos en `.github/workflows/ci.yml`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
