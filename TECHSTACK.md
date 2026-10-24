# TECHSTACK.md — Stack, Arsitektur, Setup, dan Troubleshooting

## 1. Stack
| Lapisan | Pilihan | Versi |
|---|---|---|
| Shell desktop | Electron | ^44 |
| Bahasa | TypeScript (ESM, `strict`) | ~7.0 |
| UI | React + Tailwind CSS | ^19.3 / ^4.3 |
| Build | Vite (+ `vite-plugin-electron/simple`) | ^8.3 |
| Packaging | electron-builder (NSIS; keputusan final di T-12) | ^26.5 |
| Lint | oxlint | ^1.88 |
| Tes | `node --test` (bawaan) | — |
| Proses | `child_process` + `tree-kill`, `get-port` | — |
| Penyimpanan | JSON via `fs` (atomik) | — |
| CI | GitHub Actions `windows-latest` (npm ci, typecheck, lint) | — |
| Runtime dev | Node.js ≥22.12 (diuji 24.x), npm ≥11 | — |

Hasil build: `dist/` (renderer), `dist-electron/main.js`, `dist-electron/preload.mjs` (preload dimuat sebagai `.mjs`), `release/`.

## 2. Arsitektur
- **Main process** (`electron/`): service, runtime manager, generator config, IPC. **Renderer** (`src/`): React; hanya `window.api` dari `preload`.
- **ServiceManager** mengorkestrasi `startAll` (database → pendukung → web) dan `stopAll` (terbalik), serta meneruskan status/log ke renderer (batch ±250 ms).
- **BaseService**: spawn, ring buffer log 1000 baris, status `stopped|starting|running|stopping|error`, stop via `tree-kill`.
  - **ApacheService**: `httpd -t`, memuat `php8apache2_4.dll` dari PHP Thread Safe aktif.
  - **MariaDbService**: init awal (`mariadb-install-db`), `astra_admin` via `--init-file` idempotent tiap start, graceful stop via `mariadb-admin` (kredensial lewat env) + fallback.
- **RuntimeManager**: scan `bin/<jenis>/`, `detect()` per jenis, ID versi = nama folder, semver tanpa dependensi, `matchVersion`, migrasi setting, fallback ke versi tertinggi bila aktif hilang; PHP Thread Safe ditentukan oleh keberadaan DLL modul Apache.
- **TemplateResolver / ConfigGenerator**: `usr/tpl/<nama>` → fallback `electron/templates/<nama>`; placeholder tak dikenal → fallback + peringatan; config selalu di-generate ulang tiap start; path forward slash.
- **TmpCleaner**: hanya `sess_*` dan `php*.tmp` melewati batas umur di `tmp/`; guard realpath.
- **Versi runtime** ditambah manual oleh pengguna (folder arsip di `bin/<jenis>/` + Pindai ulang) dan dihapus lewat UI dengan alur rename-lalu-hapus (lihat `SKILL.md` Playbook 7). Tidak ada unduhan otomatis.
- **Alur IPC:** renderer → `window.api` → handler `electron/ipc/*.ipc.ts` (validasi) → core. Aturan di `SECURITY.md`.

## 3. Struktur folder
```text
astra/
├── CLAUDE.md PRD.md README.md SECURITY.md SKILL.md STYLEGUIDE.md TASK.md TECHSTACK.md   # 8 dokumen
├── .github/workflows/ci.yml
├── bin/        # runtime portabel multi-versi (tidak di Git): apache php mariadb nginx postgresql nodejs python composer
├── data/       # mysql/, astra-settings.json (tidak di Git)
├── etc/        # config hasil generate (tidak di Git)
├── logs/       # log service dan operasi runtime (tidak di Git)
├── tmp/        # sesi/upload PHP, hosts.tmp, php_errors.log, xdebug/ (flat; tidak di Git)
├── usr/        # tpl/ (override template), bin/ (PATH tambahan) — isi tidak di Git
├── www/        # root web + phpmyadmin/ — isi tidak di Git
├── electron/
│   ├── core/   # Paths, Settings, PortChecker, ConfigGenerator, TemplateResolver, TmpCleaner, ServiceManager,
│   │           # runtimes/ (RuntimeDefinition, RuntimeManager), services/ (BaseService, ApacheService, MariaDbService),
│   ├── helpers/  # update-hosts.ps1 (extraResources, bukan di app.asar)
│   ├── ipc/      # services, runtimes, tmp
│   ├── templates/ # *.tpl bawaan (extraResources)
│   ├── main.ts  preload.ts
└── src/        # components, pages (Dashboard, Versions), lib (IPC wrappers), types.d.ts
```
Diagram bisa tertinggal dari kode; kode adalah sumber kebenaran.

### Layout runtime (nama folder = nama asli arsip)
```
bin/php/php-8.3.16-Win32-vs16-x64/php.exe          bin/nodejs/node-v20.16.0-win-x64/node.exe
bin/apache/httpd-2.4.62-win64-VS17/bin/httpd.exe   bin/mariadb/mariadb-12.x-winx64/bin/mariadbd.exe
bin/nginx/nginx-1.26.x/nginx.exe                   bin/python/python-3.12.x-embed-amd64/python.exe
bin/postgresql/postgresql-16.x-windows-x64-binaries/bin/postgres.exe     bin/composer/composer.phar
```
Layout datar lama (`bin/apache/bin/httpd.exe`, `bin/php/8.3/`) tetap terbaca sebagai versi "default"/nama foldernya. Folder internal (`bin conf modules logs share lib`) bukan versi.

