import type { ResolveResult, VersionChannel, CatalogEntry } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

const PYTHON_LIST_URL = 'https://www.python.org/ftp/python/'
const REQUEST_TIMEOUT = 15000

const ALLOWED_HOSTS = new Set(['python.org', 'www.python.org'])

// ── Types for pure parse functions ────────────────────────────────────────────

/**
 * Parse Python FTP directory listing HTML — pure, no I/O.
 * Returns sorted version strings (newest first).
 */
export function parsePythonVersionList(html: string): string[] {
  if (!html || typeof html !== 'string') {
    throw new Error('format listing berubah: HTML kosong atau bukan string')
  }
  const matches = [...html.matchAll(/href="(\d+\.\d+\.\d+)(?:[^"]*)?\/"/g)]
  if (matches.length === 0) {
    throw new Error('tidak ada direktori versi Python ditemukan di listing python.org')
  }
  // Filter out pre-release versions (alpha, beta, rc) — only stable releases get embeddable zips
  const versions = matches
    .map(m => m[1])
    .filter(v => !/[aAbBcC]\d/i.test(v))
    .sort((a, b) => compareVersionStrings(b, a))
  if (versions.length === 0) {
    throw new Error('tidak ada versi Python stabil ditemukan di listing (semua versi prereklease)')
  }
  return versions
}

/**
 * Build embeddable URL and verify filename pattern — pure, no I/O.
 * Python embeddable file is: python-{version}-embed-amd64.zip
 */
export function buildPythonEmbeddableUrl(version: string): { url: string; archiveRoot: string; filename: string } {
  const filename = `python-${version}-embed-amd64.zip`
  const url = `https://www.python.org/ftp/python/${version}/${filename}`
  const archiveRoot = `python-${version}-embed-amd64`
  return { url, archiveRoot, filename }
}

function isAllowedUrl(url: string): boolean {
  try {
    const p = new URL(url)
    return p.protocol === 'https:' && ALLOWED_HOSTS.has(p.hostname)
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

// ─── Python ───────────────────────────────────────────────────────────────────

export async function resolvePythonStable(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
  const warnings: string[] = [
    'Python embeddable build: pip tidak tersedia secara default. Jalankan get-pip.py setelah instalasi (Fase 10).',
  ]

  try {
    const listResponse = await fetch(PYTHON_LIST_URL, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    })
    if (!listResponse.ok) throw new Error(`HTTP ${listResponse.status}`)

    const html = await listResponse.text()
    const versions = parsePythonVersionList(html)

    // Verify embeddable zip exists for each version (newest first)
    let selectedVersion = ''
    let selectedUrl = ''
    let selectedArchiveRoot = ''

    for (const version of versions) {
      const { url, archiveRoot, filename } = buildPythonEmbeddableUrl(version)
      if (!isAllowedUrl(url)) continue

      // Check version directory listing for exact embeddable file
      let fileExists = false
      try {
        const dirResponse = await fetch(`https://www.python.org/ftp/python/${version}/`, {
          signal: AbortSignal.timeout(8000)
        })
        if (dirResponse.ok) {
          const dirHtml = await dirResponse.text()
          fileExists = dirHtml.includes(filename)
        }
      } catch { /* ignore */ }

      if (fileExists) {
        selectedVersion = version
        selectedUrl = url
        selectedArchiveRoot = archiveRoot
        break
      } else {
        warnings.push(`Python ${version} tidak memiliki embed-amd64.zip (prerelease), mencoba versi sebelumnya...`)
      }
    }

    if (!selectedVersion) {
      throw new Error('Tidak ada versi Python stabil dengan embed-amd64.zip ditemukan')
    }

    return {
      type: 'python',
      channel,
      version: selectedVersion,
      url: selectedUrl,
      archiveRoot: selectedArchiveRoot,
      label: `Python ${selectedVersion} Embeddable (x64)`,
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Python gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('python', channel) ?? findCatalogEntry('python', 'stable')
  if (!entry) throw new Error('Resolver Python: tidak ada data di sumber maupun katalog.')
  return catalogResult(entry, channel, warnings)
}

// ─── Nginx ────────────────────────────────────────────────────────────────────

const NGINX_LIST_URL = 'https://nginx.org/download/'

export async function resolveNginxStable(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const response = await fetch(NGINX_LIST_URL, {
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const matches = [...html.matchAll(/href="(nginx-(\d+\.\d+\.\d+)\.zip)"/g)]
    if (matches.length === 0) throw new Error('Tidak ada file nginx-*.zip ditemukan di listing')

    let bestVersion = ''
    let bestFile = ''
    for (const m of matches) {
      const ver = m[2]
      if (!bestVersion || compareVersionStrings(ver, bestVersion) > 0) {
        bestVersion = ver
        bestFile = m[1]
      }
    }

    // Fetch SHA256 if available (non-fatal)
    let sha256 = ''
    try {
      const shaResponse = await fetch(`${NGINX_LIST_URL}${bestFile}.sha256`, {
        signal: AbortSignal.timeout(5000)
      })
      if (shaResponse.ok) {
        const shaText = await shaResponse.text()
        const match = shaText.trim().match(/^([a-f0-9]{64})\s+/i)
        if (match) sha256 = match[1].toLowerCase()
      }
    } catch { /* ignore */ }

    return {
      type: 'nginx',
      channel,
      version: bestVersion,
      url: `https://nginx.org/download/${bestFile}`,
      archiveRoot: `nginx-${bestVersion}`,
      sha256: sha256 || undefined,
      label: `Nginx ${bestVersion} (Windows)`,
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Nginx gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('nginx', channel) ?? findCatalogEntry('nginx', 'stable')
  if (!entry) throw new Error('Resolver Nginx: tidak ada data di sumber maupun katalog.')
  return catalogResult(entry, channel, warnings)
}

// ─── Composer ─────────────────────────────────────────────────────────────────

const COMPOSER_VERSIONS_URL = 'https://getcomposer.org/versions'

export async function resolveComposerStable(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const response = await fetch(COMPOSER_VERSIONS_URL, {
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json() as { stable?: Array<{ version?: string }> }
    const version = data.stable?.[0]?.version
    if (!version) throw new Error('Tidak ada versi Composer stable ditemukan')

    const url = `https://getcomposer.org/download/${version}/composer.phar`
    new URL(url) // validasi

    // Fetch SHA256 from .sha256sum file (non-fatal)
    let sha256 = ''
    try {
      const shaUrl = `https://getcomposer.org/download/${version}/composer.phar.sha256sum`
      const shaResponse = await fetch(shaUrl, { signal: AbortSignal.timeout(5000) })
      if (shaResponse.ok) {
        const shaText = await shaResponse.text()
        const match = shaText.trim().match(/^([a-f0-9]{64})\s+/i)
        if (match) sha256 = match[1].toLowerCase()
      }
    } catch { /* ignore */ }

    return {
      type: 'composer',
      channel,
      version,
      url,
      sha256: sha256 || undefined,
      label: `Composer ${version}`,
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Composer gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('composer', channel) ?? findCatalogEntry('composer', 'stable')
  if (!entry) throw new Error('Resolver Composer: tidak ada data di sumber maupun katalog.')
  return catalogResult(entry, channel, warnings)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function catalogResult(
  entry: CatalogEntry,
  channel: VersionChannel,
  extraWarnings: string[]
): ResolveResult {
  return {
    type: entry.type,
    channel,
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
