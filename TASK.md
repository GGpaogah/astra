# TASK.md — Tugas, Fase, dan Temuan

Cara memakai: perintah ke agen cukup _"Kerjakan T-xx dari TASK.md"_. Agen membaca `CLAUDE.md`, tugas itu, dan berkas relevan saja, lalu memperbarui status di sini.
Status: `[x]` selesai terverifikasi · `[~]` sebagian · `[ ]` belum · `[-]` dibatalkan.

## 0. Keputusan yang sudah diambil

- **Unduhan otomatis runtime dibatalkan.** Pengguna memasang versi yang diinginkan secara manual (folder arsip di `bin/<jenis>/` + Pindai ulang). Pengguna tetap bisa menghapus versi yang tidak diinginkan dari UI (T-6D).
- Urutan kerja: **T-6R → T-6D → T-07**.

## 1. Status ringkas

- [x] 1–3 Kerangka, BaseService/ServiceManager, MariaDB
- [x] 4 Apache + PHP + phpMyAdmin (manual di `www/phpmyadmin/`)
- [x] 5 Runtime Manager · [x] 5B `tmp/` + `usr/` + TemplateResolver + TmpCleaner
- [x] Hygiene: CI (typecheck+lint), packaging `extraResources`, gitignore, dokumentasi 8 berkas
- [-] 6A Resolver + katalog · [-] 6B Download Manager · [-] 6C Wizard unduhan (dibatalkan; kode masih ada sampai T-6R)
- [ ] T-6R Hapus kode unduhan · [ ] T-6D Hapus versi yang andal
- [ ] 7 Virtual host `.test` (skrip `update-hosts.ps1` ada; logika belum)
- [ ] 8 Nginx + PHP-CGI · 8B PostgreSQL + tool DB · 8C layanan generik
- [ ] 9 Quick Create · 10 Node/Python + terminal · 11 Menu Tools · 12 SSL/tray/installer · 13 Opsional

## 2. Temuan terbuka

1. phpMyAdmin belum ada di `www/phpmyadmin/` (404 di `/phpmyadmin`): ekstrak manual dari phpmyadmin.net lalu restart Apache.
2. Verifikasi TmpCleaner dengan berkas pancingan: `tmp\hosts.tmp` dan `tmp\php_errors.log` bertanggal lama harus tetap ada setelah "Bersihkan tmp".
3. Uji build produksi: `release\win-unpacked` + junction `bin` → template ditemukan, folder runtime dibuat di samping `Astra.exe`, Start All jalan.
4. Daya laptop tidak andal: commit+push sering; Stop All sebelum menutup layar.

## 3. Tugas aktif

### T-6R — Hapus kode unduhan otomatis

1. Hapus: `electron/core/download/` (resolver, VersionResolver, ResolverCache, DownloadManager, fixture), `catalog/` dan entri `catalog` di `extraResources`, `electron/ipc/catalog.ipc.ts` beserta registrasi di `main.ts`, preload, `src/types.d.ts`, `src/lib/ipc.ts`, tombol Install/progres/notifikasi di `VersionsPage`, allowlist domain unduhan, penanganan `data/resolver-cache.json` dan `data/downloads/`.
2. Pertahankan: RuntimeManager, "Buka folder", "Pindai ulang". Pertahankan pembersihan startup ringan untuk sisa `__tmp_*` dan `__del_*` di `bin/<jenis>/` (hanya berawalan itu).
3. UI Versions: tiap jenis menampilkan pola nama folder yang diharapkan + contoh, tombol "Buka folder `bin/<jenis>`" dan "Pindai ulang", serta daftar folder invalid dengan alasan (marker tidak ditemukan / folder pembungkus ganda). Opsional: "Perbaiki struktur" (angkat isi satu level; hanya jika ada tepat satu subfolder berisi marker; rename atomik; konfirmasi).
4. Pastikan `git grep -n -i "download\|catalog\|resolver\|allowlist"` tidak menyisakan rujukan yang relevan.
   **Selesai bila:** typecheck/lint/test/build lulus; build produksi tidak lagi membawa `catalog/`; tab Versions tetap mendeteksi versi manual dan folder invalid ditandai dengan alasan.

### T-6D — Hapus versi runtime yang andal

Ikuti `SKILL.md` Playbook 7 dan `SECURITY.md` §6–7.

1. Prasyarat: tolak versi aktif atau yang dipakai service berjalan; peringatan bila satu-satunya versi; layout "default" butuh konfirmasi ketik nama.
2. Deteksi proses dari folder (PowerShell, path lewat variabel lingkungan); tawarkan "Hentikan proses ini" dengan konfirmasi.
3. Rename ke `__del_<waktu>` → `fs.rm` retry; gagal → status "menunggu dihapus (N)" + tombol "Coba lagi"; bersihkan otomatis saat startup.
4. Dialog konfirmasi (nama, path, ukuran, "data database tidak ikut terhapus"); tombol nonaktif saat proses; pesan hasil nyata dengan errno, path, dan langkah berikut.
5. `logs/astra-runtime-ops.log`; tes `node --test` (berkas read-only, berkas terbuka/terkunci, versi aktif ditolak, pemulihan startup) dan `npm test` di CI.
   **Selesai bila:** tes lulus; uji manual Windows: hapus versi tak terpakai; hapus saat Explorer membuka folder; hapus saat proses masih hidup (pesan menyebut nama+PID); hapus versi aktif ditolak; antivirus aktif vs pengecualian; sisa `__del_*` hilang setelah restart.

### T-07 — Virtual host `.test` (Fase 7)

