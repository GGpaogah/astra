# SECURITY.md — Aturan Keamanan Astra

Astra menjalankan proses dan menulis berkas di mesin pengembang, jadi batasnya harus eksplisit. Aturan ini **wajib** untuk semua perubahan.

## 1. Electron

- `contextIsolation: true`, `nodeIntegration: false`. Renderer hanya memakai `window.api` dari `preload`.
- Tidak memuat konten remote di jendela utama. Batasi navigasi dan jendela baru (`will-navigate`, `setWindowOpenHandler`).
- `shell.openExternal` hanya untuk URL yang lolos validasi (lihat tabel).
- Tidak ada `eval`/`new Function`/`dangerouslySetInnerHTML` dengan data dari log atau sumber eksternal.

## 2. Validasi IPC (di main process, bukan hanya UI)

| Input                                      | Aturan                                                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL                                        | `new URL()`, protokol `http:`/`https:`, hostname **persis** `localhost` atau berakhir sufiks domain Astra (`.test`, mulai Fase 7). Bukan `startsWith` |
| Path                                       | `path.resolve` + `fs.realpath`, harus berada di dalam akar yang diizinkan (`bin/`, `tmp/`, `www/`, `usr/`); tolak `..` dan path absolut dari renderer |
| Nama (situs, database, runtime, folder id) | Whitelist regex; hasil harus ada di hasil scan valid saat itu                                                                                         |
| Port                                       | Bilangan bulat 1024–65535, bukan port yang dipakai service Astra lain                                                                                 |
| Jenis runtime                              | Harus ada di daftar jenis yang dikenal                                                                                                                |

## 3. Jaringan dan layanan

- Semua service bind `127.0.0.1` (Apache, MariaDB, PostgreSQL, Redis, Memcached, Mailpit, dst.).
- PostgreSQL `trust` hanya untuk `127.0.0.1/32` dan `::1/128`. Redis `protected-mode yes`.
- Tunnel (Fase 13) tidak pernah start otomatis; butuh konfirmasi per sesi dan mati saat Astra keluar.

## 4. Rahasia

- Password/token tidak boleh ada di argumen proses, log, pesan error, atau UI. Pakai variabel lingkungan (mis. `MYSQL_PWD`) atau berkas kredensial di `data/`.
- `data/`, `etc/`, `tmp/` tidak masuk Git. Kredensial internal (`astra_admin`) hanya hak `SHUTDOWN`.
- Jangan commit `.env`, token, atau `config.inc.php` hasil generate.

## 5. Jaringan keluar dan berkas dari pengguna

- Astra **tidak mengunduh runtime** (keputusan proyek). Pengguna menaruh folder arsip sendiri di `bin/<jenis>/`; nama folder dan isinya divalidasi oleh `detect()` dan hanya dibaca setelah lolos scan.
- Bila nanti ada fitur jaringan keluar (mis. Composer pada Quick Create, zip WordPress), wajib: HTTPS, allowlist domain di setiap hop redirect, checksum bila tersedia, tolak path traversal/symlink keluar saat ekstrak, batas ukuran, tidak mengeksekusi apa pun sebelum verifikasi selesai, dan tidak menembus proteksi anti-otomasi.

## 6. Sistem berkas

- Semua path lewat `Paths.ts`. Penghapusan hanya di dalam `bin/<jenis>/<folder-versi>`, `__tmp_*`, `__del_*`, `data/downloads/`, dan `tmp/` berpola ketat.
- `TmpCleaner` hanya menghapus `sess_*` dan `php*.tmp` yang melewati batas umur; tidak pernah `hosts.tmp`, `php_errors.log`, atau subfolder.
- Tidak pernah menghapus, memindahkan, atau menginisialisasi ulang data database (`data/mysql`, `data/postgresql`).
- Versi runtime yang aktif atau dipakai service yang berjalan tidak boleh dihapus.
- Penghapusan versi hanya untuk folder hasil scan valid di `bin/<jenis>/`; selalu **rename ke `__del_<waktu>` lebih dulu**; layout "default" (datar) butuh konfirmasi ketik nama; data database di `data/` tidak pernah ikut terhapus.
- Folder `__tmp_*`/`__del_*` di `bin/<jenis>/` boleh dibersihkan saat startup; tidak ada penghapusan lain di `bin/`.

## 7. Proses dan hak akses

- Path yang diberikan ke PowerShell (mis. mencari proses dari sebuah folder) dikirim lewat **variabel lingkungan** atau argumen terpisah, tidak digabung ke string perintah. Mematikan proses hanya untuk PID yang `ExecutablePath`-nya di dalam folder itu dan setelah konfirmasi pengguna.
- Jalankan proses dengan `spawn` + array argumen (tanpa `shell: true` untuk input pengguna). Matikan hanya PID milik Astra (`tree-kill`).
- Aplikasi utama **tidak** berjalan sebagai Administrator (PostgreSQL menolaknya, dan menekan risiko).
- Penulisan file hosts hanya lewat helper UAC terpisah: hanya mengelola blok `# BEGIN ASTRA … # END ASTRA`, memvalidasi setiap baris (`127.0.0.1 <nama>.test`), mencadangkan hosts sekali, dan membaca ulang hasilnya. Helper berada di luar `app.asar`; path ditentukan main process, bukan renderer.

## 8. Rantai pasok

- npm saja; tidak ada dependensi baru tanpa persetujuan; `package-lock.json` hanya dari Windows.
- CI (windows-latest) menjalankan typecheck, lint, dan tes. Tinjau diff dependensi.
- Binary pihak ketiga (Redis/Memcached Windows) ditandai "tidak resmi" di UI.

## 9. Pelaporan kerentanan

Laporkan secara privat lewat GitHub Security Advisories pada repositori ini (atau kontak pemilik repo). Jangan membuka isu publik berisi detail eksploitasi.

## 10. Daftar periksa perubahan

- [ ] Input IPC baru divalidasi di main process
- [ ] Tidak ada rahasia di argumen/log/UI
- [ ] Path melewati `Paths.ts` dan guard realpath
- [ ] Jaringan keluar (jika ada): HTTPS + allowlist tiap hop + checksum + anti-traversal
- [ ] Tidak ada penghapusan di luar area yang diizinkan
- [ ] Service hanya bind 127.0.0.1
