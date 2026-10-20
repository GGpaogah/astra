import type { ResolveResult } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

/**
 * Sumber: windows.php.net/downloads/releases/releases.json
 * Format: array objek per rilis, field relevan:
 *   version, "ts": true/false, "arch": "x64", "zip": { "path", "sha256" }
 *
 * Catatan Apache: Apache Lounge menerapkan hotlink protection — URL unduhan
 * Apache tidak bisa di-fetch otomatis. Resolver ini hanya menangani PHP.
 *
 * URL dikembalikan dengan prefix "TODO_VERIFY:" untuk semua rilis PHP karena
 * URL pastinya harus diverifikasi manual terhadap windows.php.net sebelum Fase 6B.
 */

const PHP_RELEASES_URL = 'https://windows.php.net/downloads/releases/releases.json'
const ALLOWED_HOST = 'windows.php.net'

interface PhpReleaseEntry {
  version?: string
  ts?: boolean
  arch?: string
  zip?: { path?: string; sha256?: string }
}

function isExpectedHost(url: string): boolean {
  try {
    return new URL(url).hostname === ALLOWED_HOST
  } catch {
    return false
  }
}

export async function resolvePhpLatest(): Promise<ResolveResult> {
  const warnings: string[] = []

  // Coba fetch dari sumber resmi
  try {
    const response = await fetch(PHP_RELEASES_URL, {
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json() as Record<string, PhpReleaseEntry[]>

    // Data adalah objek: { "8.3": [{...}, {...}], "8.2": [...] }
    // Cari rilis TS x64 stabil terbaru
    let bestVersion = ''
    let bestEntry: PhpReleaseEntry | null = null

    for (const [, releases] of Object.entries(data)) {
      for (const entry of releases) {
        if (
          entry.ts === true &&
          entry.arch === 'x64' &&
          typeof entry.version === 'string'
        ) {
          if (!bestVersion || compareVersionStrings(entry.version, bestVersion) > 0) {
            bestVersion = entry.version
            bestEntry = entry
          }
        }
      }
    }

    if (!bestVersion || !bestEntry) {
      throw new Error('Tidak ada rilis PHP TS x64 ditemukan di releases.json')
    }

    const zipPath = bestEntry.zip?.path
    const sha256 = bestEntry.zip?.sha256

    // Path relatif dari windows.php.net — bangun URL lengkap
    let url: string
    if (zipPath && isExpectedHost(`https://${ALLOWED_HOST}/${zipPath}`)) {
      url = `https://${ALLOWED_HOST}/${zipPath.replace(/^\//, '')}`
    } else {
      url = `TODO_VERIFY:https://${ALLOWED_HOST}/downloads/releases/php-${bestVersion}-Win32-vs16-x64.zip`
      warnings.push('URL PHP tidak dapat dikonstruksi dari releases.json; perlu verifikasi manual.')
    }

    if (!sha256) {
      warnings.push('SHA-256 tidak tersedia dari windows.php.net untuk versi ini.')
    }

    // Arsip PHP tidak punya folder pembungkus — isi langsung di root ZIP
    const archiveRoot = `php-${bestVersion}-Win32-vs16-x64`

    return {
      type: 'php',
      channel: 'stable',
      version: bestVersion,
      url,
      archiveRoot,
      sha256: sha256 ?? undefined,
      label: `PHP ${bestVersion} (Thread Safe, VS16, x64)`,
      fromCache: false,
      needsManualVerification: url.startsWith('TODO_VERIFY:'),
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver PHP gagal menghubungi sumber: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  // Fallback ke katalog
  const entry = findCatalogEntry('php', 'stable')
  if (!entry) {
    throw new Error('Resolver PHP: tidak ada data di sumber resmi maupun katalog lokal.')
  }

  return {
    type: 'php',
    channel: 'stable',
    version: entry.version,
    url: entry.url,
    archiveRoot: entry.archiveRoot,
    sha256: entry.sha256,
    label: entry.label ?? `PHP ${entry.version}`,
    fromCache: false,
    needsManualVerification: entry.url.startsWith('TODO_VERIFY:'),
    warnings
  }
}

function compareVersionStrings(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
