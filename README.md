# Astra

**Astra** is a free, portable local web development environment for Windows, built as an open alternative to tools like Laragon.

It runs Apache, PHP, and MariaDB as managed services from a single desktop application, without requiring installation of system-level services or administrative privileges for normal operation.

---

## What Astra does

- Starts and stops Apache, PHP (via mod\_php), and MariaDB as portable processes
- Manages multiple installed PHP and MariaDB versions simultaneously
- Generates configuration files from templates at runtime
- Streams service logs to the UI in real time
- Detects port conflicts before attempting to start a service
- Cleans up PHP session and upload temporary files automatically
- Allows user-level template overrides in `usr/tpl/`

## What Astra does not yet do

The following features are planned but not currently implemented:

- Virtual host management (`.test` domains)
- Automatic runtime download and installation
- Nginx support
- PostgreSQL support
- SSL (mkcert)
- Project Quick Create (Laravel, WordPress)
- Tray icon and Windows autostart
- Terminal launcher
- Settings UI

See [ROADMAP_PROMPTS.md](ROADMAP_PROMPTS.md) for planned phases and their status.

---

## Relationship to Laragon

Astra follows Laragon's portable folder layout (`bin/`, `etc/`, `tmp/`, `usr/`, `www/`) and multi-version runtime model. It is not a fork and does not share any code with Laragon. Astra is under active development and is not yet equivalent to Laragon in features or stability.

---

## Technology stack

| Layer | Choice | Version |
|---|---|---|
| Desktop shell | Electron | ^44 |
| Language | TypeScript | ~7.0 |
| UI framework | React | ^19.3 |
| Build tool | Vite | ^8.3 |
| CSS | Tailwind CSS | ^4.3 |
| Module format | ES Modules | — |
| Package manager | npm | ≥11 |
| Packaging | electron-builder | ^26.5 |
| Node.js (required) | Node.js | ≥22.12 |

---

## Prerequisites

- Windows 10 or 11
- Node.js 22.12 or later (`node --version`)
- npm 11 or later (`npm --version`)
- Git

Binary runtimes (Apache, PHP, MariaDB) are **not** included in the repository. Place them manually in `bin/` following the structure described in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Getting started

```bash
# Clone and install
git clone <repo-url>
cd astra
npm install

# Validate (no Windows runtime required)
npm run typecheck
npm run lint

# Development (Windows only — requires Electron and service binaries)
npm run dev

# Production build (Windows only)
npm run build
```

For detailed setup instructions, binary placement, and troubleshooting, see [SETUP.md](SETUP.md).

---

## Project documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, module descriptions, security boundaries |
| [ROADMAP_PROMPTS.md](ROADMAP_PROMPTS.md) | Development phases and implementation prompts |
| [SETUP.md](SETUP.md) | Development environment setup and troubleshooting |
| [SETUP_HERMES.md](SETUP_HERMES.md) | Optional: remote development via Hermes Agent + VM |
| [CLAUDE.md](CLAUDE.md) | Instructions for AI coding agents |
