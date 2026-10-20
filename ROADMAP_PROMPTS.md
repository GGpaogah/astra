# ROADMAP & PROMPT VIBE CODING — Target: Setara Laragon

Kerjakan satu fase per sesi: Hermes membuat rencana → kamu setujui ("lanjut") → kode → `git pull` di Windows → uji → commit.

## Status

- [x] Fase 1 — Kerangka Electron + React
- [x] Fase 2 — Paths, BaseService, ServiceManager
- [x] Fase 3 — MariaDbService
- [x] Fase 4 — Apache + PHP + phpMyAdmin (+ perbaikan root produksi & graceful shutdown)
- [x] Fase 5 — Runtime Manager (versi ganda untuk semua komponen)
  - [x] Fase 5B — Folder tmp/ & usr/ (override template, PATH pengguna)
- [x] Fase 6
  - [x] Fase 6A — Resolver + katalog (logika murni, tanpa UI)
  - [x] Fase 6B — DownloadManager + ekstraksi + UI Install
- [ ] Fase 7 — Virtual Host `.test` + file hosts
- [ ] Fase 8 — Nginx + pemilih web server + PHP-CGI
  - [ ] Fase 8B — PostgreSQL + Database Tools (HeidiSQL, Adminer)
  - [ ] Fase 8C — Service generik (manifest) + Mailpit, Redis, Memcached
- [ ] Fase 9 — Quick Create (Blank, Laravel, WordPress)
- [ ] Fase 10 — Node.js & Python + Terminal
- [ ] Fase 11 — Menu Tools ("Notepad") & editor config
- [ ] Fase 12 — SSL lokal, Tray, Autostart, Polish, Installer
- [ ] Fase 13 — Alat opsional (Scheduler, Tunnel, MySQL, Yarn/pnpm)

## Fitur Target (mengacu pada Laragon)

| Fitur                                 | Cara kita mewujudkannya                             | Fase  |
| ------------------------------------- | --------------------------------------------------- | ----- |
| Apache / Nginx                        | Service + pemilih web server aktif                  | 4, 8  |
| PHP multi-versi                       | Runtime `php`, ganti global; per-proyek via PHP-CGI | 5, 8  |
| MariaDB                               | Sudah ada; multi-versi via Runtime                  | 3, 5  |
| PostgreSQL                            | Runtime + service, data dir per versi mayor         | 8B    |
| Alat database (HeidiSQL, Adminer)     | Tool unduhan + tombol buka                          | 8B    |
| Email lokal (pengganti sendmail)      | Mailpit sebagai service generik                     | 8C    |
| Redis / Memcached                     | Service generik dari manifest (opsional)            | 8C    |
| Scheduler, Tunnel, MySQL, Yarn        | Alat opsional                                       | 13    |
| Node.js / Python multi-versi          | Runtime + terminal ber-PATH                         | 5, 10 |
| Quick create: Blank/Laravel/WordPress | Template proyek + Composer + DB otomatis            | 9     |
| Auto virtual host `nama.test`         | Scan `www/`, vhost, file hosts                      | 7     |
| "Notepad" (edit config & proyek)      | Peluncur editor + pintasan file config              | 11    |
| Unduh versi baru                      | Katalog + Download Manager                          | 6     |
| SSL, tray, autostart                  | mkcert, Tray, login item                            | 12    |

## Keputusan Cakupan vs Laragon

Laragon membundel banyak alat. Kita tidak meniru semuanya; kita tiru yang bernilai tinggi dan murah lewat desain generik.

| Komponen Laragon                                            | Keputusan                           | Cara / alasan                                                                     | Fase |
| ----------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- | ---- |
| apache, nginx, php, mysql/mariadb, nodejs, python, composer | Wajib                               | Inti produk                                                                       | 4-10 |
| heidisql                                                    | Ya                                  | Tool unduhan + tombol buka                                                        | 8B   |
| notepad++                                                   | Peluncur saja                       | Deteksi & buka; tidak dibundel                                                    | 11   |
| cmder                                                       | Tidak dibundel                      | Pakai Windows Terminal/PowerShell dengan PATH Astra                               | 10   |
| redis, memcached                                            | Ya (opsional)                       | Service generik dari manifest; port Windows tidak resmi                           | 8C   |
| sendmail                                                    | Diganti Mailpit                     | Penangkap email lokal modern + UI web                                             | 8C   |
| ngrok                                                       | Opsional, belakangan                | Mengekspos situs ke internet; alternatif cloudflared                              | 13   |
| cronical                                                    | Opsional, belakangan                | Scheduler sederhana per situs                                                     | 13   |
| yarn                                                        | Opsional, prioritas rendah          | npm sudah cukup                                                                   | 13   |
| mysql (selain MariaDB)                                      | Opsional, belakangan                | Generalisasi service DB                                                           | 13   |
| git                                                         | Deteksi Git sistem; opsional MinGit | Composer butuh Git untuk paket dari source (sebelumnya salah kutip sebagai "qit") | 10   |
| telnet                                                      | Tidak                               | Fitur opsional Windows                                                            | -    |
| postgresql                                                  | Ya (tambahan kita)                  | Tidak ada di Laragon bawaan                                                       | 8B   |

Prinsip: satu fitur baru harus cukup dengan satu manifest + entri katalog bila memungkinkan, bukan satu kelas baru.

