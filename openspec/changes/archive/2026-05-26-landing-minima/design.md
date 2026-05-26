## Context

El proyecto Notify es una app Next.js 16 (App Router, React 19) recién inicializada. `web/app/page.tsx` aún contiene la plantilla de `create-next-app` (logos Next/Vercel, copy en inglés, enlaces a docs). El layout raíz fija `lang="en"`, `title="Create Next App"` y aplica `font-mono` por defecto al `<html>` — todas son decisiones de andamio que chocan con una landing real.

shadcn/ui está configurado (`web/components.json`) pero solo el componente `button` está instalado. La utilidad `cn()` vive en `web/lib/utils.ts`. Tailwind v4 con configuración CSS-first (sin `tailwind.config.js`). Phosphor Icons declarado como icon library del proyecto.

Esta es la primera "feature" real del producto: define el chrome (layout + navbar) que persistirá cuando aparezcan `/login`, `/register` y el dashboard.

## Goals / Non-Goals

**Goals:**
- Reemplazar la plantilla por una landing con identidad propia ("Notify").
- Establecer la estructura de carpetas para componentes de marketing/sitio (`web/components/site/`).
- Dejar el navbar listo para alojar rutas reales de auth en el futuro, sin tener que rehacerlo.
- Normalizar el layout raíz: idioma, metadata y tipografía por defecto.

**Non-Goals:**
- Crear las rutas `/login` y `/register` (los botones son placeholders).
- Implementar lógica de autenticación o estado de sesión.
- Definir el copy final del hero — placeholders honestos en español neutro.
- Definir tema dark/light toggle. Si ya hay soporte CSS para dark via media query, se respeta; no se añade switcher.
- Tests automatizados — el proyecto aún no tiene runner configurado. Verificación visual manual.

## Decisions

### D1. Navbar vive en `app/layout.tsx`, no en `page.tsx`

**Elegido:** Montar `<Navbar />` dentro de `<body>` en el layout raíz, encima de `{children}`.

**Por qué:** El navbar es chrome compartido. Cuando aparezcan rutas autenticadas o de marketing adicionales, el navbar ya estará ahí sin duplicación. Si más adelante una ruta no debe mostrarlo (p. ej., dashboard), se mueve la landing a un route group `(marketing)` y se crea un layout alterno — refactor barato.

**Alternativa descartada:** Renderizar el navbar dentro de `page.tsx`. Más simple ahora, pero garantiza duplicación o refactor en la próxima ruta.

### D2. Posicionamiento `sticky top-0`, no `fixed`

**Elegido:** `sticky top-0 z-50` en el `<header>` del navbar.

**Por qué:** `sticky` no saca el elemento del flujo, así que no hace falta compensar con `padding-top` en el contenido. Menos frágil cuando el alto del navbar cambie (por ejemplo, al agregar un menú móvil).

**Alternativa descartada:** `fixed top-0` + `pt-16` en el contenedor. Funciona pero acopla la altura del nav con el espaciado del hero.

### D3. Estructura de archivos: `components/site/`

**Elegido:**
```
web/components/
├─ site/
│  ├─ navbar.tsx
│  └─ hero.tsx
└─ ui/
   └─ button.tsx   (existente, shadcn)
```

**Por qué:** Separa componentes de producto (`site/`) de primitivas de UI (`ui/`, dominio de shadcn). El namespace `site/` deja espacio para `footer.tsx`, `cta.tsx`, etc., sin contaminar `ui/`.

**Alternativa descartada:** Componentes inline en `page.tsx`. Funciona para una sección, pero el navbar tiene que ser un módulo aparte porque vive en el layout.

### D4. Jerarquía visual de los botones de auth

**Elegido:**
- "Iniciar sesión" → `<Button variant="ghost">` (peso visual bajo)
- "Registrarse" → `<Button variant="default">` (peso visual alto, CTA primario)

**Por qué:** Patrón estándar en landings SaaS: el registro es la conversión deseada, login es secundario (los usuarios existentes lo buscan, no hay que destacarlo). Reutiliza variantes nativas de shadcn — sin CSS custom.

### D5. Ajustes al layout raíz

Tres cambios en `web/app/layout.tsx`:

1. **`lang="en"` → `lang="es"`**: el producto es para hispanohablantes; afecta accesibilidad y SEO.
2. **`metadata`**: `title: "Notify"`, `description` placeholder en español neutro.
3. **Quitar `font-mono` del default**: hoy el `<html>` tiene `font-mono` aplicado globalmente. Para una landing comercial la base debe ser sans (Geist Sans ya está cargada como `--font-geist-sans`). Mono queda disponible como utility (`font-mono`) y como variable CSS para usar donde haga falta.

### D6. Botones placeholder: `<Button>` sin `<Link>`

**Elegido:** Renderizar `<Button>` plano sin envolverlo en `<Link>` ni en `<a>`. Sin `onClick`. Click no hace nada (botón de tipo `button` por defecto, no submit).

**Por qué:** El spec dice "no navegan". Envolver en `<Link href="#">` o stub `onClick={() => {}}` añade complejidad sin valor y deja deuda confusa. Cuando existan rutas reales, el cambio es una línea: envolver con `<Link href="/login">` y `asChild`.

### D7. Hero mínimo: H1 + párrafo + nada de CTA

**Elegido:** El hero contiene solo título y subtítulo (placeholders). Sin CTA adicional dentro del hero.

**Por qué:** El usuario explicitó "hero básica" y los CTAs ya viven en el navbar. Añadir un CTA dentro del hero duplica intención. Si más adelante se quiere un CTA grande "Empezar ahora", se agrega como parte del copy real.

## Risks / Trade-offs

- **[Riesgo] El navbar en el layout raíz se mostrará también en futuras rutas autenticadas si no se actúa.**
  → Mitigación: documentar en `proposal.md` (ya hecho) que la app autenticada necesitará un route group con su propio layout. No es un problema mientras solo exista `/`.

- **[Trade-off] Quitar `font-mono` del default podría romper alguna utilidad que hoy dependa de heredarla.**
  → Mitigación: el único consumidor actual es la plantilla scaffold que vamos a borrar. Riesgo nulo en la práctica.

- **[Riesgo] Sin tests automatizados, las regresiones de copy (voseo accidental) o de layout solo se detectan a ojo.**
  → Mitigación: el spec lista los strings exactos esperados y la regla de "tú, no voseo". Verificación manual en navegador antes de cerrar el cambio.

- **[Trade-off] Botones que no hacen nada pueden confundir a un usuario que los pruebe.**
  → Aceptado: esto es un punto de partida interno; el cambio siguiente ya conectará rutas reales.

## Migration Plan

No hay migración: reemplazo en sitio del scaffold. Rollback = `git revert`. No hay estado persistido, no hay datos, no hay APIs.

## Open Questions

- Ninguna que bloquee. Cuando exista copy real para "Notify", se actualiza el hero y la `metadata.description` en un cambio posterior.
