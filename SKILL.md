---
name: astra-dev
description: Playbook mengembangkan Astra (Electron + TypeScript, lingkungan web lokal Windows). Gunakan saat memulai/mengakhiri sesi, menambah runtime, service, IPC, atau template, mengintegrasikan sumber data eksternal, menghapus versi runtime atau operasi berkas berat di Windows, atau menelusuri error yang dilaporkan dari Windows.
---

# SKILL.md — Playbook Astra

Aturan umum ada di `CLAUDE.md`, keamanan di `SECURITY.md`. Berkas ini berisi **langkah** untuk pekerjaan yang berulang.

## Playbook 1 — Memulai sesi

1. Baca `CLAUDE.md` dan `TASK.md`; `node -p process.platform`; `git status` (tidak bersih → laporkan, berhenti); `git log --oneline -10`.
2. Baca hanya kode yang relevan. Jika dokumen dan kode berbeda, percaya kode dan catat konflik.
3. Tulis rencana singkat (≤8 poin) bila tugasnya tidak sepele. Jika ada keputusan desain ambigu, tanya; jika tidak, kerjakan.

## Playbook 2 — Menambah jenis runtime

1. `electron/core/runtimes/RuntimeDefinition.ts`: id, folder induk (`php`, `nodejs`, …), marker `detect()`, regex versi dari nama folder, fallback `--version` (timeout 3 dtk, tanpa shell), env/PATH.
2. Tes: nama folder nyata dari arsip resmi, versi dua segmen, folder tanpa marker, build NTS/TS (khusus PHP).
3. Pastikan UI Versions menampilkan jenis baru tanpa kode khusus.

## Playbook 3 — Menambah service

1. Turunkan dari `BaseService` (atau manifest generik bila Fase 8C sudah ada).
2. Urutan: pre-check (binary ada, port bebas, bukan Administrator bila perlu) → generate config via `TemplateResolver` → `spawnProcess` (windowsHide) → siap hanya setelah port/`ready-check` merespons (timeout) → stop **graceful dulu**, fallback `tree-kill`, log yang membedakan keduanya.
3. Bind `127.0.0.1`; password tidak di argumen. Daftarkan di `ServiceManager` (urutan start: database → pendukung → web; stop terbalik).
4. Pesan error: apa yang gagal, path/port, 20 baris log terakhir, langkah berikut.

## Playbook 4 — Menambah channel IPC

1. Handler di `electron/ipc/<area>.ipc.ts` dengan validasi (lihat tabel `SECURITY.md` §2); daftarkan di `main.ts`.
2. `preload.ts` mengekspos metode bertipe; deklarasi di `src/types.d.ts`; pembungkus di `src/lib/ipc.ts`.
3. Konsisten named vs default export. Tes validasi: input berbahaya (`..`, absolut, nama aneh) ditolak.

## Playbook 5 — Mengubah/menambah template konfigurasi

1. Template di `electron/templates/`; baca lewat `TemplateResolver` (override `usr/tpl`). Path memakai forward slash (`toIniPath`).
2. Template baru harus ikut `extraResources`; periksa `build` di `package.json` dan uji di `release\win-unpacked`.
3. Jika template berubah, ingat salinan override pengguna adalah snapshot (peringatan "usang" direncanakan Fase 11).

## Playbook 6 — Integrasi sumber data eksternal (API, listing, checksum)

Unduhan runtime sudah dibatalkan; playbook ini berlaku bila ada integrasi eksternal lain. Akar bug berantai di Fase 6 dulu: parser ditulis dari asumsi. Urutan wajib:

1. **Request nyata baca-saja** (`curl.exe -I -L` untuk URL/redirect/ukuran; `Invoke-RestMethod` untuk JSON). Cetak struktur dan 1–2 elemen, bukan seluruh respons.
2. Simpan **fixture** terpangkas (KB, dengan tanggal dan URL sumber) di `electron/core/download/__fixtures__/`.
3. Tulis **parser murni** (input teks/JSON → hasil), terpisah dari `fetch`/Electron/`Paths`.
4. **Schema guard**: field hilang → error deskriptif ("format berubah: field X tidak ada di <sumber>"), bukan `undefined`.
5. Pilih channel dari **field resmi** sumber, bukan heuristik tanggal. Channel tidak ada → fallback katalog + pesan jelas.
6. Allowlist domain untuk **setiap hop redirect**; tambahkan domain hanya jika terbukti muncul di rantai nyata, lengkap dengan alasan di komentar.
7. Tes `node --test` memakai fixture: normal, field hilang, channel tidak ada, redirect ke domain di luar allowlist. Situs yang memblokir otomasi (Apache Lounge): jangan ditembus; sediakan unduh manual/URL kustom.
8. Nama berkas diambil dari data nyata (mis. Python embeddable: periksa penamaan sebenarnya di python.org), bukan diketik dari ingatan.

