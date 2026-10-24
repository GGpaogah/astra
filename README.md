# Astra

Lingkungan pengembangan web lokal **portabel untuk Windows** (alternatif terbuka mirip Laragon). Astra menjalankan Apache, PHP, dan MariaDB sebagai proses portabel dari satu aplikasi desktop, tanpa memasang service sistem dan tanpa hak Administrator untuk pemakaian normal.

> Status: dalam pengembangan aktif. Belum setara Laragon. Daftar fitur dan status ada di [PRD.md](PRD.md); pekerjaan yang sedang berjalan ada di [TASK.md](TASK.md).

## Yang sudah bisa

- Start / Stop / Restart Apache dan MariaDB; Start All / Stop All berurutan
- Banyak versi runtime berdampingan (PHP, Apache, MariaDB; Nginx, PostgreSQL, Node.js, Python, Composer terdeteksi) dengan struktur folder ala Laragon
- Ganti versi aktif dari tab Versions; konfigurasi di-generate dari template (bisa dioverride di `usr/tpl/`)
- Log real-time, deteksi port bentrok, pembersih file sementara PHP
- Tambah versi: letakkan folder arsip di `bin/<jenis>/` lalu **Pindai ulang**; hapus versi yang tidak dipakai dari tab Versions. Astra tidak mengunduh runtime secara otomatis (keputusan proyek)

## Yang belum

Virtual host `.test`, Nginx/PHP-CGI, PostgreSQL, Mailpit/Redis/Memcached, Quick Create (Laravel/WordPress), terminal, SSL, tray/autostart. Rinciannya di [TASK.md](TASK.md).

## Mulai cepat

Prasyarat: Windows 10/11, Node.js 22.12+ (diuji 24.x), npm 11+, Git.

```powershell
git clone https://github.com/GGpaogah/astra.git
cd astra
npm install
npm run typecheck ; npm run lint     # validasi statis
npm run dev                          # pengembangan (Windows)
npm run build                        # build produksi (Windows)
```

Binary Apache/PHP/MariaDB **tidak** ada di repositori: letakkan di `bin/` (lihat [TECHSTACK.md](TECHSTACK.md), bagian Setup).

## Dokumen (hanya 8 berkas)

| Berkas                         | Isi                                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| [README.md](README.md)         | Gambaran singkat dan mulai cepat                                      |
| [CLAUDE.md](CLAUDE.md)         | Aturan kerja agen AI (titik masuk untuk Claude, Kiro, Hermes, dll.)   |
| [PRD.md](PRD.md)               | Produk: visi, ruang lingkup, status fitur, keputusan                  |
| [SECURITY.md](SECURITY.md)     | Aturan dan batas keamanan                                             |
| [SKILL.md](SKILL.md)           | Playbook langkah-demi-langkah untuk pekerjaan berulang                |
| [STYLEGUIDE.md](STYLEGUIDE.md) | Gaya kode, Git, dokumentasi, dan UI                                   |
| [TASK.md](TASK.md)             | Daftar tugas, fase, temuan terbuka                                    |
| [TECHSTACK.md](TECHSTACK.md)   | Stack, arsitektur, struktur folder, packaging, setup, troubleshooting |
