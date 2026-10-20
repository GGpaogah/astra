# CLAUDE.md — Konteks Proyek

Proyek: LocalStack, aplikasi desktop mirip XAMPP/Laragon (Windows dulu).
Stack: Electron + TypeScript + React + Vite + Tailwind.

## Aturan

- Ikuti struktur di ARCHITECTURE.md, jangan buat folder baru tanpa alasan.
- Renderer tidak boleh import Node API; gunakan IPC via preload.
- Semua path lewat `electron/core/Paths.ts`.
- Semua service extend `BaseService`.
- Config di `etc/` selalu hasil generate dari `electron/templates/`.
- Tangani error dengan pesan jelas ke UI, jangan crash diam-diam.
- Kerjakan satu fase dari ROADMAP_PROMPTS.md per permintaan.
- Jangan ubah file di luar lingkup tugas.

## Perintah

- `npm run dev` — jalankan mode development
- `npm run build` — build installer

## Lingkungan Kerja (PENTING)

- Kamu berjalan di VM Linux via Remote-SSH; target aplikasi adalah **Windows**.
- Jangan menjalankan `npm run dev`, Apache, atau MariaDB di VM (tidak ada layar dan binary-nya Windows).
- Validasi cukup dengan `npm run typecheck` dan lint.
- Gunakan `path.join`/`path.resolve` dan hindari path hardcode; kode harus lolos di Linux tapi bekerja di Windows.
- Operasi khusus Windows (file hosts, `.exe`) dibungkus agar tidak crash di Linux saat type-check.
- Commit kecil per fase; user akan `git pull` dan menguji di Windows.

## Aturan Teknis (hasil pelajaran Fase 1)

- Package manager: **npm saja**. Jangan pakai pnpm/yarn dan jangan membuat `pnpm-lock.yaml`.
- Jangan commit `package-lock.json` dari VM Linux (binding native berbeda per OS). Lockfile hanya di-commit dari Windows atau diabaikan.
- Proyek ESM (`"type": "module"`): tidak ada `__dirname` bawaan, buat dari `import.meta.url`.
- Hasil build: `dist-electron/main.js` dan `dist-electron/preload.mjs`. Jangan ubah nilai `"main"` tanpa memeriksa output.
- Import plugin: `import electron from "vite-plugin-electron/simple"`. Jangan menghapus plugin `react()` di `vite.config.ts`.
- Setiap file baru di `electron/` atau `src/` harus dicakup `tsconfig` agar `npm run typecheck` memeriksanya.
- Jaga konsistensi named vs default export antar modul; periksa semua importer saat mengubah ekspor.

## Gaya Kerja Hemat Kuota

- Baca hanya file yang relevan dengan tugas; jangan membaca ulang seluruh repo setiap sesi.
- Jangan menjelaskan kode yang tidak diubah. Hindari pengulangan isi file dalam laporan.
- Laporan akhir maksimal 30 baris: file berubah, keputusan penting, edge case, langkah uji. Tanpa kode utuh.
- Untuk tugas yang kecil dan jelas, boleh langsung dikerjakan tanpa menunggu "lanjut"; berhenti dan tanya hanya jika ada keputusan desain yang ambigu.
- Satu fase = satu commit kecil. Jangan menyentuh file di luar lingkup (cek `git status` sebelum commit; jangan commit package-lock.json).