## Playbook 7 — Menghapus versi runtime dan operasi berkas berat di Windows

Penyebab gagal yang umum: proses yatim (`mariadbd.exe`, `httpd.exe`, `php-cgi.exe`) memegang folder, antivirus/indexer memegang berkas, jendela Explorer terbuka, atribut read-only, path panjang (MAX_PATH), `EPERM/EBUSY/ENOTEMPTY`. **Jangan menambal satu kasus demi satu kasus**; reproduksi dengan tes dulu.

**Alur hapus (urutan wajib):**

1. **Prasyarat:** hanya folder hasil scan valid; tolak bila versi **aktif** ("pilih versi lain dulu"), atau dipakai service yang berjalan (cek `ServiceManager`). Jika itu satu-satunya versi jenis tersebut, boleh, tapi beri peringatan ("service terkait tidak bisa start"). Layout "default" (datar) butuh konfirmasi ketik nama.
2. **Cari proses** yang berjalan dari folder itu: PowerShell `Get-CimInstance Win32_Process` difilter `ExecutablePath` di bawah folder, path dikirim lewat variabel lingkungan. Jika ada, tampilkan nama+PID dan tawarkan "Hentikan proses ini" (konfirmasi eksplisit); jangan mematikan paksa diam-diam.
3. **Rename ke `bin/<jenis>/__del_<waktu>`** (atomik; versi langsung hilang dari daftar).
4. **Hapus** `__del_*` dengan `fs.rm(recursive, maxRetries, retryDelay)`; lepas atribut read-only bila perlu. Gagal → biarkan `__del_*`, tandai "menunggu dihapus (N)" di UI dengan tombol "Coba lagi", dan bersihkan otomatis saat startup berikutnya.
5. **Pesan hasil** nyata: berhasil / menunggu dihapus / gagal + kode errno + path + langkah berikut (tutup Explorer, matikan proses, kecualikan `bin\` dari antivirus). Data database di `data/` tidak ikut terhapus; sebutkan itu di dialog.
6. UI: dialog konfirmasi (nama versi, path, ukuran, dampak); tombol dinonaktifkan selama proses; cegah klik ganda.

**Startup:** hapus hanya sisa berawalan `__tmp_*` dan `__del_*` di `bin/<jenis>/`; jangan menyentuh versi valid atau folder pengguna.
**Diagnostik:** `logs/astra-runtime-ops.log` (tahap, retry, errno, path; tanpa rahasia).
**Tes otomatis (`node --test`, CI windows-latest):** folder sementara dengan berkas read-only dan subfolder dalam; kasus: sukses, berkas sedang dibuka (tahan `fs.openSync`) → rename sukses, hapus gagal → status "menunggu dihapus" lalu berhasil setelah handle dilepas, folder aktif ditolak, pemulihan startup menghapus `__del_*`/`__tmp_*` tanpa menyentuh versi valid.
**Uji manual Windows:** hapus versi tak terpakai; hapus saat Explorer membuka folder itu; hapus saat proses masih hidup; hapus versi aktif (harus ditolak); antivirus aktif vs pengecualian Defender.

**Menambah versi manual (pengganti unduhan):** pengguna mengekstrak arsip resmi ke `bin/<jenis>/<nama-arsip>/` lalu menekan Pindai ulang. UI Versions menampilkan pola nama + contoh tiap jenis, dan untuk folder invalid memberi alasan (marker tidak ditemukan; folder pembungkus ganda). Opsional "Perbaiki struktur": hanya jika folder punya tepat satu subfolder yang berisi marker; angkat isinya satu level lewat rename atomik dengan konfirmasi.

## Playbook 8 — Menelusuri error yang dilaporkan dari Windows

Minta: pesan error lengkap dari UI, `logs/<komponen>/*.log`, `logs/astra-runtime-ops.log`, `data/astra-settings.json` (tanpa rahasia), daftar `bin\<jenis>\`. Reproduksi dengan tes; perbaiki akar penyebab; tambahkan tes regresi.

## Playbook 9 — Mengakhiri sesi

1. `npm run typecheck`, `npm run lint`, `npm test` (bila ada) → exit 0. `npm run build` jika menyentuh packaging.
2. `git status`: tidak ada berkas di luar lingkup, tidak ada `package-lock.json` tak sengaja.
3. Perbarui status di `TASK.md`. Commit dengan awalan konvensional.
4. Laporan ≤30 baris: apa yang dijalankan, hasilnya, dan apa yang **belum** diuji (uji manual Windows).

## Anti-pola (jangan)

Melaporkan sukses atas edit yang gagal · menulis parser dari asumsi · menambal bug yang sama berulang tanpa tes reproduksi · mematikan validasi (allowlist) agar tes lewat · data/tombol/status palsu di UI · menghapus data database · menambah dependensi tanpa izin · membuat berkas `.md` baru.
