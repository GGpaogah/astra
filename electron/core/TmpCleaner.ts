import fs from 'node:fs'
import path from 'node:path'
import { Paths } from './Paths.ts'

export interface TmpCleanResult {
  sessionFiles: number
  uploadFiles: number
  totalFiles: number
  totalBytes: number
  /** Ukuran yang dibebaskan dalam format human-readable */
  freedFormatted: string
}

/**
 * Resolusi real path (ikuti symlink) agar HANYA file di dalam tmp/ yang bisa dihapus.
 * Mengembalikan null jika resolusi gagal.
 */
function safeRealPath(p: string): string | null {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Hitung total ukuran semua file (rekursif) di dalam direktori.
 */
function dirSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0
  let total = 0
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isFile()) {
        try { total += fs.statSync(full).size } catch { /* skip */ }
      } else if (entry.isDirectory()) {
        total += dirSize(full)
      }
    }
  } catch { /* skip */ }
  return total
}

export const TmpCleaner = {
  /**
   * Jalankan pembersihan tmp/ — flat ala Laragon.
   *
   * Aturan (hanya file langsung di tmp/, subfolder seperti xdebug/ TIDAK disentuh):
   * - sess_*  : hapus jika lebih tua dari maxSessionAgeDays
   * - file lain (bukan sess_, bukan subfolder): hapus jika lebih tua dari 1 hari
   *
   * Keamanan: realpath-check agar symlink tidak bisa keluar dari tmp/.
   */
  clean(maxSessionAgeDays: number = 7): TmpCleanResult {
    const sessionMaxAgeMs = maxSessionAgeDays * 24 * 60 * 60 * 1000
    const uploadMaxAgeMs = 1 * 24 * 60 * 60 * 1000

    if (!fs.existsSync(Paths.tmp)) {
      return { sessionFiles: 0, uploadFiles: 0, totalFiles: 0, totalBytes: 0, freedFormatted: '0 B' }
    }

    const realTmp = safeRealPath(Paths.tmp)
    if (!realTmp) {
      return { sessionFiles: 0, uploadFiles: 0, totalFiles: 0, totalBytes: 0, freedFormatted: '0 B' }
    }

    let sessionFiles = 0
    let uploadFiles = 0
    let totalBytes = 0
    const now = Date.now()

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(Paths.tmp, { withFileTypes: true })
    } catch {
      return { sessionFiles: 0, uploadFiles: 0, totalFiles: 0, totalBytes: 0, freedFormatted: '0 B' }
    }

    for (const entry of entries) {
      // Hanya hapus file reguler — subfolder (xdebug/, dll) TIDAK disentuh
      if (!entry.isFile()) continue

      const fullPath = path.join(Paths.tmp, entry.name)

      // Keamanan: verifikasi realpath tetap di dalam tmp/
      const realFile = safeRealPath(fullPath)
      if (!realFile) continue
      if (!realFile.startsWith(realTmp + path.sep) && realFile !== realTmp) continue

      let stat: fs.Stats
      try {
        stat = fs.statSync(fullPath)
      } catch {
        continue
      }

      const ageMs = now - stat.mtimeMs
      const isSessFile = entry.name.startsWith('sess_')

      // Tentukan batas usia berdasarkan jenis file
      const maxAge = isSessFile ? sessionMaxAgeMs : uploadMaxAgeMs
      if (ageMs < maxAge) continue

      try {
        fs.unlinkSync(fullPath)
        if (isSessFile) {
          sessionFiles++
        } else {
          uploadFiles++
        }
        totalBytes += stat.size
      } catch {
        // File sedang dipakai atau tidak bisa dihapus — lewati
      }
    }

    const totalFiles = sessionFiles + uploadFiles
    return {
      sessionFiles,
      uploadFiles,
      totalFiles,
      totalBytes,
      freedFormatted: formatBytes(totalBytes)
    }
  },

  /**
   * Hitung ukuran folder tmp/ saat ini (untuk ditampilkan di UI).
   */
  currentSize(): { bytes: number; formatted: string } {
    const bytes = dirSize(Paths.tmp)
    return { bytes, formatted: formatBytes(bytes) }
  }
}
