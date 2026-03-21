---
name: frontend
description: Frontend standards and design language for Party Games. Use when writing, reviewing, or planning any React/TypeScript/Tailwind frontend code in this project.
user-invocable: true
---

# Frontend Skill — Party Games

## Stack

| Layer | Tech |
|---|---|
| Build | Vite (via React Router v7 SPA mode) |
| UI lib | React + TypeScript |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`, no `tailwind.config.js`) |
| Icons | lucide-react |
| Animations | CSS `@keyframes` / Tailwind `animate-*` first; framer-motion only for gesture/physics |
| Dev | `make dev` — Vite on :5173, proxies `/api/v1` → `:8080` |

---

## Design Language

- **Liquid glass aesthetic** — translucent surfaces (`backdrop-blur`, `bg-white/5`, subtle borders). Frosted glass over a dark gradient, not flat cards.
- **Dark theme only** — non-negotiable. Never add light mode toggles or theme switches.
- **Custom Google Fonts** — always load expressive fonts (display for headings, mono for data). Never rely on system defaults for anything visible. Load via `<link rel="preconnect">` + `font-display: swap`.
- **Emojis + lucide icons** — lucide-react for actions/status; emojis for personality and visual anchors. Both intentional, never decorative noise.

---

## Code Quality

- **Readability first** — short, named components with one obvious job. If JSX exceeds ~40 lines, extract it.
- **Maximum reuse** — build components generic enough to move between apps. If something is used twice, it becomes a shared component.
- **No inline style soup** — all visual work goes through Tailwind classes. Custom CSS only for things Tailwind can't express (keyframes, complex clip-paths).
- **Animations via CSS/Tailwind** — `@keyframes` in a CSS file or Tailwind `animate-*` utilities. Use framer-motion only when gesture or physics behaviour is genuinely needed, not just for fades.

---

## Responsive Strategy

- **Mobile-first by default** — base styles for `sm:`, scale up. Touch targets ≥ 44px. No hover-only interactions.
- **Desktop-only exceptions** — `SlopMachine` and all service/admin screens are large-screen only. No need to make them responsive; a "best viewed on desktop" note is fine.

---

## Pre-Ship Checklist

- [ ] Works and looks good on 375px wide (iPhone SE)
- [ ] No layout shift on load (reserve space for async content)
- [ ] Fonts loaded via `<link rel="preconnect">` + `font-display: swap`
- [ ] Interactive elements have visible focus states
- [ ] No hardcoded colors — everything through Tailwind design tokens

---

## Adding a New Route

1. Create `app/routes/<name>.tsx` with a default export component.
2. Register in `app/routes.ts`: `route("<path>", "routes/<name>.tsx")`.
3. Optionally link from `app/routes/home.tsx`.

---

## Do / Don't

| Do | Don't |
|---|---|
| CSS `@keyframes` or `animate-*` for transitions | framer-motion just for a fade |
| Extract components > 40 lines | Leave one giant JSX blob |
| Tailwind tokens for every color | Hardcode hex values |
| lucide-react for UI icons, emojis for personality | Mix both purposes randomly |
| Mobile-first, then scale up | Desktop-first then try to shrink |
| Shared components when used ≥ twice | One-off wrapper components |
