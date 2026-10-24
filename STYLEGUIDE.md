# STYLEGUIDE.md — Gaya Kode, Git, Dokumentasi, dan UI

## 1. TypeScript dan struktur

- ES Modules; `strict` aktif. Tidak ada `any` tanpa alasan tertulis; gunakan `unknown` + validasi untuk data eksternal.
- Satu gaya ekspor per modul (utamakan named export); periksa semua pengimpor saat mengubah ekspor.
- Nama: `PascalCase` kelas/komponen/tipe, `camelCase` fungsi/variabel, `UPPER_SNAKE` konstanta, berkas kelas `PascalCase.ts`, utilitas `camelCase.ts`.
- Modul main process di `electron/core/` (logika), `electron/ipc/` (handler tipis), `src/` (renderer). Logika murni dipisah dari I/O agar bisa dites tanpa Electron.
- Tidak ada path hardcode; gunakan `Paths.ts`. `__dirname` di ESM dibuat dari `import.meta.url`.
- Path di berkas konfigurasi memakai forward slash (`toIniPath`).
- Fungsi yang bisa gagal mengembalikan hasil bertipe atau melempar error dengan `code` yang jelas; jangan menelan error. Pesan error: apa gagal, path/resource, langkah berikut.
- Log: format `[waktu] [komponen] pesan`; tanpa rahasia; buffer dibatasi (1000 baris main, 500 baris UI). Tidak ada `console.log` sisa debug.
- Komentar menjelaskan **mengapa** (mis. alasan domain allowlist), bukan apa.
- Tes: `node --test` (bawaan), tanpa dependensi tambahan; fixture untuk data eksternal.

## 2. Git

- Awalan commit: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`; `wip:` boleh sementara. Satu tugas = satu commit kecil; pesan menyebut fase/tugas.
- Tanpa force-push dan tanpa perintah destruktif. Jangan commit `package-lock.json` dari Linux; jangan commit artefak (`bin/ data/ logs/ etc/ tmp/ release/ dist-electron/`, isi `www/` dan `usr/`).
- Commit dan push sering bila mesin pengembangan tidak stabil dayanya.

## 3. Dokumentasi

- Hanya 8 berkas `.md` di root (lihat `README.md`). Tidak ada folder aturan tersembunyi.
- Bahasa: Bahasa Indonesia; istilah teknis tetap Inggris.
- Status fitur memakai kunci yang sama di mana pun: Ada / Sebagian / Direncanakan / Opsional / Tidak dibundel.
- Jangan menyatakan fitur selesai berdasarkan dokumen saja; verifikasi kode. Dokumen yang bertentangan dengan kode: catat konflik di `TASK.md` lalu perbaiki.

## 4. UI (berlaku saat pekerjaan frontend dimulai)

Frontend belum menjadi prioritas; bagian ini menjaga arah agar tidak menjadi dashboard generik.
**Prinsip**

- Utility over decoration. Setiap elemen punya tujuan pengguna. Alasan "agar terlihat modern" tidak cukup.
- UI jujur: tanpa data dummy, tombol palsu, atau status sukses tanpa sumber backend. Status service hanya yang ada di backend: `stopped | starting | running | stopping | error` (jangan menambah "Unknown" tanpa perubahan backend yang disetujui).
- Operasi berisiko (ganti versi aktif, hapus, stop service) menjelaskan dampak, menampilkan proses berlangsung, mencegah klik ganda, dan melaporkan hasil nyata.
- Error yang bisa ditindaklanjuti; stack trace mentah hanya di bagian yang bisa dibuka/disalin.

**Arah visual:** tenang, padat informasi, fungsional (developer workbench). Daftar service berupa baris padat, bukan kartu besar. Tanpa gradient/glow/blur dekoratif. Warna aksen hemat; warna status konsisten (berjalan, peringatan, gagal, info). Animasi hanya untuk umpan balik perubahan state.
**Token:** satu sistem token di CSS Tailwind v4 (`@theme`): background/surface, teks (utama/sekunder/disabled), border, aksen + fokus, status (success/warning/danger/info), spasi, radius, ukuran teks, durasi transisi singkat. Jangan membuat sistem token kedua.
**Komponen:** buat hanya bila ada ≥2 pemakaian nyata (button, status badge, dialog konfirmasi, toast, empty/loading/error state, tabel/daftar teknis, log viewer). Tanpa pustaka UI besar; tanpa dependensi baru tanpa persetujuan.
**State yang harus ada:** normal, hover, focus (terlihat), disabled, loading, empty, error, success sesuai konteks.
**Desktop Windows:** ukuran jendela minimum yang jelas, DPI 125/150%, path dan pesan error panjang dipotong di tengah dengan tombol salin, font monospace untuk log, navigasi keyboard dan fokus, hormati `prefers-reduced-motion`.
**Aturan implementasi:** jangan mengganti seluruh frontend sekaligus; jangan mengubah backend/IPC demi tampilan; satu alur per perubahan; periksa diff; laporkan apa yang diuji dan apa yang perlu uji manual.
**Bahasa UI:** belum diputuskan (lihat `PRD.md` §9); pakai satu bahasa secara konsisten setelah diputuskan.
