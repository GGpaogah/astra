import type { ResolveResult, VersionChannel } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

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

export async function resolvePhpLatest(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const response = await fetch(PHP_RELEASES_URL, {
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json() as Record<string, PhpReleaseEntry[]>

    let bestVersion = ''
    let bestEntry: PhpReleaseEntry | null = null

    for (const [, releases] of Object.entries(data)) {
      for (const entry of releases) {
        if (entry.ts === true && entry.arch === 'x64' && typeof entry.version === 'string') {
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

    let url: string
    if (zipPath) {
      const candidate = `https://${ALLOWED_HOST}/${zipPath.replace(/^\//, '')}`
      url = isExpectedHost(candidate) ? candidate : `https://${ALLOWED_HOST}/downloads/releases/php-${bestVersion}-Win32-vs17-x64.zip`
    } else {
      url = `https://${ALLOWED_HOST}/downloads/releases/php-${bestVersion}-Win32-vs17-x64.zip`
      warnings.push('URL PHP tidak dapat dikonstruksi dari releases.json; menggunakan pola URL standar.')
    }

    if (!sha256) {
      warnings.push('SHA-256 tidak tersedia dari windows.php.net untuk versi ini.')
    }

    // Deteksi archiveRoot dari zipPath: ambil nama file ZIP tanpa ekstensi
    const archiveRoot = zipPath
      ? path.basename(zipPath).replace(/\.zip$/i, '')
      : `php-${bestVersion}-Win32-vs17-x64`

    return {
      type: 'php',
      channel,
      version: bestVersion,
      url,
      archiveRoot,
      sha256: sha256 ?? undefined,
      label: `PHP ${bestVersion} (Thread Safe, x64)`,
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver PHP gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('php', channel) ?? findCatalogEntry('php', 'stable')
  if (!entry) {
    throw new Error('Resolver PHP: tidak ada data di sumber resmi maupun katalog lokal.')
  }

  return {
    type: 'php',
    channel,
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

// path diperlukan untuk basename
import path from 'node:path'
