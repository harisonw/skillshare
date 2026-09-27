# Frontend Development

Use when changing React components, pages, CSS, responsive layouts, interactions, or visual behavior in the `ui/` dashboard or `website/`.

## Shared Workflow

1. Decide whether the target is the dashboard or public website; they use different visual languages.
2. Search neighboring pages/components and existing tokens/classes before creating anything new.
3. Preserve data, loading, error, empty, keyboard, and accessibility states.
4. Build and test inside the devcontainer, then capture and inspect screenshots for visual changes.
5. Check Clean/Playful × light/dark for the dashboard, and light/dark plus affected breakpoints for the website.

## Dashboard Sources of Truth

| Concern | Source |
|---|---|
| Tokens and `ss-*` classes | `ui/src/components.css` |
| Tailwind token mapping | `ui/src/index.css` |
| Theme selection | `ui/src/context/ThemeContext.tsx` |
| Shared components | `ui/src/components/` |
| Query keys | `ui/src/lib/queryKeys.ts` |
| API client | `ui/src/api/client.ts` |
| Translation strings | `ui/src/i18n/` |

The dashboard supports Clean and Playful styles plus light, dark, and system modes. New UI must use CSS variables, token utilities, and existing `ss-*` classes. Never hardcode colors, radii, shadows, or fonts. Scope Playful-only pastels to the Playful theme.

## Dashboard Composition

- Use `ss-wrap animate-fade-in` on the page root and place `PageHeader` first.
- Prefer `ss-list` and `ss-r` for lists, `ss-note bad` for errors, and `EmptyState` for empty states.
- Use existing shared components such as `Button`, `IconButton`, `Card`, `DialogShell`, `ConfirmDialog`, `Input`, `Select`, `Checkbox`, `Pagination`, and `Tooltip`.
- Route destructive actions through `ConfirmDialog`; never use `window.confirm()`.
- Use `lucide-react` icons. Use `AgentIcon` for real agents/tools rather than emoji or generic icons.
- Icon-only controls require accessible names, and interactive targets must be at least 24 px.
- Route user-visible strings through `useT()`. Preserve existing English technical labels for status, mode, and kind values.
- Use existing TanStack Query keys, client helpers, and stale-time patterns. Invalidate the correct queries after mutations.

Do not run an unconfigured Prettier in `ui/` because it creates broad unrelated diffs. When Tailwind utilities conflict with the `ss-*` component layer, inspect the cascade before adding more complex selectors.

## Website Boundary

This topic also loads `website/AGENTS.md` for website-specific commands, structure, and deployment rules. Additional boundaries:

- Documentation chrome uses the clean treatment. The hand-drawn string-board treatment belongs only to the homepage and feature map.
- The website keeps its existing `--color-pencil` and `--color-paper` token names. Do not import the dashboard's `--ink` and `--bg` naming.
- Mermaid uses the global configuration. Keep labels short, use `<br/>` for line breaks, and verify rendered output with a screenshot.
- Load `documentation` for content changes. Verify public behavior against Go source before writing it.

## Verification

Run all package commands inside the devcontainer. Select checks according to scope:

- Dashboard: targeted Vitest, `pnpm run lint`, `pnpm run build`, and visual screenshots.
- Website: `pnpm run typecheck` and `pnpm run build`; the build validates broken links.
- API-connected UI: compare `internal/server/server.go` routes, handler tests, and client types.

Report the themes, modes, and viewport sizes inspected, plus any visual verification that could not be performed.
