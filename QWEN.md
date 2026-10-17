# caretellia — Project Notes

## Project Overview

A Tauri + Vue 3 + TypeScript desktop application. The frontend is a Vite-built Vue 3 SPA; the backend is a Rust Tauri app. Current UI is a single "postcard" component styled as a letter/paper card with a stamp border.

**Tech stack:** Vue 3 `<script setup>`, Vite, TypeScript (strict), Tauri v2, Rust (edition 2021).

## Build & Run

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server (port 1420) |
| `npm run build` | `vue-tsc --noEmit && vite build` |
| `npm run preview` | Preview production build |
| `npm run tauri` | Tauri CLI (`tauri dev` / `tauri build`) |

Run `npm run tauri dev` for full dev mode (Rust + Vite).

## Directory Layout

```
src/                   # Vue frontend (App.vue, postcard.vue, main.ts)
src-tauri/             # Rust backend (src/main.rs, src/lib.rs, Cargo.toml)
public/                # Static assets (tauri.svg, vite.svg)
```

## Conventions & Notes

- **Vue:** `<script setup lang="ts">` SFCs; component file names are lowercase (e.g. `postcard.vue`).
- **Rust:** Tauri commands use `#[tauri::command]`; app entry in `lib.rs`, binary shim in `main.rs`.
- **Styling:** CSS custom properties in `:root`, dark mode via `@media (prefers-color-scheme: dark)`. BEM-like class names (`.postcard__texture`, `.postcard__stamp-box`).
- **TS strict:** `tsconfig.json` enables `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- **Vite dev:** fixed port 1420; ignores `src-tauri/` for HMR watch.

## Open / Todo

- App currently shows a decorative postcard — no business logic implemented yet.
- `greet` Rust command exists as a placeholder; no real Tauri command wiring beyond that.
- **Postcard Generator** (`src/postcard-editor.vue`): 3-phase animation (envelope → opened → expanded) matching reference layering: letter-mask (z:1) → mail-base (z:10) → envelope-flap (z:15) → expanded letter (z:20), click-to-open, letter mask expands, base rotates -6deg and sinks, localStorage history, HTML export with Rust save_postcard command (saves to ./postcards folder), Chinese UI labels. Postcard: flip animation, image on top + caption below, sharp corners, proper stamp sizing. Paper texture on letter (grid lines + radial gradient), handwriting font options + Google Fonts embedding at export time (charset-aware subset download for woff2).
