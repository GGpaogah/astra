# ARCHITECTURE.md — Arsitektur & Prinsip Desain Astra

Astra adalah aplikasi desktop lingkungan pengembangan web lokal (Apache, PHP, MariaDB, Nginx, PostgreSQL, Node.js, Python, Composer) untuk Windows, dengan pendekatan arsitektur portabel dan modular mirip Laragon.

---

## 1. Prinsip Desain Utama

1. **Portabel & Terisolasi**:
   - Semua binary runtime diletakkan di dalam folder `bin/`.
   - File konfigurasi yang digunakan runtime di-generate ke dalam `etc/` dari template di `electron/templates/`.
   - Data persisten disimpan di `data/` (misal `data/mysql`).
   - File log disimpan terpusat di `logs/`.
   - Dokumen web user disimpan di `www/`.
   - Pada build produksi, root aplikasi adalah folder di samping `Astra.exe` (bukan di dalam `app.asar`).

2. **Generic Runtime Manager (Struktur Folder ala Laragon)**:
   - Nama folder di dalam `bin/<jenis>/` menggunakan nama asli arsip tanpa diubah (misal `bin/php/php-8.3.16-Win32-vs16-x64/`, `bin/nodejs/node-v20.16.0-win-x64/`).
   - **ID Versi = Nama Folder**, memastikan build berbeda dengan nomor versi yang sama (TS vs NTS, VS16 vs VS17) tidak bentrok.
   - Tetap mendukung kompatibilitas layout flat legacy (`bin/apache/bin/httpd.exe`, `bin/mariadb/bin/mariadbd.exe`, `bin/php/8.3/`).
   - Versi aktif disimpan di `data/astra-settings.json` dan dapat diganti secara dinamis dari UI.
   - Folder internal runtime (`bin`, `conf`, `modules`, `logs`, `share`, `lib`, dan lainnya) tidak dihitung sebagai versi. Folder calon arsip yang kehilangan marker hanya ditampilkan sebagai Invalid bila namanya sesuai pola versi/arsip.
   - Versi diurutkan dengan semver tanpa dependency. ID `default` digunakan untuk runtime flat; folder legacy bernomor seperti `8.3` tetap memakai nama folder sebagai ID.
   - Pengaturan `phpVersion` lama dimigrasikan ke `runtimes.php` saat runtime aktif dibaca. Jika ID tersimpan tidak ada, RuntimeManager memilih versi valid tertinggi dan memberi peringatan.

3. **Komunikasi IPC & Context Isolation**:
   - Proses renderer (React) tidak pernah memanggil API Node.js secara langsung.
   - Semua interaksi backend dilakukan melalui `window.api` yang diekspos secara aman via `contextBridge` di `electron/preload.ts`.
   - Validasi ketat diterapkan pada seluruh handler IPC (validasi URL hanya `localhost`, pencegahan path traversal di luar root/bin).

---

## 2. Struktur Direktori Proyek

```text
astra/
├── bin/                       # Binary runtime portabel (multi-versi)
│   ├── apache/                # Apache HTTP Server (legacy atau subfolder arsip)
│   ├── php/                   # PHP runtimes (Thread Safe & NTS)
│   ├── mariadb/               # MariaDB Server
│   ├── nginx/                 # Nginx Server
│   ├── postgresql/            # PostgreSQL Server
│   ├── nodejs/                # Node.js portable runtimes
│   ├── python/                # Python embeddable runtimes
│   └── composer/              # Composer CLI (composer.phar)
├── data/                      # Data persisten (database, settings lokal)
│   ├── mysql/                 # Datadir MariaDB
│   └── astra-settings.json    # Konfigurasi aplikasi & runtime aktif
├── etc/                       # File konfigurasi yang digenerate otomatis
│   ├── apache/                # httpd.conf & vhosts/
│   ├── php/                   # php.ini
│   └── mariadb/               # my.ini
├── logs/                      # Log file dari service dan runtime
├── www/                       # Root direktori web user & phpMyAdmin
├── electron/
│   ├── core/
│   │   ├── Paths.ts           # Manajemen path terpusat (dev & packaged)
│   │   ├── Settings.ts        # Penyimpanan settings JSON atomik
│   │   ├── PortChecker.ts     # Health-check socket & TCP probing
│   │   ├── ConfigGenerator.ts # Generator konfigurasi dari template
│   │   ├── ServiceManager.ts  # Orkestrasi startAll/stopAll & log batching
│   │   ├── runtimes/
│   │   │   ├── RuntimeDefinition.ts # Marker, regex, CLI fallback, env per jenis
│   │   │   └── RuntimeManager.ts    # Scanning, legacy migration, semver matching
│   │   └── services/
│   │       ├── BaseService.ts       # Abstract service berbasis EventEmitter
│   │       ├── ApacheService.ts     # Manajemen lifecycle Apache
│   │       └── MariaDbService.ts    # Manajemen lifecycle MariaDB
│   ├── ipc/
│   │   ├── services.ipc.ts    # IPC handlers kontrol service & shell
│   │   └── runtimes.ipc.ts    # IPC handlers manajemen multi-versi runtime
│   ├── templates/             # Template konfigurasi (.tpl)
│   ├── main.ts                # Main process entry point
│   └── preload.ts             # Preload bridge
└── src/                       # Frontend React + Tailwind v4
    ├── components/            # ServiceCard, LogViewer
    ├── pages/                 # Dashboard, VersionsPage
    └── lib/                   # IPC wrappers
```

---

## 3. Komponen Runtime & Service

- **BaseService**: Kelas abstrak yang menangani spawn proses, ring-buffer log (1000 baris), pemantauan status exit, dan penghentian proses via `tree-kill`.
- **ApacheService**: Menguji sintaks (`httpd -t`), membaca versi PHP Thread Safe aktif via `RuntimeManager`, dan memuat modul `php8apache2_4.dll`.
- **MariaDbService**: Menjalankan inisialisasi awal database (`mariadb-install-db`), membuat user administratif shutdown `astra_admin` via `--init-file`, dan mengeksekusi graceful stop aman via `mariadb-admin`.
- **RuntimeManager**: Pusat pencarian versi, deteksi marker file, validasi PHP Thread Safe berdasarkan keberadaan `php8apache2_4.dll`/`php7apache2_4.dll`, pencocokan spec semver (`matchVersion`), pembacaan data `.astra.json`, dan migrasi setting otomatis. NTS hanya diberi petunjuk dari nama folder; build tanpa modul Apache tidak bisa dipilih untuk Apache.
