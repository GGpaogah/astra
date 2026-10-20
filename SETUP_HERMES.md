# SETUP_HERMES — Hermes Agent (VM Proxmox) + VS Code Windows via Remote-SSH

Skema: VS Code di Windows → SSH → VM Proxmox (`192.168.1.103`) tempat Hermes Agent
dan folder proyek berada. Pengujian aplikasi (Electron + binary Windows) dilakukan
di Windows lewat Git.

```
[Windows]                          [VM Proxmox 192.168.1.103]
VS Code (UI)  ── SSH (port 22) ──► VS Code Server
                                   ├─ Hermes Agent (hermes acp)
                                   └─ ~/projects/localstack  (git repo)
      ▲
      └── git pull ◄──── git push ──┘   (uji & jalankan di Windows)
```

> Catatan: langkah ekstensi/perintah Hermes di bawah berdasarkan informasi
> komunitas/marketplace dan bisa berubah. Verifikasi di dokumentasi resmi:
> https://hermes-agent.nousresearch.com/ dan https://github.com/NousResearch/hermes-agent

---

## Status
- [x] SSH dari VS Code Windows ke VM sudah berhasil
- [ ] Hermes terverifikasi (`hermes acp --check`)
- [ ] Ekstensi Hermes terpasang di sisi SSH
- [ ] Repo Git + remote dibuat

## 1. Prasyarat
- VM Linux (Ubuntu/Debian) hidup dan bisa di-ping dari Windows
- OpenSSH server aktif di VM
- VS Code terbaru + ekstensi **Remote - SSH** (Microsoft) di Windows
- Git di VM dan di Windows
- Node.js 20 di VM (untuk `npm install` dan type-check)

## 2. Siapkan SSH di VM
```bash
sudo apt update && sudo apt install -y openssh-server git curl
sudo systemctl enable --now ssh
sudo systemctl status ssh
```
Cek IP: `ip a` (pastikan tetap `192.168.1.103`; sebaiknya set IP statis / DHCP reservation).

## 3. SSH Key dari Windows (PowerShell)
```powershell
ssh-keygen -t ed25519 -C "windows-vscode"
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh USER@192.168.1.103 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
ssh USER@192.168.1.103     # harus masuk tanpa password
```
Ganti `USER` dengan username VM.

## 4. SSH Config (Windows)
Edit `C:\Users\<kamu>\.ssh\config`:
```
Host hermes-vm
    HostName 192.168.1.103
    User USER
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 30
    ServerAliveCountMax 4
```

## 5. Hubungkan VS Code
1. Tekan `F1` → **Remote-SSH: Connect to Host…** → pilih `hermes-vm`
2. Tunggu VS Code Server terpasang di VM
3. **File → Open Folder** → `/home/USER/projects/localstack`

## 6. Install & Cek Hermes di VM
Biasanya sudah terpasang. Verifikasi di terminal VS Code (sudah di dalam VM):
```bash
which hermes
hermes --version
hermes model            # pastikan provider/model sudah dikonfigurasi
hermes acp --check      # cek mode ACP siap
```
Jika belum terpasang, install resmi (periksa dulu di dokumentasi):
```bash
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
```
Config Hermes ada di `~/.hermes/config.yaml`.

## 7. Pasang Ekstensi Hermes di Sisi Remote
Di VS Code (yang sedang terkoneksi SSH), buka Extensions lalu cari salah satu:
- **Hermes Agent for VS Code**
- **ACP Client** / ekstensi ACP lain

Klik **Install in SSH: hermes-vm** (bukan install lokal). Setelah itu:
- Jika `hermes` tidak ditemukan, atur path penuh di setting ekstensi
  (mis. `hermes.cliPath` / `hermes.path` → `/home/USER/.local/bin/hermes`)
- Reload window, lalu pilih **Hermes Agent** di panel agen

## 8. Tes Cepat
Di panel Hermes, kirim: *"Baca README.md dan jelaskan struktur proyek ini."*
Jika berhasil membaca file, integrasi sudah jalan.

## 9. Workflow Harian dengan Windows
**Di VM (Hermes mengedit):**
```bash
cd ~/projects/localstack
git init && git add . && git commit -m "init"
git remote add origin <URL_REPO>   # GitHub/Gitea/GitLab
git push -u origin main
```
**Di Windows (uji aplikasi):**
```powershell
git clone <URL_REPO> C:\dev\localstack
cd C:\dev\localstack
npm install
npm run dev
```
Rutinitas:
1. Hermes coding di VM → commit → `git push`
2. Windows: `git pull` → `npm run dev` → uji
3. Ada error? Salin pesan error / isi `logs/*.log` ke chat Hermes
4. Ulangi

Folder `bin/`, `data/`, `logs/` ada di `.gitignore`. Binary Apache/PHP/MariaDB
Windows hanya perlu di mesin Windows, tidak di VM.

## 10. Troubleshooting
| Masalah | Solusi |
|---|---|
| `Connection timed out` | Cek IP VM, firewall, service `ssh` aktif |
| Selalu diminta password | Izin `~/.ssh` (700) dan `authorized_keys` (600); key belum tersalin |
| `hermes not found` di ekstensi | Set path penuh ke binary; pastikan ekstensi dipasang di sisi SSH |
| Daftar model kosong | Jalankan `hermes model` sekali di VM |
| Agen error saat start | Lihat **Output** panel → channel Hermes/ACP; jalankan `hermes acp --check` |
| VS Code Server gagal terpasang | Pastikan VM punya internet, disk cukup, `curl`/`wget` tersedia |
| Koneksi putus-putus | Tambah `ServerAliveInterval` di SSH config (sudah ada di atas) |

## 11. Keamanan
- Gunakan SSH key, nonaktifkan login password bila sudah stabil
  (`PasswordAuthentication no` di `/etc/ssh/sshd_config`)
- Jangan expose port SSH VM ke internet; cukup jaringan lokal
- Simpan API key provider hanya di VM (`~/.hermes/`), jangan commit ke Git
- Tinjau setiap perubahan/perintah yang diminta persetujuan oleh agen sebelum menyetujui
