import type { ResolveResult } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

/**
 * Resolver sederhana untuk: Nginx, Composer, Python, phpMyAdmin.
 * Masing-masing mencoba sumber resmi, fallback ke katalog lokal.
 * Semua network error menghasilkan fallback, bukan crash.
 */

// ─── Nginx ────────────────────────────────────────────────────────────────────

/**
 * Sumber: https://nginx.org/download/ — daftar file publik tanpa JSON API.
 * Strategi: ambil halaman listing, parse href untuk menemukan versi tertinggi.
 * Ini rapuh (bergantung pada format halaman); tandai sebagai perlu verifikasi manual
 * jika format berubah.
 */
export async function resolveNginxStable(): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const response = await fetch('https://nginx.org/download/', {
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    // Cari semua link nginx-X.Y.Z.zip
    const matches = [...html.matchAll(/href="(nginx-(\d+\.\d+\.\d+)\.zip)"/g)]
    if (matches.length === 0) throw new Error('Tidak ada file nginx-*.zip ditemukan di listing')

    let bestVersion = ''
    let bestFile = ''
    for (const m of matches) {
      const file = m[1]
      const ver = m[2]
      if (!bestVersion || compareVersionStrings(ver, bestVersion) > 0) {
        bestVersion = ver
        bestFile = file
      }
    }

    const url = `https://nginx.org/download/${bestFile}`
    return {
      type: 'nginx',
      channel: 'stable',
      version: bestVersion,
      url,
      archiveRoot: `nginx-${bestVersion}`,
      label: `Nginx ${bestVersion} (Windows)`,
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Nginx gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('nginx', 'stable')
  if (!entry) throw new Error('Resolver Nginx: tidak ada data di sumber maupun katalog.')
  return catalogResult(entry, warnings)
}

// ─── Composer ─────────────────────────────────────────────────────────────────

/**
 * Sumber: https://getcomposer.org/versions
 * Format: { "stable": [{"version": "2.8.5", "min-php": 72, ...}], "preview": [...] }
 */
export async function resolveComposerStable(): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const response = await fetch('https://getcomposer.org/versions', {
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json() as { stable?: Array<{ version?: string }> }
    const version = data.stable?.[0]?.version
    if (!version) throw new Error('Tidak ada versi Composer stable ditemukan')

    const url = `https://getcomposer.org/download/${version}/composer.phar`
    new URL(url) // validasi URL

    return {
      type: 'composer',
      channel: 'stable',
      version,
      url,
      label: `Composer ${version}`,
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Composer gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('composer', 'stable')
  if (!entry) throw new Error('Resolver Composer: tidak ada data di sumber maupun katalog.')
  return catalogResult(entry, warnings)
}

// ─── Python ───────────────────────────────────────────────────────────────────

/**
 * Sumber: https://www.python.org/ftp/python/
 * Strategi: ambil listing FTP, cari versi embeddable Windows x64 terbaru.
 * Tidak ada JSON API resmi untuk embeddable builds — parse HTML listing.
 * Tandai sebagai needsManualVerification karena parsing HTML rapuh.
 */
export async function resolvePythonStable(): Promise<ResolveResult> {
  const warnings: string[] = [
    'Python embeddable build: pip tidak tersedia secara default. Jalankan get-pip.py setelah instalasi (Fase 10).'
  ]

  try {
    const listResponse = await fetch('https://www.python.org/ftp/python/', {
      signal: AbortSignal.timeout(10000)
    })
    if (!listResponse.ok) throw new Error(`HTTP ${listResponse.status}`)

    const html = await listResponse.text()
    const versionMatches = [...html.matchAll(/href="(\d+\.\d+\.\d+)\/"/g)]
    if (versionMatches.length === 0) throw new Error('Tidak ada direktori versi Python ditemukan')

    let bestVersion = ''
    for (const m of versionMatches) {
      const ver = m[1]
      if (!bestVersion || compareVersionStrings(ver, bestVersion) > 0) {
        bestVersion = ver
      }
    }

    const filename = `python-${bestVersion}-embed-amd64.zip`
    const url = `https://www.python.org/ftp/python/${bestVersion}/${filename}`

    // Verifikasi file ini ada (HEAD request)
    try {
      const headResponse = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(8000)
      })
      if (!headResponse.ok) {
        warnings.push(`File ${filename} tidak ditemukan di ftp.python.org; verifikasi manual diperlukan.`)
      }
    } catch {
      warnings.push('Tidak dapat memverifikasi keberadaan file Python; lanjutkan dengan hati-hati.')
    }

    return {
      type: 'python',
      channel: 'stable',
      version: bestVersion,
      url,
      archiveRoot: `python-${bestVersion}-embed-amd64`,
      label: `Python ${bestVersion} Embeddable (x64)`,
      fromCache: false,
      needsManualVerification: true,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Python gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('python', 'stable')
  if (!entry) throw new Error('Resolver Python: tidak ada data di sumber maupun katalog.')
  return catalogResult(entry, warnings)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function catalogResult(
  entry: import('../CatalogTypes.ts').CatalogEntry,
  extraWarnings: string[]
): ResolveResult {
  return {
    type: entry.type,
    channel: entry.channel,
    version: entry.version,
    url: entry.url,
    archiveRoot: entry.archiveRoot,
    sha256: entry.sha256,
    label: entry.label ?? `${entry.type} ${entry.version}`,
    fromCache: false,
    needsManualVerification: entry.url.startsWith('TODO_VERIFY:'),
    warnings: extraWarnings
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