## Desain Inti Baru (dipakai Fase 5 dan seterusnya)

- **Runtime**: jenis komponen (`php`, `apache`, `nginx`, `mariadb`, `postgresql`, `node`, `python`, `composer`) plus tool (`heidisql`, `adminer`).
- Lokasi ala Laragon: `bin/<folder-jenis>/<nama-asli-arsip>/`, mis. `bin/php/php-8.3.16-Win32-vs16-x64/`, `bin/nodejs/node-v20.16.0-win-x64/`. ID versi = nama folder; versi aktif tersimpan di `data/astra-settings.json`.
- **Resolver + katalog**: resolver per komponen mencari versi terbaru yang aman (LTS/stable) saat instalasi; `catalog/catalog.json` jadi cadangan offline. Versi nyata dikunci di settings, tidak pernah diganti otomatis.
- **Per-proyek**: file `.astra.json` di folder proyek (opsional): `{ "php": "8.2", "node": "20" }` (dicocokkan ke folder terbaik lewat `matchVersion`)`.
- Satu web server aktif sekaligus di port 80 (Apache atau Nginx).
- `PhpManager` dari Fase 4 dilebur menjadi `RuntimeManager` di Fase 5.

## Aturan Umum Semua Prompt

- Baca CLAUDE.md dan ARCHITECTURE.md dulu; periksa kode yang ada; beri rencana maksimal 12 poin; tunggu "lanjut".
- Hermes berjalan di VM Linux: validasi hanya `npm run typecheck` dan lint; jangan jalankan Electron/binary Windows.
- Tanpa dependency baru kecuali disebut di fase tersebut. Hanya npm. Jangan commit `package-lock.json`, `bin/`, `data/`, `logs/`, `etc/`.
- Validasi input IPC (URL via `new URL()`, path di dalam root) dan jangan taruh password di argumen proses.
- Laporan akhir: pohon file berubah, ringkasan modul, kondisi error yang ditangani, langkah uji di Windows.
- Perubahan pada ARCHITECTURE.md/CLAUDE.md hanya jika prompt fase itu secara eksplisit mengizinkan.

---

## Fase 4 — Apache + PHP + phpMyAdmin (SELESAI)

Gunakan prompt Fase 4 yang sudah diberikan beserta 5 koreksi (astra_admin idempotent tiap start,
password bukan lewat `-p`, validasi URL/path ketat, stopAll berurutan terbalik, Settings atomik).

## Fase 5 — Runtime Manager (struktur folder ala Laragon) (SELESAI)

> Lanjut ke Fase 5. Fase 4 sudah kuuji di Windows dan stabil. Tujuan: konsep Runtime generik agar semua komponen bisa multi-versi, dengan struktur folder seperti Laragon.
>
> **Struktur folder (nama folder = nama asli arsip, tanpa diganti):**
>
> ```
> bin/php/php-8.3.16-Win32-vs16-x64/php.exe
> bin/nodejs/node-v20.16.0-win-x64/node.exe
> bin/python/python-3.12.x-embed-amd64/python.exe
> bin/apache/httpd-2.4.62-win64-VS17/bin/httpd.exe
> bin/nginx/nginx-1.26.x/nginx.exe
> bin/mariadb/mariadb-12.x-winx64/bin/mariadbd.exe
> bin/composer/composer.phar
> ```
>
> Jenis (id internal) -> nama folder induk: php->php, apache->apache, nginx->nginx, mariadb->mariadb, postgresql->postgresql (diimplementasi di Fase 8B; definisinya boleh disiapkan sekarang), node->nodejs, python->python, composer->composer.
>
> 1. Buat `electron/core/runtimes/RuntimeManager.ts` dan `RuntimeDefinition.ts`. Per jenis definisikan: folder induk, `detect(dir)` (file penanda: php.exe; node.exe; python.exe; bin/httpd.exe; nginx.exe; bin/mariadbd.exe; composer.phar), regex versi dari nama folder (mis. `php-(\d+\.\d+\.\d+)`, `node-v(\d+\.\d+\.\d+)`, `httpd-(\d+\.\d+\.\d+)`, `nginx-(\d+\.\d+\.\d+)`, `mariadb-(\d+\.\d+\.\d+)`, `python-(\d+\.\d+\.\d+)`), fallback membaca `--version` bila regex gagal, dan env/PATH yang perlu ditambahkan (untuk Terminal di Fase 10).
> 2. **ID versi = nama folder** (bukan nomor versi), sehingga dua build berbeda dengan nomor sama (mis. TS vs NTS, VS16 vs VS17) tidak bentrok. Tampilkan nomor versi + sufiks sebagai label. Urutkan dengan perbandingan semver buatan sendiri (tanpa dependency).
> 3. API: `listTypes()`, `listVersions(type)` (hanya folder yang lolos `detect`), `getActive(type)`, `setActive(type, folderId)`, `getPath(type)`, dan `matchVersion(type, spec)` yang menerjemahkan "8.3", "20", atau folder id lengkap menjadi folder terbaik (patch tertinggi). `matchVersion` dipakai `.astra.json` nanti.
> 4. **Kompatibilitas struktur lama**: layout datar yang sekarang (mis. `bin/apache/bin/httpd.exe`, `bin/mariadb/bin/mariadbd.exe`, `bin/php/8.3/`) harus tetap terbaca (tampil sebagai versi "default" atau sesuai nama foldernya). Jangan memindahkan atau menghapus file milik user. Jika versi aktif di settings hilang, fallback ke versi tertinggi dan tampilkan pesan, jangan crash.
> 5. **PHP**: dari nama folder tandai `nts` bila ada kata "nts". `mod_php` Apache hanya valid untuk build Thread Safe (ada `php8apache2_4.dll`); build NTS ditandai "untuk PHP-CGI (Nginx)" dan tidak boleh dipilih untuk Apache. UI menjelaskan alasannya.
> 6. Lebur `PhpManager` ke RuntimeManager. `ApacheService`, `MariaDbService`, `ConfigGenerator`, dan semua pemanggil path binary membaca lewat `getPath()`/`getActive()`. Settings menyimpan folder id aktif per jenis (migrasi otomatis dari setting versi PHP lama).
> 7. Ganti versi saat service terkait berjalan -> tawarkan restart otomatis; buat opsi di Settings (default: tanya).
> 8. IPC: `runtimes:list`, `runtimes:set-active`, `runtimes:refresh` (scan ulang). UI: halaman "Versions" dengan kartu per jenis, dropdown versi, badge aktif/NTS/legacy, dan tombol "Buka folder". Belum ada unduhan (Fase 6).
> 9. Membaca `.astra.json` per situs hanya sebagai pembacaan data (belum dipakai).
>    Izin khusus: boleh memperbarui ARCHITECTURE.md bagian Runtime dan struktur `bin/`.
>
> BATASAN: tanpa dependency baru; ikuti CLAUDE.md; validasi nama folder (tolak `..` dan path absolut); Hermes tidak bisa menjalankan binary Windows, validasi hanya typecheck dan lint. Commit: "feat: phase 5 runtime manager".
> LAPORAN AKHIR: pohon file berubah, daftar regex versi per jenis, cara layout lama ditangani, langkah uji di Windows.

## Fase 5B — Folder `tmp/` & `usr/` (pelajaran dari struktur Laragon)

> Kecil dan murah; kerjakan sebelum Fase 7. Tujuan: folder pendukung ala Laragon agar template bisa dioverride pengguna dan sampah PHP tidak berserakan.
>
> Lanjut ke Fase 5B. Baca hanya: CLAUDE.md, Paths.ts, ConfigGenerator.ts, php.ini.tpl, Settings.ts, dan pola IPC/UI yang ada.
>
> 1. **Paths.ts**: tambah `tmp`, `tmpSessions`, `tmpUploads`, `usr`, `usrTpl`, `usrBin`; `ensureDirs()` membuatnya (produksi: di samping Astra.exe).
> 2. **TemplateResolver**: `resolveTemplate(name)` memeriksa `usr/tpl/<name>` lebih dulu, fallback ke `electron/templates/<name>`. Validasi nama (tanpa `..`, tanpa separator). `ConfigGenerator` memakainya untuk semua template. Jika template pengguna gagal dirender (placeholder tidak dikenal/error), fallback ke template bawaan dan tampilkan peringatan di log/UI; jangan crash. Sediakan aksi "Salin template bawaan ke usr/tpl" (tidak menimpa file yang sudah ada).
> 3. **php.ini.tpl**: set `session.save_path`, `upload_tmp_dir`, dan `sys_temp_dir` ke folder di `tmp/` (forward slash).
> 4. **Pembersihan tmp**: saat aplikasi start dan lewat tombol "Bersihkan tmp", hapus `sess_*` yang lebih tua dari `tmpSessionMaxAgeDays` (Settings, default 7) dan file upload sementara >1 hari. Hanya di dalam `tmp/` (cek real path), jangan menyentuh subfolder lain (mis. `tmp/xdebug`). Laporkan jumlah file dan ukuran yang dibebaskan.
> 5. **usr/bin**: hanya siapkan folder dan fungsi `getExtraPathDirs()` yang mengembalikan `[usr/bin]` (dipakai Terminal di Fase 10). Belum ada terminal.
> 6. **UI minimal**: tombol "Bersihkan tmp" dengan info ukuran saat ini dan hasil pembersihan.
> 7. **ARCHITECTURE.md** (izin khusus): perbarui bagian struktur folder (`tmp/`, `usr/`, urutan resolusi template).
>
> BATASAN: tanpa dependency baru; ikuti CLAUDE.md; jangan menghapus apa pun di luar `tmp/`. Commit: "feat: phase 5b tmp and usr folders". Laporan maks. 30 baris.

## Catatan Pembagian Fase 6 (hemat limit AI)

Fase 6 sangat besar. Jika kuota AI terbatas, kerjakan sebagai tiga sesi terpisah, masing-masing satu commit:

- **6A** Resolver + katalog (logika murni, tanpa UI): poin 1, 2, 3, 11.
- **6B** DownloadManager + ekstraksi + UI Install di halaman Versions: poin 4, 5, 8, 9, 10.
- **6C** Wizard pertama kali jalan + notifikasi update: poin 6, 7.
  Prioritas bernilai-tinggi/biaya-rendah: Fase 7 (vhost) boleh dikerjakan SEBELUM Fase 6 karena unduhan manual sudah cukup untuk pemakaian harian.

## Fase 6 — Download Manager + Resolver "Latest" + Wizard Awal

> Lanjut ke Fase 6. Tujuan: unduh komponen dari UI, default ke versi terbaru yang aman, dan versi dikunci saat instalasi.
>
> **Aturan inti:** "latest" diselesaikan HANYA saat user menginstal, lalu versi nyata (mis. 8.3.14) disimpan di settings. Jangan pernah mengganti versi aktif secara otomatis. Update tersedia hanya ditampilkan sebagai notifikasi.
>
> 1. **Resolver per komponen** (`electron/core/download/resolvers/<jenis>.ts`) dengan antarmuka `resolveLatest(channel): { version, url, sha256?, archiveRoot }`. Kanal default: PHP = rilis stabil cabang yang masih didukung (bukan pra-rilis/EOL); Node = LTS; MariaDB = LTS; Nginx = stable; Python = 3.x stabil (embeddable); Composer = latest-stable; WordPress = latest.
> 2. Sumber yang diperkirakan (VERIFIKASI: kamu tidak punya internet, tandai TODO jika ragu, jangan mengarang URL atau hash): PHP `windows.php.net/downloads/releases/releases.json`; Node `nodejs.org/dist/index.json` + `SHASUMS256.txt`; MariaDB REST API di `downloads.mariadb.org`; Composer `getcomposer.org` (latest-stable + checksum); WordPress `wordpress.org`; phpMyAdmin `phpmyadmin.net`; mkcert via GitHub Releases API; PostgreSQL binaries zip dari EnterpriseDB; Adminer dari rilis resminya; HeidiSQL portable dari situs resminya (semua perlu verifikasi manual, tandai TODO jika ragu). Apache: Apache Lounge memblokir unduhan otomatis (hotlink protection); buat resolver dengan opsi URL kustom di settings dan beri pesan jelas, jangan mencoba menembus proteksi.
> 3. **Katalog fallback** `catalog/catalog.json` (skema: type, version, url, sha256, archiveRoot, platform) dipakai bila resolver gagal atau saat offline; versi dari katalog tidak otomatis dianggap "latest".
> 4. **DownloadManager.ts**: `fetch` bawaan Node, progres ke renderer, simpan ke `data/downloads/`, verifikasi SHA256 bila tersedia (bila tidak ada: peringatan di UI, hitung dan simpan hash untuk perbandingan pemasangan berikutnya), pembatalan, hapus unduhan parsial saat gagal. Ekstrak dengan `tar -xf` bawaan Windows atau fallback PowerShell `Expand-Archive`, tolak path traversal. **Aturan penamaan ala Laragon:** folder tujuan = nama file arsip tanpa ekstensi (mis. `php-8.3.16-Win32-vs16-x64`) di bawah `bin/<folder-jenis>/`; jika arsip punya satu folder pembungkus di level atas (mis. `node-v20.16.0-win-x64/` atau `Apache24/`), isinya diangkat satu level agar `detect()` Fase 5 langsung menemukan file penanda. Jangan eksekusi apa pun sebelum ekstrak dan verifikasi selesai.
> 5. **Keamanan:** hanya HTTPS dan hanya domain di allowlist yang didefinisikan di satu tempat; user tidak bisa memasukkan URL bebas (kecuali URL kustom Apache di settings yang divalidasi `new URL()` + allowlist atau konfirmasi eksplisit).
> 6. **Wizard pertama kali jalan** (jika `bin/` kosong atau belum ada versi): pilih komponen dengan preset _Minimal_ (Apache, PHP, MariaDB), _Web dev_ (+ Composer, Node), _Lengkap_; tampilkan estimasi ukuran sebelum mulai; user bisa melewati. Tidak mengunduh apa pun tanpa persetujuan.
> 7. **Notifikasi update:** pengecekan manual lewat tombol dan opsional berkala (default mati). Tampilkan "versi baru tersedia" tanpa memasang otomatis. Simpan versi hasil resolusi di settings sehingga proyek lama tetap stabil.
> 8. UI halaman Versions: tombol Install per versi, progres bar, Hapus versi (tidak boleh menghapus versi aktif atau yang dipakai service berjalan), badge "terbaru" dan "LTS".
> 9. Python embeddable: jelaskan keterbatasannya di laporan (pip memerlukan `get-pip.py`, diselesaikan di Fase 10).
> 10. Mode offline: jika jaringan gagal, tampilkan pesan jelas dan pakai cache `data/downloads/` bila ada.
> 11. Jaga batas rate GitHub API (tanpa token): cache hasil resolver beberapa jam di `data/`.

## Fase 7 — Virtual Host `.test`

> Lanjut ke Fase 7. Tujuan: `nama-folder.test` otomatis.
>
> 1. `VHostManager.ts`: scan `www/` (1 folder = 1 situs; deteksi `public/` untuk Laravel), generate `etc/apache/vhosts/<nama>.conf` dari template, hapus vhost yatim.
> 2. `HostsFile.ts`: tambah/hapus baris `127.0.0.1 nama.test` di `C:\\Windows\\System32\\drivers\\etc\\hosts` dengan penanda blok `# BEGIN ASTRA`/`# END ASTRA`. Butuh Administrator: bila gagal karena izin, tampilkan pesan jelas dan sediakan tombol "Jalankan helper dengan UAC" (script PowerShell `Start-Process -Verb RunAs` yang hanya menulis blok Astra). Jangan crash tanpa admin.
> 3. Cadangkan file hosts sekali sebelum perubahan pertama. Jangan menyentuh baris di luar blok Astra.
> 4. Validasi nama situs (huruf, angka, tanda minus), tolak nama berbahaya.
> 5. UI halaman "Sites": daftar situs, URL, tombol buka, buka folder, hapus vhost. Auto-refresh saat folder `www/` berubah (fs.watch dengan debounce) dan reload Apache bila berjalan.
> 6. Opsional tahap ini: domain suffix bisa diganti di settings (default `.test`).

