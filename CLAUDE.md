# CLAUDE.md — Aturan Kerja Agen AI

Proyek: **Astra** (Electron + TypeScript + React + Vite + Tailwind, ES Modules). Berlaku untuk semua agen (Claude, Kiro, Hermes, Gemini, dll.).
Tidak ada folder aturan tersembunyi (`.kiro/` dll.): **semua aturan ada di 8 berkas di root**. Awali setiap sesi dengan membaca berkas ini.

## Urutan baca

1. `CLAUDE.md` (ini) → 2. `TASK.md` (tugas aktif) → 3. berkas yang relevan saja: `SECURITY.md` (wajib bila menyentuh IPC, file, unduhan, proses), `TECHSTACK.md` (arsitektur), `SKILL.md` (playbook), `STYLEGUIDE.md` (gaya), `PRD.md` (keputusan produk).
   Jangan membaca ulang seluruh repo. Kode adalah sumber kebenaran; dokumen bisa tertinggal.

## Aturan inti

- Renderer tidak memakai API Node; semua lewat `window.api` (preload) dan IPC yang divalidasi di main process.
- Semua path lewat `electron/core/Paths.ts`. Semua service extend `BaseService` dan hanya bind ke `127.0.0.1`.
- Config di `etc/` hasil generate dari template (`usr/tpl` menimpa `electron/templates` lewat `TemplateResolver`); jangan edit langsung.
- Berkas yang dieksekusi proses lain (`.ps1`, `.exe`) dan berkas yang dibaca saat runtime harus lewat `extraResources`, bukan di dalam `app.asar`.
- Jangan mengganti versi runtime aktif secara otomatis. Jangan menghapus atau menginisialisasi ulang data database.
- Aturan keamanan lengkap: `SECURITY.md`.

## Dependensi dan Git

- npm saja. Dilarang `pnpm-lock.yaml`, `pnpm-workspace.yaml`, yarn. Tanpa dependensi baru tanpa persetujuan.
- Jangan commit `package-lock.json` dari Linux; jangan commit `bin/ data/ logs/ etc/ tmp/ release/ dist-electron/` maupun isi `www/` dan `usr/`.
- Satu tugas = satu commit kecil dengan awalan konvensional (lihat `STYLEGUIDE.md`). Tanpa perintah Git destruktif. Cek `git status` sebelum mulai dan sebelum commit; jika tidak bersih di awal, laporkan dan berhenti.

## Lingkungan dan validasi

Cek `node -p process.platform` dulu.

- **Windows:** boleh `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. **Dilarang** menjalankan Electron (`npm run dev`), Apache, MariaDB, atau service lain tanpa izin; uji fungsional dilakukan pemilik.
- **Linux/VM:** hanya typecheck dan lint.
- Satu agen aktif pada satu waktu; commit (boleh `wip:`) sebelum berganti agen.
- Jangan klaim "selesai/lulus/teruji" tanpa menjalankan perintahnya dan melihat exit 0. Setelah **setiap edit berkas**, verifikasi hasilnya (baca balik atau `git diff`); edit yang gagal tidak boleh dilaporkan sebagai berhasil.
- Format API/data eksternal harus diverifikasi dengan request nyata dan disimpan sebagai fixture **sebelum** parser ditulis (lihat `SKILL.md`, Playbook 6).

## Gaya kerja (hemat kuota)

- Tugas kecil dan jelas: langsung kerjakan. Tanya hanya bila ada keputusan desain yang ambigu.
- Jangan mencetak JSON/berkas besar; tampilkan struktur dan sampel saja.
- Satu masalah dianalisis dari akarnya dengan tes yang mereproduksi, bukan ditambal berulang-ulang.

## Dokumentasi

Hanya 8 berkas `.md` di root. Jangan membuat berkas `.md` baru. Perbarui `TASK.md` (status) di akhir tugas; ubah dokumen lain hanya bila tugas memintanya atau faktanya berubah.

## Laporan akhir (maks. 30 baris)

Berkas berubah · keputusan dan trade-off · edge case · apa yang benar-benar dijalankan (typecheck/lint/test/build) · apa yang perlu diuji manual di Windows. Tanpa mengulang isi berkas.
