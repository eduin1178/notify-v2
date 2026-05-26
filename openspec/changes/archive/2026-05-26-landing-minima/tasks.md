## 1. Estructura de carpetas

- [x] 1.1 Crear el directorio `web/components/site/`

## 2. Navbar

- [x] 2.1 Crear `web/components/site/navbar.tsx` exportando `Navbar` como Server Component
- [x] 2.2 Estructurar como `<header>` con clases `sticky top-0 z-50` y fondo (p. ej. `bg-background/80 backdrop-blur border-b`) para mantenerse legible al hacer scroll
- [x] 2.3 Layout interno: contenedor centrado (`mx-auto max-w-6xl`), `flex items-center justify-between`, padding horizontal y vertical responsive
- [x] 2.4 Brand: texto "Notify" a la izquierda con peso semibold/bold y tamaño adecuado al navbar
- [x] 2.5 Acciones a la derecha: `<Button variant="ghost">Iniciar sesión</Button>` y `<Button variant="default">Registrarse</Button>`, importados desde `@/components/ui/button`
- [x] 2.6 Verificar que los botones no tienen `onClick` ni envolturas `<Link>`/`<a>` (placeholders sin navegación)

## 3. Hero

- [x] 3.1 Crear `web/components/site/hero.tsx` exportando `Hero` como Server Component
- [x] 3.2 Estructurar como `<section>` con padding vertical generoso y contenedor centrado (`mx-auto max-w-3xl text-center`)
- [x] 3.3 Renderizar `<h1>` con el texto "Notify" (tamaño grande, tracking-tight)
- [x] 3.4 Renderizar un `<p>` con copy placeholder en español neutro (tú, no voseo), tamaño `text-lg` y color secundario (`text-muted-foreground`)
- [x] 3.5 Confirmar visualmente que el copy NO contiene voseo ("ingresá", "querés", "vos", "sos", etc.)

## 4. Layout raíz

- [x] 4.1 En `web/app/layout.tsx`, cambiar `<html lang="en">` a `<html lang="es">`
- [x] 4.2 Actualizar `metadata`: `title: "Notify"` y `description` placeholder en español neutro
- [x] 4.3 Quitar `font-mono` de las clases por defecto aplicadas a `<html>` (mantener variables de fuente como `--font-geist-sans`, `--font-geist-mono`, `--font-mono`); la base efectiva debe ser sans
- [x] 4.4 Importar `Navbar` desde `@/components/site/navbar` y montarlo dentro de `<body>`, antes de `{children}`
- [x] 4.5 Verificar que el `<body>` mantiene `min-h-full flex flex-col` para que el children siga ocupando el espacio restante

## 5. Página raíz `/`

- [x] 5.1 Reemplazar el contenido de `web/app/page.tsx`: eliminar logos Next/Vercel, texto en inglés y enlaces a docs
- [x] 5.2 Importar `Hero` desde `@/components/site/hero` y renderizarlo como contenido principal de la página
- [x] 5.3 Eliminar imports no usados (`Image` de `next/image` si ya no se usa)

## 6. Verificación manual

- [ ] 6.1 Ejecutar `pnpm dev` desde `web/` y abrir `http://localhost:3000`
- [ ] 6.2 Confirmar: navbar visible arriba, brand "Notify", dos botones con la jerarquía visual correcta
- [ ] 6.3 Hacer scroll y confirmar que el navbar permanece pegado al top (sticky)
- [ ] 6.4 Hacer clic en ambos botones: no debe ocurrir nada (sin navegación, sin error en consola)
- [ ] 6.5 Inspeccionar el `<html>`: `lang="es"`, sin clase `font-mono` por defecto
- [ ] 6.6 Inspeccionar la pestaña: título "Notify"
- [ ] 6.7 Releer todo el copy visible y confirmar que no hay voseo
- [x] 6.8 Ejecutar `pnpm lint` y `pnpm build` desde `web/` — ambos deben pasar sin errores