> Catatan (dari Laragon `tmp/hosts.tmp`): setelah Fase 5B, berkas sementara untuk helper UAC hosts memakai `tmp/hosts.tmp`, bukan `data/hosts-pending.txt`.

## Fase 8 — Nginx + Pemilih Web Server + PHP-CGI

> Lanjut ke Fase 8. Tujuan: Nginx, dan PHP per-proyek.
>
> 1. `NginxService` (extends BaseService): template `nginx.conf.tpl`, vhost per situs, `nginx.exe -t` sebelum start, stop graceful (`-s quit`) dengan fallback tree-kill.
> 2. `PhpCgiService`: jalankan `php-cgi.exe -b 127.0.0.1:<port>` per versi PHP yang dipakai situs (port dinamis dari get-port), dikelola ServiceManager.
> 3. Pemilih web server aktif (Apache | Nginx): hanya satu yang boleh running di port web; saat berganti, hentikan yang lama lebih dulu. Simpan di settings.
> 4. Nginx memakai PHP-CGI untuk semua situs. Apache tetap `mod_php` (global); tambahkan opsi eksperimen FastCGI untuk Apache hanya jika sederhana, kalau tidak catat sebagai batasan di laporan.
> 5. Dukungan `.astra.json` `{ "php": "8.2" }` per situs: berlaku penuh pada Nginx; pada Apache tampilkan peringatan bahwa versi per-situs butuh Nginx.
> 6. UI: pilih web server, dan di tabel Sites tampilkan versi PHP efektif per situs.

