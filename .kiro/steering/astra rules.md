---
inclusion: always
---

# Astra — Aturan Proyek

Astra: aplikasi desktop lingkungan dev web lokal (mirip Laragon) untuk Windows.
Stack: Electron + TypeScript + React + Vite 8 + Tailwind v4. Proyek ESM (`"type": "module"`).
Dokumen: `README.md`, `ARCHITECTURE.md`, `ROADMAP_PROMPTS.md` (peta fase; jangan dibaca penuh kecuali diminta).

## Aturan kode
- Renderer tidak boleh memakai API Node; semua lewat IPC di `electron/preload.ts` (`window.api`).
- Validasi ketat di semua handler IPC: URL via `new URL()` (hostname persis), path via `path.resolve` + cek di dalam root, nama via whitelist regex. Tolak `..` dan path absolut dari renderer.
- Semua path lewat `electron/core/Paths.ts`. Gunakan `path.join`/`path.resolve`; tanpa path hardcode.
- Semua service extend `BaseService`. Semua layanan hanya bind ke `127.0.0.1`.
- Config di `etc/` selalu hasil generate dari template (`usr/tpl` menimpa `electron/templates` bila ada). Path di config memakai forward slash.
- Password/token tidak boleh lewat argumen proses (pakai env atau file kredensial di `data/`, tidak di Git).
- Error ditangani dengan pesan jelas ke UI, tanpa crash diam-diam. Log: ring buffer 1000 baris (main), 500 baris (UI).
- Tanpa dependency baru kecuali disebut di tugas; tanyakan dulu.
- Berkas yang dieksekusi proses eksternal (skrip .ps1, .exe, .cmd) TIDAK boleh berada di dalam `app.asar`. Sertakan lewat `extraResources` dan ambil path-nya dari `Paths` (`process.resourcesPath` saat `app.isPackaged`).
- Setiap berkas baru yang dibaca saat runtime (template, skrip, aset) harus dipastikan ikut terkemas: periksa `build.files` dan `build.extraResources` di package.json.

## Aturan teknis
- Package manager: npm saja. Jangan buat `pnpm-lock.yaml`. Jangan commit `package-lock.json` dari Linux.
- Build: `dist-electron/main.js` dan `dist-electron/preload.mjs` (preload dimuat sebagai `preload.mjs`). Jangan ubah `"main"` tanpa memeriksa output.
- `__dirname` tidak ada di ESM; buat dari `import.meta.url`.
- `import electron from "vite-plugin-electron/simple"`; jangan hapus plugin `react()`.
- Jaga konsistensi named vs default export; periksa semua importer saat mengubah ekspor.
- Jangan commit `bin/`, `data/`, `logs/`, `etc/`, `tmp/`, `release/`, `dist-electron/`.

## Lingkungan eksekusi
- Cek platform dulu (`node -p process.platform`).
- Jika `win32` (Kiro berjalan di Windows): boleh menjalankan `npm run typecheck`, `npm run lint`, dan `npm run build`. JANGAN menjalankan Electron GUI, Apache, MariaDB, atau service lain tanpa izin eksplisit; pengujian fungsional dilakukan user.
- Jika Linux (VM via SSH): hanya `typecheck` dan `lint`; binary Windows tidak bisa dijalankan. Bungkus operasi khusus Windows agar type-check lolos.

## Gaya kerja (hemat kuota)
- Baca hanya file yang relevan; jangan membaca ulang seluruh repo.
- Tugas kecil dan jelas: langsung kerjakan. Tanya hanya jika ada keputusan desain yang ambigu.
- Satu fase = satu commit kecil; periksa `git status` agar tidak ada file di luar lingkup.
- Laporan akhir maksimal 30 baris: file berubah, keputusan penting, edge case, langkah uji di Windows. Tanpa kode utuh.