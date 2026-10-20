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

/**
 * Hapus file lama di satu direktori dengan filter nama dan usia.
 * HANYA menghapus file langsung di `dir` (tidak rekursif ke subfolder).
 * Cek realpath sebelum hapus untuk mencegah symlink traversal.
 */
function cleanDir(
  dir: string,
  guardDir: string,
  maxAgeMs: number,
  fileFilter: (name: string) => boolean
): { count: number; bytes: number } {
  let count = 0
  let bytes = 0

  if (!fs.existsSync(dir)) return { count, bytes }

  const now = Date.now()
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return { count, bytes }
  }

  const realGuard = safeRealPath(guardDir)
  if (!realGuard) return { count, bytes }

  for (const entry of entries) {
    // Hanya hapus file reguler (bukan subfolder)
    if (!entry.isFile()) continue
    if (!fileFilter(entry.name)) continue

    const fullPath = path.join(dir, entry.name)

    // Keamanan: verifikasi realpath tetap di dalam guardDir
    const realFile = safeRealPath(fullPath)
    if (!realFile) continue
    if (!realFile.startsWith(realGuard + path.sep) && realFile !== realGuard) continue

    let stat: fs.Stats
    try {
      stat = fs.statSync(fullPath)
    } catch {
      continue
    }

    const ageMs = now - stat.mtimeMs
    if (ageMs < maxAgeMs) continue

    try {
      fs.unlinkSync(fullPath)
      count++
      bytes += stat.size
    } catch {
      // Abaikan file yang gagal dihapus (misalnya sedang dipakai)
    }
  }

  return { count, bytes }
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
        try {
          total += fs.statSync(full).size
        } catch { /* skip */ }
      } else if (entry.isDirectory()) {
        total += dirSize(full)
      }
    }
  } catch { /* skip */ }
  return total
}

export const TmpCleaner = {
  /**
   * Jalankan pembersihan tmp/.
   * - Hapus sess_* yang lebih tua dari maxSessionAgeDays
   * - Hapus file upload yang lebih tua dari 1 hari
   * Tidak menyentuh subfolder di luar tmpSessions dan tmpUploads.
   */
  clean(maxSessionAgeDays: number = 7): TmpCleanResult {
    const sessionMaxAgeMs = maxSessionAgeDays * 24 * 60 * 60 * 1000
    const uploadMaxAgeMs = 1 * 24 * 60 * 60 * 1000 // selalu 1 hari

    // Pastikan guard path adalah Paths.tmp (symlink-resolved)
    const realTmp = safeRealPath(Paths.tmp)
    if (!realTmp) {
      return { sessionFiles: 0, uploadFiles: 0, totalFiles: 0, totalBytes: 0, freedFormatted: '0 B' }
    }

    // Hapus session files (prefix sess_)
    const sessionResult = cleanDir(
      Paths.tmpSessions,
      realTmp,
      sessionMaxAgeMs,
      (name) => name.startsWith('sess_')
    )

    // Hapus semua file upload (semua nama)
    const uploadResult = cleanDir(
      Paths.tmpUploads,
      realTmp,
      uploadMaxAgeMs,
      () => true
    )

    const totalFiles = sessionResult.count + uploadResult.count
    const totalBytes = sessionResult.bytes + uploadResult.bytes

    return {
      sessionFiles: sessionResult.count,
      uploadFiles: uploadResult.count,
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