> 7. **php.ini per versi**: bila beberapa PHP-CGI berjalan bersamaan, `php.ini` harus per runtime di `etc/php/<folderId>/php.ini` (extension_dir berbeda per versi); jangan berbagi satu file.

## Fase 8B — PostgreSQL + Database Tools (HeidiSQL & Adminer)

> Bergantung pada Fase 5 (Runtime Manager); bisa dikerjakan kapan saja setelah Fase 6, tidak bergantung pada vhost/Nginx.
>
> Lanjut ke Fase 8B. Tujuan: PostgreSQL sebagai service multi-versi, plus alat admin database.
>
> 1. **Runtime `postgresql`**: folder induk `bin/postgresql/`, mis. `bin/postgresql/postgresql-16.x-windows-x64-binaries/` (folder pembungkus `pgsql/` dari arsip EDB diangkat satu level). `detect()` = `bin/postgres.exe` + `bin/initdb.exe` + `bin/pg_ctl.exe`. Versi dari nama folder; versi mayor dipakai untuk data dir.
> 2. **Data dir per versi mayor**: `data/postgresql/<mayor>/` (mis. `16`). Jangan pernah menghapus atau inisialisasi ulang data yang sudah ada. Saat user mengganti ke mayor lain, tampilkan peringatan jelas bahwa data tidak ikut dimigrasi (jelaskan dump/restore atau `pg_upgrade` secara singkat di UI), dan inisialisasi data dir baru hanya setelah user setuju.
> 3. **PostgresService** (extends BaseService): name "postgresql", port default 5432 (settings). Pre-check berpesan jelas: binary ada, port bebas (PortChecker), dan **Astra tidak berjalan sebagai Administrator** (`postgres.exe` menolak hak admin; deteksi lewat cek elevasi di main process dan tampilkan petunjuk menjalankan Astra tanpa admin). Aplikasi utama tidak boleh dijalankan elevated; hak admin hanya untuk helper kecil di Fase 7.
> 4. **Inisialisasi pertama** jika data dir belum ada: `initdb.exe -D <datadir> -U postgres -E UTF8 --locale=C --auth=trust`, output ke log; jika gagal, bersihkan data dir setengah jadi. Catat di laporan alasan memilih `--locale=C` dan konsekuensinya pada pengurutan teks.
> 5. **Konfigurasi di-generate** (bukan diedit manual) ke `etc/postgresql/<mayor>/postgresql.conf` dan `pg_hba.conf` dari template: `listen_addresses='127.0.0.1'`, port, `max_connections=50`, `shared_buffers=128MB`, `log_destination='stderr'`, `logging_collector=off` (log ke console agar tampil di UI), `timezone='Asia/Jakarta'`. `pg_hba.conf`: `trust` hanya untuk `127.0.0.1/32` dan `::1/128`. Jalankan dengan `-c config_file=... -c hba_file=...`. Semua path forward slash.
> 6. **Start** di foreground lewat `spawnProcess`: `postgres.exe -D <datadir> -c config_file=<conf> -c hba_file=<hba>` (windowsHide: true). Siap bila `pg_isready.exe -h 127.0.0.1 -p <port>` sukses atau port merespons (timeout 30 detik). Jika proses exit sebelum siap: status error dengan 20 baris log terakhir.
> 7. **Stop graceful**: `pg_ctl.exe stop -D <datadir> -m fast -w` (timeout 15 detik), fallback tree-kill; log yang membedakan "graceful OK" vs "forced kill". Setelah forced kill, jelaskan di log bahwa PostgreSQL akan melakukan recovery saat start berikutnya.
> 8. **Integrasi**: daftarkan di ServiceManager; urutan `startAll`: mariadb, postgresql, lalu web server; `stopAll` terbalik. Service ini opsional (hanya start jika ada runtime dan user mengaktifkannya; tombol Start All melewatinya bila tidak ada).
> 9. **PHP**: tambahkan `pgsql` dan `pdo_pgsql` ke daftar ekstensi di `php.ini.tpl`, aktif hanya jika DLL ada di `ext/`; periksa bahwa `libpq.dll` tersedia dari folder PHP.
> 10. **Adminer**: unduh satu file Adminer resmi (sumber diverifikasi manual; tandai TODO jika ragu) ke `www/adminer/index.php` bila belum ada; tombol "Buka Adminer". Mendukung MariaDB dan PostgreSQL.
> 11. **HeidiSQL (portable)** sebagai "tool" yang bisa diunduh (Fase 6) ke `bin/tools/heidisql/`: tombol "Buka HeidiSQL" di dasbor. Peluncuran dengan argumen koneksi hanya jika opsi command line HeidiSQL terverifikasi; jika tidak yakin, cukup buka aplikasinya dan tampilkan panel info koneksi (host 127.0.0.1, port, user `root`/`postgres`, tanpa password). Jangan membuat/menulis file sesi HeidiSQL dulu.
> 12. **UI**: kartu PostgreSQL di dasbor (status, port, versi mayor aktif, dropdown versi), panel "Info koneksi" dengan tombol salin, dan peringatan data dir per mayor.
> 13. Siapkan hook `DatabaseEngine` ('mariadb' | 'postgresql') agar Quick Create (Fase 9) bisa membuat database dan mengisi `.env` sesuai pilihan (Laravel: `DB_CONNECTION=pgsql`, port, user postgres). WordPress tetap hanya MariaDB.
>
> BATASAN: tanpa dependency baru; ikuti CLAUDE.md; validasi nama database (huruf, angka, underscore); jangan menaruh password di argumen proses; tidak ada koneksi dari luar localhost. Hermes tidak bisa menjalankan binary Windows, validasi hanya typecheck dan lint. Commit: "feat: phase 8b postgresql and db tools".
> LAPORAN AKHIR: pohon file berubah, isi template `postgresql.conf` dan `pg_hba.conf`, keputusan inisialisasi dan locale, kondisi error yang ditangani, langkah uji di Windows.

