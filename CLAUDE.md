# CLAUDE.md — Konteks Proyek

Proyek: **Astra**, aplikasi desktop lingkungan pengembangan web lokal (Windows), mirip Laragon.  
Stack: Electron + TypeScript + React + Vite + Tailwind.

> **Aturan lengkap ada di `.kiro/steering/astra-rules.md`** — baca file itu sebagai sumber kebenaran utama.  
> File ini hanya berisi catatan teknis yang relevan untuk agen AI (Claude, Kiro, dsb.).

## Perintah

```bash
npm run dev          # mode development
npm run typecheck    # validasi TypeScript (wajib sebelum commit)
npm run lint         # oxlint
npm run build        # build installer (Windows)
```

## Lingkungan Kerja

- Package manager: **npm saja** (`engines.node >= 22.12`). Jangan pakai pnpm/yarn.
- Proyek ESM (`"type": "module"`): tidak ada `__dirname` bawaan, gunakan `import.meta.url`.
- Hasil build: `dist-electron/main.js` dan `dist-electron/preload.mjs`.
- Kamu mungkin berjalan di VM Linux; target binary adalah **Windows** — jangan jalankan `npm run dev` di Linux.
- Validasi cukup dengan `typecheck` dan `lint`. Commit kecil per fase.
- Jangan commit `package-lock.json` dari VM Linux (native binding berbeda per OS).
