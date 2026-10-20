# CLAUDE.md — AI Coding Agent Instructions

Project: **Astra** — portable local web development environment for Windows.  
Stack: Electron + TypeScript + React + Vite + Tailwind CSS. ES Modules (`"type": "module"`).

> **Authoritative rules are in `.kiro/steering/astra rules.md`.**  
> This file is a concise entry point for any AI coding agent (Claude, Kiro, Gemini, etc.).

---

## Required reading before any code change

1. `.kiro/steering/astra rules.md` — project rules and security constraints
2. `ARCHITECTURE.md` — system design and module responsibilities
3. The specific source files relevant to the task

Do not rely on documentation alone to determine whether a feature is implemented.  
Read the actual source code. Documentation may lag behind the implementation.

---

## Architecture invariants

- The renderer process must never call Node.js APIs directly.
- All renderer↔main communication goes through `window.api` (defined in `electron/preload.ts`).
- All IPC handlers must validate inputs in the main process.
- All filesystem paths must go through `electron/core/Paths.ts`.
- All services must extend `BaseService` and bind only to `127.0.0.1`.
- Config files in `etc/` are always generated from templates — never edited directly.
- Files executed by external processes (`.ps1`, `.exe`, `.cmd`) must be in `extraResources`, not `app.asar`. Read their paths via `Paths.helpers` or `Paths.templates`.

## Security constraints

- Validate IPC inputs: URLs via `new URL()` (exact hostname), paths via `path.resolve` + root check, names via whitelist regex. Reject `..` and absolute paths from the renderer.
- Passwords and tokens must not appear in process arguments. Use environment variables or credential files in `data/`.
- Do not expose unrestricted Node.js capabilities to the renderer.
- Do not silently switch active runtime versions.

## Dependency management

- Use `npm` only. Do not create `pnpm-lock.yaml` or use `yarn`.
- Do not add new dependencies without explicit approval.
- Do not commit `package-lock.json` from a Linux environment.

## Validation

On Windows: `npm run typecheck` and `npm run lint` must pass before committing.  
On Linux/VM: typecheck and lint only; do not run Electron, Apache, MariaDB, or any Windows binary.

Do not claim that tests passed unless the commands were executed and returned exit 0.  
Do not claim Windows-specific behavior was verified in a Linux environment.

## Reporting

End-of-task reports must cover:
- Files changed
- Key decisions and trade-offs
- Edge cases handled
- Manual verification steps for Windows

Keep reports to 30 lines or fewer. Do not echo entire file contents.

---

## Available commands

```bash
npm run typecheck   # TypeScript validation (no emit)
npm run lint        # oxlint
npm run build       # tsc + vite build + electron-builder (Windows only)
npm run dev         # development server (Windows only)
```

---

## Further reading

- [SETUP.md](SETUP.md) — contributor setup and troubleshooting
- [SETUP_HERMES.md](SETUP_HERMES.md) — optional Hermes Agent + VM workflow
- [ROADMAP_PROMPTS.md](ROADMAP_PROMPTS.md) — development phases and planned work