## Fase 8C — Service Generik (Manifest) + Mailpit, Redis, Memcached

> Bergantung pada Fase 5. Tujuan: menambah layanan pendukung murah lewat manifest, bukan kelas baru per layanan.
>
> Lanjut ke Fase 8C. Baca hanya: CLAUDE.md, BaseService.ts, ApacheService.ts (sebagai contoh), RuntimeDefinition.ts, ServiceManager.ts, ConfigGenerator.ts, Settings.ts, dan pola IPC/UI yang ada.
>
> 1. **ServiceManifest** (`electron/core/services/manifests/*.ts`, tipe di `ServiceManifest.ts`): `id`, `name`, `runtimeType`, `exe` (relatif ke folder runtime), `args` (template dengan `{{port}}`, `{{dataDir}}`, `{{configFile}}`, `{{runtimeDir}}`), `defaultPort`, `bindHost` (selalu 127.0.0.1), `ready` (`tcp` | `http` + path | `none`, timeout), `stop` (`kill` | `command` dengan argumen), `configTemplate?`, `env?`, `urls?` (mis. UI web).
> 2. **GenericService extends BaseService** dibangun dari manifest: pre-check (binary ada, port bebas via PortChecker), generate config bila ada template, spawn via `spawnProcess` (windowsHide: true), deteksi siap, stop sesuai manifest dengan fallback tree-kill, log graceful vs forced. Jangan menyalin logika dari ApacheService; gunakan helper bersama.
> 3. **Registrasi otomatis**: layanan muncul hanya jika runtime-nya terdeteksi; aktif/nonaktif per layanan di Settings (default nonaktif); Start All hanya menjalankan yang aktif. Urutan start: database, layanan pendukung, web server; stop terbalik.
> 4. **Runtime baru** di RuntimeDefinition: `mailpit` (folder `mailpit`, marker `mailpit.exe`), `redis` (marker `redis-server.exe`), `memcached` (marker `memcached.exe`); regex versi dari nama folder, fallback `--version`.
> 5. **Mailpit**: SMTP 127.0.0.1:1025, UI web 127.0.0.1:8025; tombol "Buka Mailpit" (validasi URL localhost). Saat Mailpit aktif, `ConfigGenerator` menambahkan ke php.ini: `SMTP=127.0.0.1`, `smtp_port=1025`, `sendmail_from=dev@localhost` (PHP Windows memakai pengaturan SMTP, tidak butuh sendmail.exe). Saat nonaktif, nilai itu dihapus.
> 6. **Redis**: port 6379, `bind 127.0.0.1`, `protected-mode yes`, config di-generate ke `etc/redis/redis.conf`, data di `data/redis/`; stop lewat `redis-cli shutdown` (timeout 5 detik) dengan fallback kill. Tandai di UI sebagai "build komunitas (tidak resmi)" dan catat di laporan konsekuensinya.
> 7. **Memcached**: port 11211, `-l 127.0.0.1 -m 64`; stop dengan kill (tidak ada shutdown graceful). Tandai "build komunitas (tidak resmi)".
> 8. Tidak ada pengelolaan ekstensi PHP `redis`/`memcached` (butuh DLL yang cocok dengan versi PHP); tampilkan catatan di panel info bahwa Laravel dapat memakai `predis` (pure PHP) tanpa ekstensi.
> 9. **UI**: bagian "Layanan Tambahan" di Dashboard (kartu per layanan: status, port, toggle aktif, panel info koneksi dengan tombol salin, tombol buka UI bila ada). Validasi port yang diubah user (1024-65535, bukan port yang dipakai service Astra lain).
>
> BATASAN: tanpa dependency baru; ikuti CLAUDE.md; semua layanan hanya bind ke 127.0.0.1; password/token tidak lewat argumen proses; Hermes tidak bisa menjalankan binary Windows, validasi hanya typecheck dan lint. Letakkan binary manual: `bin/mailpit/<arsip>/`, `bin/redis/<arsip>/`, `bin/memcached/<arsip>/`. Commit: "feat: phase 8c generic services mailpit redis memcached".
> LAPORAN AKHIR (maks. 30 baris): file berubah, skema manifest, keputusan penting, edge case, langkah uji di Windows.

