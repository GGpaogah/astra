# SETUP.md — Development Environment

## Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| Windows | 10 or 11 | Target OS for running the application |
| Node.js | 22.12 | Required by Vite 8; check with `node --version` |
| npm | 11 | Check with `npm --version`; upgrade with `npm i -g npm@latest` |
| Git | any recent | For cloning and committing |

> Static validation (`typecheck`, `lint`) can also be run on Linux (e.g. in a CI VM),
> but `npm run dev` and `npm run build` require Windows because Electron and the service
> binaries (Apache, PHP, MariaDB) are Windows-only.

---

## 1. Clone and install

```bash
git clone <repo-url>
cd astra
npm install
```

On Windows, `npm install` downloads the Electron binary for Windows automatically.
If you switch between Linux and Windows, delete `node_modules` and re-run `npm install`
on the new OS — native bindings differ between platforms.

---

## 2. Place binary runtimes

Astra does not bundle any service binaries. Download them manually and place them
in `bin/` following the multi-version folder layout used by the Runtime Manager:

```
bin/
├── apache/
│   └── httpd-2.4.62-win64-VS17/       ← extracted archive, name unchanged
│       └── bin/httpd.exe
├── php/
│   ├── php-8.3.16-Win32-vs16-x64/     ← Thread Safe, required for Apache mod_php
│   └── php-8.3.11-nts-Win32-vs16-x64/ ← NTS, for Nginx / PHP-CGI (future)
├── mariadb/
│   └── mariadb-12.x-winx64/
│       └── bin/mariadbd.exe
└── composer/
    └── composer.phar
```

| Component | Source | Notes |
|---|---|---|
| Apache (Win64) | apachelounge.com | Use VS16 or VS17 build matching PHP |
| PHP Thread Safe | windows.php.net | TS build required for `mod_php` with Apache |
| MariaDB (ZIP) | mariadb.org | Extract and place the folder unchanged |
| phpMyAdmin | phpmyadmin.net | Place in `www/phpmyadmin/` |

The folder name becomes the version ID. The application reads it at startup via RuntimeManager.
MariaDB initialises its data directory automatically on first start — no manual step needed.

---

## 3. Static validation (Linux and Windows)

These commands do not require Electron or any service binary:

```bash
npm run typecheck   # TypeScript — must exit 0 before committing
npm run lint        # oxlint — must exit 0 before committing
```

---

## 4. Development (Windows only)

```bash
npm run dev
```

Opens the Electron window with hot-reload via Vite. Requires Apache and MariaDB binaries
in `bin/` to actually start those services from the UI. The app will start without them,
but service start buttons will report errors.

---

## 5. Production build (Windows only)

```bash
npm run build
```

Runs `tsc`, `vite build`, and `electron-builder`. Output goes to `release/`.
The packaged app does **not** include `bin/`, `data/`, `www/`, `etc/`, or `tmp/`.
Those folders are created at runtime next to `Astra.exe`.

Templates (`electron/templates/`) and helper scripts (`electron/helpers/`) are copied
to `resources/electron/` via `extraResources` in `package.json` — they are readable
at runtime via `process.resourcesPath`, not bundled inside the read-only `app.asar`.

---

## 6. Project structure notes

```
astra/
├── bin/          # Runtime binaries (not committed)
├── data/         # Persistent data: MariaDB datadir, settings.json (not committed)
├── etc/          # Generated configs: httpd.conf, php.ini, my.ini (not committed)
├── tmp/          # PHP sessions, uploads — flat layout, ala Laragon (not committed)
├── usr/tpl/      # User template overrides (not committed, .gitkeep only)
├── www/          # Web root (not committed, .gitkeep only)
├── electron/     # Main process: services, IPC, config generation
├── src/          # React renderer
└── release/      # Build output (not committed)
```

Folders that are not committed to git (`bin/`, `data/`, `etc/`, `tmp/`, `www/`, `logs/`,
`release/`) are created automatically by the application at startup via `Paths.ensureDirs()`.

---

## 7. Troubleshooting

### Native binding errors after switching OS

```
Cannot find native binding
npm error ... 'edgesOut'
```

Delete `node_modules` and `package-lock.json`, then re-run `npm install` on Windows:
```powershell
cmd /c "rmdir /s /q node_modules"
Remove-Item package-lock.json
npm install
```

### app.asar locked on rebuild

```
app.asar ... being used by another process
```

Close `Astra.exe` completely. Delete the `release/` folder. If the problem persists,
add the project folder to Windows Defender exclusions.

### Developer Mode required for symlinks

```
Cannot create symbolic link
```

Enable Developer Mode in Windows Settings, or run the terminal as Administrator.

### Port 80 already in use

Usually IIS, Skype, or another web server. Either change the Apache port in Astra
settings, or stop the conflicting service: `net stop http` (requires admin).

### Apache fails to start

Check `logs/apache/error.log`. Common causes: `ServerRoot` path contains special characters,
PHP DLL not found, or port conflict. The service card in the UI shows the last error line.

### MariaDB warning: missing system tables

```
Missing system table mysql.proxies_priv
```

Non-fatal. Occurs when the data directory was initialised with an older MariaDB version.
Run `mysql_upgrade` once to resolve, or accept the warning — the server functions normally.

### `window.api` is undefined in renderer

The preload script path in `electron/main.ts` does not match `dist-electron/preload.mjs`.
Check that the `webPreferences.preload` path uses `preload.mjs`, not `preload.js`.

### Import errors: `electron` not found / `default` not exported

```
does not provide an export named 'electron'
"default" is not exported by src/lib/ipc.ts
```

For the Electron plugin: use `import electron from "vite-plugin-electron/simple"` (no braces).
For IPC wrappers: ensure named and default exports are consistent between the module and its importers.

---

## 8. What static validation cannot verify

`npm run typecheck` and `npm run lint` confirm type correctness and code style.
They do **not** verify:

- That Apache, PHP, or MariaDB actually starts
- That port detection works correctly
- That config generation produces valid configuration files
- That the packaged build (`npm run build`) works at runtime
- That `extraResources` files are correctly resolved from `process.resourcesPath`

These require manual testing on Windows with actual service binaries installed.
