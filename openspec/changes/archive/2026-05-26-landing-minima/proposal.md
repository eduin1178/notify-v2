## Why

El proyecto Notify aún muestra la plantilla por defecto de `create-next-app` en `/`. Necesitamos un punto de partida visual real — una landing mínima con identidad propia ("Notify") y dos acciones reconocibles (iniciar sesión, registrarse) — sobre la cual iterar más adelante con copy y rutas reales.

## What Changes

- Reemplazar el contenido de `web/app/page.tsx` con una landing mínima en `/` (navbar + hero).
- Introducir un navbar superior **sticky** persistente en `web/app/layout.tsx` con el branding "Notify" y dos botones: "Iniciar sesión" (`variant="ghost"`) y "Registrarse" (`variant="default"`). Los botones aún no navegan a ninguna parte.
- Ajustar `web/app/layout.tsx`: cambiar `lang` a `"es"`, actualizar `metadata` (título "Notify", descripción placeholder), y quitar `font-mono` como fuente por defecto del `<html>` (mantener sans).
- Añadir componentes nuevos bajo `web/components/site/`: `navbar.tsx` y `hero.tsx`.
- Copy del hero en español neutro (tú, nunca voseo), explícitamente marcado como placeholder.

No se agregan rutas `/login` ni `/register` en este cambio.

## Capabilities

### New Capabilities
- `landing-page`: estructura y contenido de la página pública en `/`, incluyendo el chrome compartido (navbar) y la sección hero introductoria.

### Modified Capabilities
<!-- Ninguna - no existen specs previos. -->

## Impact

- **Código afectado**:
  - `web/app/layout.tsx` (lang, metadata, fuente por defecto, montaje del navbar)
  - `web/app/page.tsx` (reemplazo completo)
  - `web/components/site/navbar.tsx` (nuevo)
  - `web/components/site/hero.tsx` (nuevo)
- **Dependencias**: ninguna nueva. Se reutiliza `@/components/ui/button` (shadcn) ya instalado y, si hace falta un icono, `@phosphor-icons/react` (ya disponible vía `components.json`).
- **APIs / contratos externos**: ninguno.
- **Rutas futuras**: el navbar vive en el layout raíz; cuando se agreguen rutas autenticadas que no deban mostrarlo, habrá que mover la landing a un route group `(marketing)` o equivalente. Fuera de alcance aquí.