## Fase 9 — Quick Create (Blank, Laravel, WordPress)

> Lanjut ke Fase 9. Tujuan: membuat proyek baru dengan satu klik.
>
> 1. `ProjectTemplates/` dengan antarmuka `ProjectTemplate { id, name, create(opts) }`.
> 2. **Blank**: folder + `index.php` sederhana.
> 3. **Laravel**: jalankan `php composer.phar create-project laravel/laravel <nama>` memakai PHP & Composer aktif, streaming log ke UI, buat DB `<nama>` dan isi `.env` (DB_HOST 127.0.0.1, user root tanpa password sesuai setup lokal), `php artisan key:generate`. Vhost menunjuk ke `public/`.
> 4. **WordPress**: unduh zip WordPress terbaru dari sumber resmi (URL di katalog), ekstrak ke `www/<nama>`, buat DB, tulis `wp-config.php` dengan salt acak dibuat lokal (bukan memanggil API eksternal), nonaktifkan instal otomatis plugin.
> 5. Semua template: validasi nama, tolak jika folder sudah ada, buat database lewat koneksi `astra_admin`/helper (hak CREATE hanya untuk operasi ini; jelaskan pendekatannya), lalu daftarkan vhost (Fase 7).
> 6. UI: tombol "Quick create" dengan dialog (template, nama, versi PHP). Tampilkan log pembuatan dan tombol "Buka situs".
> 7. Composer sebagai Runtime terpisah (dari katalog) dan butuh PHP aktif; beri pesan jelas jika belum ada.

