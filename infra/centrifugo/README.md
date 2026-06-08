# Centrífugo — configuración de referencia

Config de referencia del servidor Centrífugo (v6.8.1) que da soporte al realtime
del inbox (change `inbox-realtime-centrifugo`). El servidor está desplegado en
**Dokploy**; el archivo real vive en un **volumen** y los **secretos se inyectan
por variables de entorno** (no en este JSON).

Este archivo ([config.json](config.json)) es la **fuente de verdad versionada**:
refleja la estructura del config sin secretos. Si cambias el real en Dokploy,
actualiza también este.

## Secretos: van por variable de entorno, NO en el JSON

Centrífugo permite configurar cualquier opción por env var, y las env vars
**sobrescriben** el archivo. Convención: `CENTRIFUGO_<RUTA>` en mayúsculas, con los
niveles anidados unidos por guion bajo.

| Opción del config        | Variable de entorno (Dokploy)           | Debe coincidir con (env de la app web) |
| ------------------------ | --------------------------------------- | -------------------------------------- |
| `http_api.key`           | `CENTRIFUGO_HTTP_API_KEY`               | `CENTRIFUGO_API_KEY`                   |
| `client.token.hmac_secret_key` | `CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY` | `CENTRIFUGO_TOKEN_HMAC_SECRET`     |

Genera secretos fuertes (uno por cada uno):

```bash
openssl rand -hex 32
```

### Por qué cada uno importa

- **`CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY` — OBLIGATORIO.** Con él Centrífugo
  verifica los *connection tokens* y *subscription tokens* JWT que firma la app.
  Es la pieza que hace cumplir el aislamiento por organización; sin él el modelo
  de seguridad multi-tenant no funciona. Debe ser **idéntico** a
  `CENTRIFUGO_TOKEN_HMAC_SECRET` en la app web.
- **`CENTRIFUGO_HTTP_API_KEY` — muy recomendable.** Autoriza el endpoint
  `POST /api/publish` que usa el backend para publicar eventos. **Si no se
  configura, la HTTP API queda abierta sin autenticación** (cualquiera que alcance
  el endpoint puede publicar). Debe ser **idéntico** a `CENTRIFUGO_API_KEY` en la
  app web.

## El namespace `notify_inbox`

Todos los canales del inbox viven bajo el namespace `notify_inbox`
(`notify_inbox:org.<orgId>`, `notify_inbox:conv.<conversationId>`). El nombre es
`<app>_<feature>` para no colisionar si otra app comparte esta instancia.

El namespace **no** activa `allow_subscribe_for_client`: así toda suscripción exige
un *subscription token* que la API de la app emite solo tras verificar la membresía
de la organización. No usar `#` en los nombres de canal (en Centrífugo delimita
canales por user-id).

## Variables de entorno de la app web (lado Next)

Además de las de Centrífugo, la app necesita (ver `web/lib/env.ts`):

| Env var (app)                     | Ejemplo                                                  | Uso                                  |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| `CENTRIFUGO_API_URL`              | `http://centrifugo:8000` (red interna)                   | Publicar por HTTP API (server-side); la app añade `/api/publish`. Se tolera también el sufijo `/api`. |
| `CENTRIFUGO_API_KEY`              | (= `CENTRIFUGO_HTTP_API_KEY`)                            | Header `X-API-Key` al publicar       |
| `CENTRIFUGO_TOKEN_HMAC_SECRET`    | (= `CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY`)           | Firmar tokens de conexión/suscripción|
| `NEXT_PUBLIC_CENTRIFUGO_WS_URL`   | `wss://centrifugo.tudominio.com/connection/websocket`    | WS del navegador (pública)           |

## Recomendaciones de endurecimiento (producción)

- **`client.allowed_origins`**: cambiar `["*"]` por el/los dominio(s) de la app
  (p. ej. `["https://app.tudominio.com"]`).
- **`admin.enabled: true`**: requiere `admin.password` y `admin.secret`
  (preferible por env: `CENTRIFUGO_ADMIN_PASSWORD`, `CENTRIFUGO_ADMIN_SECRET`).
- Exponer `/connection/websocket` públicamente; mantener `/api` en red interna
  siempre que sea posible.