## 4. Packaging
- `build.files` hanya `dist/**` dan `dist-electron/**`. Berkas runtime (template, helper) lewat `extraResources`; `Paths` memilih `process.resourcesPath` saat `app.isPackaged`.
- Berkas yang dieksekusi proses lain tidak boleh di dalam `app.asar`.
- Root runtime saat packaged = folder di samping `Astra.exe` (`bin/ data/ etc/ logs/ tmp/ usr/ www/` dibuat oleh `Paths.ensureDirs()`).
- Terbuka (T-12): NSIS memasang ke satu folder dan uninstall/upgrade dapat menghapus `data/`; pilih root data terpisah atau zip portabel.

## 5. Setup
Prasyarat: Windows 10/11, Node ≥22.12, npm ≥11 (`npm i -g npm@latest`), Git.
```powershell
git clone https://github.com/GGpaogah/astra.git ; cd astra ; npm install
```
Letakkan runtime di `bin/` (nama folder arsip, tidak diubah; Astra tidak mengunduhnya), lalu tekan Pindai ulang di tab Versions:
| Komponen | Sumber | Catatan |
|---|---|---|
| Apache Win64 | apachelounge.com | VS16/VS17 cocok dengan PHP; unduh manual dari situs resminya |
| PHP | windows.php.net | Thread Safe untuk `mod_php` Apache; NTS untuk PHP-CGI/Nginx |
| MariaDB (ZIP) | mariadb.org | init data otomatis saat start pertama |
| phpMyAdmin | phpmyadmin.net | ekstrak ke `www/phpmyadmin/` |

Perintah:
```powershell
npm run typecheck ; npm run lint ; npm test      # statis (Windows/Linux)
npm run dev                                       # pengembangan (Windows, dijalankan pemilik)
npm run build                                     # tsc + vite build + electron-builder
```
**Uji build produksi:**
```powershell
npm run build
dir release\win-unpacked\resources\electron\templates
cmd /c mklink /J release\win-unpacked\bin bin
.\release\win-unpacked\Astra.exe
```
Cek folder runtime terbentuk di samping `Astra.exe` dan Start All berjalan. Uji dengan `win-unpacked`, bukan installer.

## 6. Troubleshooting
| Gejala | Penyebab & solusi |
|---|---|
| `Cannot find native binding` (rolldown), `npm error … 'edgesOut'/'matches'` | `node_modules`/lockfile dari OS lain atau sisa pnpm (`node_modules\.pnpm`, `pnpm-workspace.yaml`). `cmd /c "rmdir /s /q node_modules"`, hapus `package-lock.json`, `npm install` di Windows; npm saja |
| `does not provide an export named 'electron'` | `import electron from "vite-plugin-electron/simple"` (tanpa kurung kurawal) |
| `"default" is not exported by src/lib/ipc.ts` | samakan named vs default import/export |
| `Application entry file … main.mjs not found` | `"main"` di package.json harus `dist-electron/main.js` |
| `window.api` undefined | path preload di `main.ts` harus `preload.mjs` |
| `app.asar … being used by another process` | tutup `Astra.exe`, hapus `release/`, kecualikan folder proyek dari Defender |
| `Cannot create symbolic link` (winCodeSign) | aktifkan Developer Mode atau terminal Administrator |
| Port 80 dipakai | IIS/Skype/server lain: ubah port atau hentikan layanan |
| Apache tidak start | `logs/apache/error.log`; `ServerRoot`, DLL PHP, bentrok port; kartu service menampilkan baris error terakhir |
| `/phpmyadmin` 404 | `www/phpmyadmin/index.php` belum ada; ekstrak lalu restart Apache |
| MariaDB: `Missing system table mysql.proxies_priv` | tidak fatal; data dibuat versi lebih lama; `mysql_upgrade` sekali atau abaikan |
| Hapus versi runtime gagal (`EPERM/EBUSY`, proses masih berjalan, antivirus) | lihat `SKILL.md` Playbook 7; tutup Explorer/hentikan proses dari folder itu; kecualikan `bin\` dari Defender; sisa `__del_*` dibersihkan saat startup |
| Versi manual tidak terdeteksi | nama folder harus nama asli arsip dan berisi file penanda; folder pembungkus ganda → angkat isinya satu level; lalu Pindai ulang |
| Template tidak ditemukan di build produksi | `extraResources` kurang; periksa `build` di `package.json` |

## 7. Yang tidak bisa dibuktikan oleh typecheck/lint
Apache/PHP/MariaDB benar-benar start; deteksi port; validitas config hasil generate; build produksi dan `extraResources`; pembersih tmp tidak menyentuh berkas terlindungi; penghapusan versi pada filesystem Windows nyata (proses, antivirus, read-only). Semua ini perlu uji manual di Windows atau tes integrasi di CI Windows.