# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is a multi-folder repo (not a pnpm workspace — the root `pnpm-workspace.yaml` was removed). The Next.js app lives in [web/](web/). Spec-driven development artifacts live in [openspec/](openspec/).

- [web/](web/) — Next.js 16 application (App Router, React 19, TypeScript, Tailwind v4, shadcn/ui)
- [openspec/](openspec/) — OpenSpec change proposals, specs, and exploration notes for this codebase

All commands below run from inside `web/` unless noted.

## Commands

Package manager: **pnpm** (`packageManager` pinned in [web/package.json](web/package.json)).

```bash
cd web
pnpm install      # install deps
pnpm dev          # next dev — local dev server
pnpm build        # next build — production build
pnpm start        # next start — serve production build
pnpm lint         # eslint (flat config in eslint.config.mjs)
```

No test runner is configured yet.

## Architecture Notes

- **Next.js App Router (Next 16, React 19)**. Entry points: [web/app/layout.tsx](web/app/layout.tsx) and [web/app/page.tsx](web/app/page.tsx). `globals.css` lives in [web/app/globals.css](web/app/globals.css) and is the Tailwind v4 entry (Tailwind v4 uses CSS-first config via `@import`/`@theme` — no `tailwind.config.js`).
- **Styling stack**: Tailwind v4 (via `@tailwindcss/postcss`), `tw-animate-css`, `class-variance-authority`, `tailwind-merge`, `clsx`. The `cn()` utility lives in [web/lib/utils.ts](web/lib/utils.ts).
- **shadcn/ui** is configured in [web/components.json](web/components.json):
  - Icon library: `@phosphor-icons/react` (use this, not Lucide)
  - Components go in `@/components/ui` (e.g. [web/components/ui/button.tsx](web/components/ui/button.tsx)); shared utilities in `@/lib`; hooks alias is `@/hooks`
  - Add components with `pnpm dlx shadcn@latest add <component>` from inside `web/`
- **Path aliases** are defined in [web/tsconfig.json](web/tsconfig.json) — `@/*` maps to `web/*`.
- **NextJs 16 usa proxy.ts en lugar de middleware.ts** Para conocer su implementación puedes consultar su documentación

## OpenSpec Workflow

This project uses OpenSpec (see [openspec/](openspec/)) for spec-driven changes. Change proposals live under `openspec/changes/`, capability specs under `openspec/specs/`. When making non-trivial changes, prefer creating/continuing a change in `openspec/` rather than ad-hoc edits. Use `/sdd-*` or `/opsx:*` skills to drive the workflow.

## Conventions

- **Conventional commits only.** Do not add `Co-Authored-By` or AI attribution lines.
- **User-facing copy is Spanish neutral (tú, never voseo).** This applies to all UI strings, labels, errors, placeholders, and product-visible text. See the global rule in `~/.claude/CLAUDE.md`.
