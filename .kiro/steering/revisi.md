---
inclusion: manual
---

# Revisi & Temuan Aktif

Catatan masalah yang ditemukan saat pengembangan tapi belum diselesaikan.
Muat file ini saat relevan dengan task yang sedang dikerjakan.

---

## [OPEN] phpMyAdmin — 404 Not Found

**Tanggal ditemukan:** 2026-10-20  
**Gejala:** `http://localhost/phpmyadmin` mengembalikan 404.  
**Root cause (terverifikasi):** Folder `www/phpmyadmin/` tidak ada. phpMyAdmin belum pernah ditempatkan di sana.

**Bukan bug kode:**
- `httpd.conf` tidak memerlukan Alias tambahan — `DocumentRoot` sudah `www/`, sehingga subfolder `www/phpmyadmin/` langsung accessible sebagai `/phpmyadmin`.
- `mod_alias` sudah dimuat di template `httpd.conf.tpl`.
- `ConfigGenerator.generatePhpMyAdminConfig()` sudah siap membuat `config.inc.php` (blowfish secret acak) saat folder terdeteksi.

**Tindakan yang dibutuhkan (manual oleh user):**
1. Download phpMyAdmin dari https://www.phpmyadmin.net/downloads/
2. Extract ke `www/phpmyadmin/` sehingga `www/phpmyadmin/index.php` ada
3. Restart Apache dari UI Astra
4. Buka `http://localhost/phpmyadmin`

**Verifikasi:**
```powershell
Test-Path "E:\Project\astra\www\phpmyadmin\index.php"
# harus True sebelum test browser
```

**Catatan Fase 6:** Download Manager (Fase 6B) akan mengotomasi langkah ini.  
phpMyAdmin akan masuk katalog sebagai tool yang bisa diinstall dari UI.  
Jangan implementasikan download otomatis sebelum Fase 6B disetujui.

---
