# SETUP

## Prasyarat

- Windows 10/11 (target utama)
- Node.js 22.12+ (wajib untuk Vite 8) dan npm 11 (`npm i -g npm@latest`)
- Git
- VS Code (atau Cursor / Claude Code)

## Windows Tester

- Windows 11
- Node.js 24.22.0 dan npm 12.2.0
- Git
- Vscode

> **Penting (alur Hermes di VM Linux + uji di Windows):**
>
> - Kode ditulis/diedit di VM (Hermes), diuji di Windows lewat Git.
> - Binary Apache/PHP/MariaDB Windows (`bin/`) dan `npm run dev` hanya dijalankan di **Windows**.
> - Di VM cukup `npm install`, lint, dan type-check (`npx tsc --noEmit`). VM tidak punya layar untuk Electron.
> - Setelah `git pull` di Windows, jalankan `npm install` lagi (Electron mengunduh binary sesuai OS).

## 1. Inisialisasi Proyek

```bash
npm create vite@latest astra -- --template react-ts
cd astra
npm install
npm install -D electron electron-builder vite-plugin-electron vite-plugin-electron-renderer tailwindcss @tailwindcss/vite
npm install tree-kill get-port
```

## 2. Siapkan Binary (portable)

Download manual dulu untuk MVP, taruh di folder `bin/`:

| Komponen          | Sumber           | Folder tujuan     |
| ----------------- | ---------------- | ----------------- |
| Apache (Win64)    | apachelounge.com | `bin/apache/`     |
| PHP (Thread Safe) | windows.php.net  | `bin/php/8.3/`    |
| MariaDB (zip)     | mariadb.org      | `bin/mariadb/`    |
| phpMyAdmin        | phpmyadmin.net   | `www/phpmyadmin/` |

Catatan: untuk Apache, pakai build Thread Safe PHP + `php8apache2_4.dll`.

## 3. Konfigurasi Electron + Vite (sudah teruji berjalan)

`package.json` (proyek ESM, `"type": "module"`):

```json
{
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "build": "tsc && vite build && electron-builder"
  },
  "build": {
    "appId": "com.astra.app",
    "productName": "Astra",
    "directories": { "output": "release" },
    "files": ["dist/**/*", "dist-electron/**/*"],
    "win": { "target": "nsis" }
  }
}
```

`vite.config.ts` (plugin React tetap harus ada; import Electron tanpa kurung kurawal):

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: { entry: "electron/main.ts" },
      preload: { input: "electron/preload.ts" },
    }),
  ],
});
```

Nama file hasil build (cek dengan `dir dist-electron`):

- main process: `dist-electron/main.js`
- preload: `dist-electron/preload.mjs` → di `main.ts` pakai `path.join(__dirname, "preload.mjs")`

Karena ESM, `__dirname` harus dibuat manual di `electron/main.ts`:

```ts
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

Mode produksi memuat UI dengan `win.loadFile(path.join(__dirname, "../dist/index.html"))`;
mode dev memakai `process.env.VITE_DEV_SERVER_URL`.

Penyimpanan settings: file JSON via `fs` (hindari `electron-store` baru yang ESM-only).

## 4. Inisialisasi MariaDB (sekali saja)

```bash
bin/mariadb/bin/mariadb-install-db.exe --datadir=data/mysql
```

## 5. Jalankan

```bash
npm run dev
```

## Troubleshooting Umum

- **Port 80 dipakai**: biasanya IIS, Skype, atau XAMPP lain. Ubah port atau matikan layanan.
- **Edit hosts gagal**: aplikasi perlu dijalankan sebagai Administrator.
- **Apache tidak mau start**: cek `logs/apache/error.log`, biasanya path `ServerRoot` salah.

## Troubleshooting Hasil Uji di Windows

| Gejala                                          | Penyebab & solusi                                                                                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cannot find native binding` (rolldown)         | `package-lock.json`/`node_modules` dari Linux. Hapus keduanya di Windows, `npm install` ulang                                                                                                         |
| `npm error ... 'edgesOut'` / `'matches'`        | `node_modules` sisa pnpm (`.pnpm`) atau bug npm 10. Hapus `node_modules` via `cmd /c "rmdir /s /q node_modules"`, upgrade Node 22.12+ dan npm 11, lalu `npm install` (cadangan: `--legacy-peer-deps`) |
| `does not provide an export named 'electron'`   | Pakai `import electron from "vite-plugin-electron/simple"`                                                                                                                                            |
| `"default" is not exported by src/lib/ipc.ts`   | Samakan named vs default import/export                                                                                                                                                                |
| `Application entry file ... main.mjs not found` | `"main"` di package.json harus sama dengan hasil build (`main.js`)                                                                                                                                    |
| `app.asar ... being used by another process`    | Tutup `Astra.exe`, hapus folder `release`, kecualikan folder proyek dari Windows Defender                                                                                                             |
| `Cannot create symbolic link` (winCodeSign)     | Aktifkan Developer Mode Windows atau jalankan terminal sebagai Administrator                                                                                                                          |
| `window.api` undefined                          | Path preload di `main.ts` tidak cocok dengan file di `dist-electron/` (`preload.mjs`)                                                                                                                 |