## Fase 10 — Node.js & Python + Terminal

> Lanjut ke Fase 10. Tujuan: runtime Node/Python dan terminal ber-PATH.
>
> 1. Pastikan Runtime node & python (Fase 5/6) lengkap: baca versi, ganti aktif. Untuk Python embeddable, sediakan aksi "Install pip" (unduh `get-pip.py` dari katalog dan jalankan), dan perbaiki file `._pth` bila perlu.
> 2. `TerminalLauncher.ts`: buka Windows Terminal (jika ada) atau PowerShell dengan `cwd` = `www/<situs>` atau root, dengan PATH diawali versi aktif php, node, python, composer, mariadb client. Hormati `.astra.json` situs bila ada.
> 3. UI: tombol "Terminal" global dan per situs. Tampilkan ringkasan versi yang dipakai.
> 4. Opsional tahap ini: jalankan perintah proyek (mis. `npm run dev`) sebagai "service ad-hoc" di ServiceManager dengan log di UI. Kerjakan hanya jika kecil; jika besar, catat sebagai usulan.
> 5. Jangan menulis ke PATH sistem Windows secara permanen.

> 6. **Git**: deteksi Git sistem dulu; jika tidak ada, runtime `git` opsional dari MinGit (zip, bukan installer) dan tambahkan ke PATH terminal/Composer. Sertakan `usr/bin` (dari Fase 5B) di PATH terminal dan dukung skrip init pengguna `usr/user.ps1` (opsional) yang dijalankan saat terminal dibuka.
> 7. **Procfile** (setara `usr/Procfile` Laragon): file opsional berisi proses ad-hoc `nama: perintah` yang bisa dijalankan dari UI sebagai layanan sementara (log di UI, stop dengan tree-kill, tanpa shell untuk argumen).

## Fase 11 — Menu Tools ("Notepad")

