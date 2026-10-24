# PRD.md — Product Requirements Astra

## 1. Visi

Astra adalah **developer workbench** Windows untuk lingkungan web lokal: portabel, modular, dan dapat diprediksi. Referensi pengalaman: Laragon (alur kerja dan kejelasan), bukan salinan identitas visual atau kode.

## 2. Pengguna dan tugas utama

Developer web (PHP/Laravel/WordPress, Node, Python) di Windows. Tugas utama:

1. Menyalakan/menghentikan service dan melihat statusnya (termasuk alasan gagal).
2. Memilih versi runtime yang tersedia (PHP, Apache, MariaDB, dst.).
3. Membuka proyek di `*.test`, folder, terminal, atau editor.
4. Membaca log dan menyalin detail error.
5. Mengubah konfigurasi dengan tahu sumbernya (template bawaan atau override).

## 3. Prinsip produk

1. **Utility over decoration** — elemen UI harus menolong memahami status atau menyelesaikan tindakan.
2. **UI jujur** — tanpa data dummy, tombol palsu, atau status sukses tanpa sumber nyata.
3. **Error yang bisa ditindaklanjuti** — apa yang gagal, di mana, langkah berikutnya, lokasi log.
4. **Tidak ada tindakan berdampak besar diam-diam** (ganti versi aktif, hapus, ubah config).
5. **Portabel dan terisolasi** — semua di folder Astra; tanpa service sistem; tanpa admin untuk pemakaian normal.
6. **Modular** — fitur baru sebisa mungkin berupa definisi/manifest, bukan kelas baru.

## 4. Status fitur

Kunci: **Ada** (terverifikasi), **Sebagian**, **Direncanakan**, **Opsional**, **Tidak dibundel**.

| Fitur                                                               | Status                 | Catatan                                                                 |
| ------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| Apache, MariaDB (service)                                           | Ada                    | Graceful shutdown MariaDB via `astra_admin`                             |
| PHP multi-versi (mod_php Thread Safe)                               | Ada                    | NTS ditandai untuk PHP-CGI/Nginx                                        |
| Runtime Manager multi-versi (struktur ala Laragon)                  | Ada                    | ID versi = nama folder; layout lama tetap terbaca                       |
| Template + override `usr/tpl`, pembersih `tmp/`                     | Ada                    |                                                                         |
| Packaging `extraResources`, CI (typecheck + lint)                   | Ada                    |                                                                         |
| Tambah versi manual (folder arsip di `bin/<jenis>/` + Pindai ulang) | Ada                    | Nama folder = nama arsip; UI menjelaskan pola dan alasan folder invalid |
| Hapus versi runtime dari UI                                         | Sebagian               | Sering gagal di Windows; penguatan di T-6D                              |
| Unduhan otomatis runtime (resolver, katalog, wizard)                | **Dibatalkan**         | Diputuskan: pengguna memasang versi yang diinginkan secara manual       |
| Virtual host `*.test` + hosts (UAC helper)                          | Direncanakan (Fase 7)  | Skrip helper sudah ada, logika belum                                    |
| Nginx + PHP-CGI, PHP per proyek                                     | Direncanakan (Fase 8)  |                                                                         |
| PostgreSQL, HeidiSQL, Adminer, phpMyAdmin                           | Direncanakan (Fase 8B) | Penempatan manual; tipe `tool` hanya untuk deteksi dan tombol buka      |
| Mailpit (pengganti sendmail), Redis, Memcached                      | Opsional (Fase 8C)     | Build Windows Redis/Memcached tidak resmi                               |
| Quick Create (Blank, Laravel, WordPress)                            | Direncanakan (Fase 9)  | WordPress hanya MariaDB                                                 |
| Node/Python + terminal, Git (MinGit), Procfile                      | Direncanakan (Fase 10) |                                                                         |
| Menu Tools / buka di editor, edit override                          | Direncanakan (Fase 11) |                                                                         |
| SSL (mkcert), tray, autostart, installer                            | Direncanakan (Fase 12) | Keputusan lokasi data installer terbuka                                 |
| Scheduler, tunnel (cloudflared/ngrok), MySQL, Yarn, Xdebug          | Opsional (Fase 13)     |                                                                         |
| Telnet, Cmder, Notepad++                                            | Tidak dibundel         | Notepad++ hanya dideteksi sebagai editor                                |

## 5. Keputusan cakupan vs Laragon

- Ditiru: multi-versi runtime, vhost otomatis, Quick Create, menu Tools, `tmp/` + `usr/` (override template, PATH tambahan, Procfile).
- Diganti: sendmail → Mailpit; cmder → Windows Terminal/PowerShell ber-PATH Astra; ngrok → opsional (cloudflared tanpa akun).
- Dihapus dari rencana: unduhan otomatis runtime. Versi yang diinginkan dipasang manual oleh pengguna.
- Git: deteksi Git sistem; opsional MinGit (zip) untuk Composer.
- Tidak ditiru: qit/telnet/folder `laragon`, dan hal niche lain.
- Tambahan Astra: PostgreSQL dengan data dir per versi mayor.

## 6. Non-goals

Bukan pengunduh runtime otomatis, bukan SaaS/dashboard statistik, bukan penyedia hosting produksi, bukan pengelola service Windows, tidak mengekspos layanan ke jaringan (kecuali tunnel opsional dengan konfirmasi), tidak mengganti versi/ data secara otomatis.

## 7. Batasan dan target kualitas

- Windows 10/11 x64; Node 22.12+ untuk pengembangan.
- RAM aplikasi Astra sendiri tetap ringan (acuan saat ini 100–150 MB); buffer log dibatasi (1000 baris main, 500 baris UI).
- Aplikasi utama tidak berjalan sebagai Administrator.
- Definisi selesai sebuah fitur: perilaku nyata terverifikasi (bukan hanya tampak berfungsi), state loading/empty/error ada, typecheck/lint/test lulus, uji manual Windows dicatat.

## 8. Risiko

| Risiko                                                                                           | Mitigasi                                                                                       |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Salah penempatan manual (nama folder salah, folder pembungkus ganda)                             | UI Versions menampilkan pola nama, contoh, dan alasan folder invalid; opsi "Perbaiki struktur" |
| Semantik file Windows (antivirus, lock, proses yatim, read-only) membuat penghapusan versi gagal | Rename-lalu-hapus, deteksi proses, retry, sisa dibersihkan saat startup, tes di CI Windows     |
| Data database rusak karena shutdown paksa atau pergantian versi                                  | Graceful stop, tidak pernah init ulang, peringatan versi mayor                                 |
| Uninstaller menghapus `data/`                                                                    | Putuskan lokasi data sebelum rilis installer (Fase 12)                                         |
| Pekerjaan agen yang dilaporkan sukses padahal gagal                                              | Verifikasi edit, tes otomatis, laporan membedakan yang diuji dan belum                         |

## 9. Keputusan terbuka

1. ~~Strategi unduhan otomatis~~ — **diputuskan: dibatalkan**; kode unduhan dihapus (T-6R).
2. Layout `tmp/` flat dipertahankan dengan pembersih berpola ketat (`sess_*`, `php*.tmp`).
3. Lokasi data pada installer (Fase 12).
4. Bahasa UI (Indonesia/Inggris) — pilih satu sebelum pekerjaan frontend.
5. Data dir MariaDB per versi mayor (Fase 13F).
