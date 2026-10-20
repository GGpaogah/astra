import type { ResolveResult, VersionChannel, CatalogEntry } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

// ─── Nginx ────────────────────────────────────────────────────────────────────

export async function resolveNginxStable(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const response = await fetch('https://nginx.org/download/', {
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

    return {
      type: 'nginx',
      channel,
      version: bestVersion,
      url: `https://nginx.org/download/${bestFile}`,
      archiveRoot: `nginx-${bestVersion}`,
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

export async function resolveComposerStable(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
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
    new URL(url) // validasi

    return {
      type: 'composer',
      channel,
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

  const entry = findCatalogEntry('composer', channel) ?? findCatalogEntry('composer', 'stable')
  if (!entry) throw new Error('Resolver Composer: tidak ada data di sumber maupun katalog.')
  return catalogResult(entry, channel, warnings)
}

// ─── Python ───────────────────────────────────────────────────────────────────

export async function resolvePythonStable(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
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
      if (!bestVersion || compareVersionStrings(ver, bestVersion) > 0) bestVersion = ver
    }

    const filename = `python-${bestVersion}-embed-amd64.zip`
    const url = `https://www.python.org/ftp/python/${bestVersion}/${filename}`

    // Verifikasi file ada via HEAD
    let fileVerified = false
    try {
      const headRes = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) })
      fileVerified = headRes.ok
    } catch { /* non-fatal */ }

    if (!fileVerified) {
      warnings.push(`File ${filename} tidak dapat diverifikasi keberadaannya di python.org; lanjutkan dengan hati-hati.`)
    }

    return {
      type: 'python',
      channel,
      version: bestVersion,
      url,
      archiveRoot: `python-${bestVersion}-embed-amd64`,
      label: `Python ${bestVersion} Embeddable (x64)`,
      fromCache: false,
      needsManualVerification: false,  // URL dari domain resmi python.org — tidak perlu manual
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Python gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('python', channel) ?? findCatalogEntry('python', 'stable')
  if (!entry) throw new Error('Resolver Python: tidak ada data di sumber maupun katalog.')
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