> Lanjut ke Fase 11. Tujuan: pintasan edit file seperti menu Laragon.
>
> 1. Setting "Editor": VS Code (`code`), Notepad++, atau Notepad; deteksi otomatis lokasi umum, fallback `notepad.exe`.
> 2. Menu Tools: buka `httpd.conf`, `php.ini`, `my.ini`, `nginx.conf`, file hosts (edit hosts memakai UAC helper), buka `www/`, buka folder `logs/`.
> 3. Peringatan: config di `etc/` di-generate ulang tiap start. Tambahkan mekanisme **override persisten**: file `etc/<komponen>/user-overrides.conf` (atau `.ini`) yang di-include generator dan tidak pernah ditimpa. Menu "Edit" membuka file override itu, bukan file hasil generate.
> 4. Per situs: "Buka di editor", "Buka di Terminal", "Buka di browser".
> 5. Validasi: hanya buka file dalam root atau file hosts yang ada di daftar putih.

> 6. Override template memakai mekanisme `usr/tpl` dari Fase 5B (menu "Edit template" menyalin template bawaan ke `usr/tpl` lalu membukanya di editor); jangan membuat mekanisme override kedua.

## Fase 12 — SSL, Tray, Autostart, Polish

> Lanjut ke Fase 12. Tujuan: kualitas harian dan distribusi.
>
> 1. SSL lokal: mkcert (Runtime/katalog) untuk membuat CA lokal dan sertifikat `*.test`; vhost HTTPS di Apache dan Nginx; tombol "Install CA" dengan penjelasan jelas dan persetujuan user.
> 2. Tray icon, minimize ke tray, autostart Windows (opsional) dan "auto-start services".
> 3. Halaman Settings: port web/DB, suffix domain, editor, path berbagi, bahasa UI.
> 4. Backup & ekspor: cadangan database (mariadb-dump) per DB lewat UI.
> 5. Packaging: `electron-builder` memastikan folder `bin/`, `data/`, `www/` tidak masuk installer dan dibuat di samping `Astra.exe`. Uji aplikasi hasil build.
> 6. Pembaruan katalog dari file JSON lokal/URL yang kuatur sendiri (tanpa auto-update aplikasi dulu).

## Fase 13 — Alat Opsional (kerjakan hanya jika dibutuhkan)

> Masing-masing bagian berdiri sendiri dan boleh dikerjakan terpisah (13A-13D). Semua nonaktif secara default.
>
> **13A Scheduler (setara Cronical):** penjadwal sederhana per situs: daftar tugas (nama, interval menit, perintah dari templat tetap seperti `php artisan schedule:run` atau perintah kustom), dijalankan memakai runtime aktif/`.astra.json` situs, tanpa shell (argumen terpisah), dengan log per tugas (ring buffer) dan batas waktu eksekusi. Tidak berjalan jika Astra tertutup (jelaskan di UI).
>
> **13B Tunnel (setara ngrok):** peluncur tunnel untuk situs (alternatif: cloudflared quick tunnel yang tidak butuh akun; ngrok memerlukan akun dan token milik user). Aturan keamanan: JANGAN pernah start otomatis; konfirmasi eksplisit per sesi dengan peringatan bahwa situs akan terbuka ke internet; tampilkan URL publik dan tombol Hentikan; matikan otomatis saat Astra keluar; token user disimpan di data/ (tidak lewat argumen proses bila memungkinkan, tidak masuk Git). Binary disediakan user atau lewat katalog.
>
> **13C MySQL Community sebagai mesin alternatif:** generalisasi `MariaDbService` menjadi service keluarga MySQL dengan parameter mesin; data dir terpisah (`data/mysql-<mayor>/`); hanya satu mesin yang boleh memakai port 3306 pada satu waktu (pesan jelas bila bentrok); jangan pernah memakai ulang data dir antar mesin.
>
> **13D Yarn/pnpm:** tambahkan sebagai runtime tambahan di PATH terminal (Fase 10) hanya jika user meminta; prioritas terendah karena npm sudah tersedia dari Node.

---

> **13E Xdebug:** toggle Xdebug per versi PHP (DLL `php_xdebug` harus cocok dengan versi PHP, TS/NTS, VS, dan arsitektur; unduh dari sumber resmi dengan verifikasi manual), output profil/trace ke `tmp/xdebug/`, port 9003, nonaktif secara default.
>
> **13F Data dir MariaDB per versi mayor:** Laragon memakai `data/mysql-8`, `data/mysql-8.4`. Pertimbangkan `data/mariadb-<mayor>` untuk instalasi baru; data lama `data/mysql` diperlakukan sebagai legacy milik versi yang menginisialisasinya (baca `mariadb_upgrade_info`), tanpa memindahkan data otomatis.

## Tips Vibe Coding

- Selalu sertakan pesan error lengkap dan isi log (`logs/*/error.log`) saat melaporkan masalah.
- Jangan loncat fase; tiap fase bergantung pada abstraksi fase sebelumnya (terutama Fase 5 → 6 → 9).
- Verifikasi URL unduhan dan SHA256 di katalog secara manual sebelum dipercaya.
- Ukur RAM tiap beberapa fase; batas buffer log (1000 baris main, 500 baris UI) tidak boleh dilonggarkan.
- Jika sebuah fase terlalu besar, minta Hermes membaginya menjadi dua commit, jangan dua fase sekaligus.