1. `VHostManager`: scan `www/` (abaikan `phpmyadmin`, `adminer`, awalan titik; `public/` = docroot Laravel); nama valid huruf kecil/angka/minus; generate `etc/apache/vhosts/<nama>.conf` dari template via `TemplateResolver`; hapus vhost yatim; vhost default `localhost`.
2. `HostsFile` + helper UAC: blok `# BEGIN ASTRA`/`# END ASTRA`; tulis ke `tmp/hosts.tmp`, jalankan `electron/helpers/update-hosts.ps1` (`-Verb RunAs`, di `extraResources`); validasi baris; cadangan sekali ke `data/hosts.backup`; baca ulang hasil. Tanpa izin → status `needs-admin`, tanpa crash.
3. Apache: `httpd -t` sebelum reload; lolos → `-k graceful`, fallback restart.
4. IPC `sites.ipc.ts` (list, sync, open, open-folder) dengan validasi `SECURITY.md`; `app:open-external` mengizinkan `localhost` dan sufiks Astra.
5. Watcher `www/` (debounce 500 ms) menandai "menunggu sinkronisasi"; UAC hanya saat user menekan Sinkronkan.
6. UI tab Sites; setting `domainSuffix` (default `.test`).
   **Selesai bila:** typecheck/lint/test lulus; uji manual: `toko.test` & `blog.test` terbentuk dan terbuka, hapus folder lalu sinkron menghapus vhost+baris hosts, tolak UAC → pesan (tanpa crash), nama aneh (`Toko Baru`, `a_b`) diabaikan dengan peringatan, `hosts.backup` ada, TmpCleaner tidak menyentuh `hosts.tmp`, berfungsi juga dari `win-unpacked`.

## 4. Backlog

### T-08 — Nginx + PHP-CGI

`NginxService` (`nginx -t`, `-s quit`, fallback kill), `PhpCgiService` per versi PHP (port dinamis), pemilih web server aktif (satu di port web), `.astra.json` `{php:"8.2"}` berlaku penuh di Nginx (Apache `mod_php` global; tampilkan peringatan), `php.ini` per runtime (`etc/php/<folderId>/php.ini`).

### T-8B — PostgreSQL + alat DB

Runtime `postgresql` (data dir `data/postgresql/<mayor>/`, tidak dimigrasi otomatis, peringatan pergantian mayor); `PostgresService`: tolak bila Astra berjalan sebagai Administrator, `initdb -E UTF8 --locale=C --auth=trust` (hanya 127.0.0.1), config di-generate, start foreground, siap via `pg_isready`, stop `pg_ctl -m fast` + fallback; ekstensi PHP `pgsql`/`pdo_pgsql`; Adminer; HeidiSQL portable; tipe `tool` di RuntimeDefinition (phpMyAdmin/Adminer/HeidiSQL ditempatkan manual; Astra mendeteksi dan menyediakan tombol buka); hook `DatabaseEngine`.

### T-8C — Layanan generik (manifest)

`ServiceManifest` + `GenericService` (exe, args template, port, ready-check, stop). Manifest: Mailpit (SMTP 1025, UI 8025; `SMTP`/`smtp_port` di php.ini saat aktif), Redis (6379, `protected-mode yes`; build tidak resmi), Memcached (11211; build tidak resmi). Nonaktif secara default; semua bind 127.0.0.1.

### T-09 — Quick Create

Blank, Laravel (Composer + `.env` + DB + `key:generate`, docroot `public/`), WordPress (hanya MariaDB; zip WordPress disediakan pengguna atau satu unduhan tunggal dari wordpress.org — putuskan saat dikerjakan, mengikuti aturan jaringan keluar di `SECURITY.md` §5), vhost otomatis (butuh T-07), pilih mesin DB (PostgreSQL butuh T-8B).

### T-10 — Node/Python + terminal

Runtime Node/Python lengkap (pip untuk embeddable via `get-pip.py` yang disediakan pengguna), `TerminalLauncher` (Windows Terminal/PowerShell, PATH versi aktif + `usr/bin`, hormati `.astra.json`), deteksi Git sistem atau MinGit manual, skrip `usr/user.ps1`, Procfile (proses ad-hoc dengan log di UI). Tanpa mengubah PATH sistem.

### T-11 — Menu Tools

Pilihan editor (VS Code/Notepad++/Notepad), buka config (lewat override persisten, bukan berkas hasil generate), buka di editor/terminal/browser per situs, "Edit template" (salin ke `usr/tpl`), penanda `astra-template-version` + peringatan override usang.

### T-12 — SSL, tray, autostart, installer

mkcert untuk `*.test` (vhost HTTPS), tray + autostart opsional, halaman Settings, cadangan database. **Putuskan lebih dulu:** lokasi data pada installer NSIS (uninstall/upgrade bisa menghapus `data/`) atau distribusi zip portabel; catatan: target `portable` memakai `PORTABLE_EXECUTABLE_DIR`, bukan `process.execPath`.

### T-13 — Opsional

Scheduler per situs (setara Cronical, tanpa shell), tunnel (cloudflared tanpa akun/ngrok; tidak pernah otomatis; konfirmasi per sesi), MySQL Community sebagai mesin alternatif (data dir terpisah), Yarn/pnpm, Xdebug per versi PHP, data dir MariaDB per versi mayor.

## 5. Riwayat keputusan

- Struktur folder runtime ala Laragon; ID versi = nama folder.
- Layout `tmp/` flat dengan pembersih berpola ketat (`sess_*`, `php*.tmp`).
- Dokumentasi dikonsolidasi menjadi 8 berkas root; tanpa `.kiro/`, `ARCHITECTURE.md`, `ROADMAP_PROMPTS.md`, `SETUP.md` terpisah.
- Unduhan otomatis runtime dibatalkan; versi dipasang manual, dihapus lewat UI.
