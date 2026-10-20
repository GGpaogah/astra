# Astra — Local Web Dev Environment (mirip XAMPP/Laragon)

Aplikasi desktop untuk menjalankan Apache/Nginx + PHP + MariaDB secara portable, lengkap dengan virtual host otomatis (`namaproyek.test`).

## Tujuan MVP
1. Start / Stop / Restart service: Apache, MariaDB
2. Pilih versi PHP (portable, bisa lebih dari satu)
3. Tombol buka folder `www`, buka `localhost`, buka phpMyAdmin
4. Viewer log real-time
5. Deteksi port bentrok (80, 443, 3306)
6. Virtual host otomatis dari nama folder di `www/`

## Di Luar MVP (fase berikutnya)
- Nginx, Node.js, Redis, PostgreSQL
- SSL lokal (mkcert)
- Tray icon + autostart
- Quick create project (Laravel, WordPress)
- Auto-update binary

## Tech Stack
| Lapisan | Pilihan |
|---|---|
| Shell desktop | Electron |
| Bahasa | TypeScript |
| UI | React + Vite + Tailwind |
| Proses | Node `child_process` |
| Config store | File JSON via `fs` |
| Packaging | electron-builder |

## Dokumen
- `SETUP.md` — cara menyiapkan proyek dari nol
- `ARCHITECTURE.md` — struktur folder & desain modul
- `ROADMAP_PROMPTS.md` — urutan prompt vibe coding per fase
- `CLAUDE.md` — konteks untuk AI coding assistant (taruh di root proyek)
- `SETUP_HERMES.md` — menyambungkan Hermes Agent (VM Proxmox) ke VS Code via Remote-SSH
