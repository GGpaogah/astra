import type { ResolveResult, VersionChannel } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

const MARIADB_API_BASE = 'https://downloads.mariadb.org/rest-api/mariadb/'

const ALLOWED_HOSTS = new Set([
  'downloads.mariadb.org',
  'dlm.mariadb.com',
])

interface MariaDbMajorRelease {
  release_id: string
  release_name: string
  release_status: string
  release_support_type: string | null
  release_eol_date: string | null
}

interface MariaDbMajorApiResponse {
  major_releases: MariaDbMajorRelease[]
}

interface MariaDbFile {
  file_id: number
  file_name: string
  package_type: string
  os: string
  cpu: string
  checksum: {
    sha256sum: string
  } | null
  file_download_url: string
}

interface MariaDbFilesResponse {
  releases: Record<string, {
    files: MariaDbFile[]
  }>
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

/**
 * Parse major releases list — pure, no I/O.
 * Returns sorted array of LTS/Stable releases with version strings.
 */
export function parseMariaDbMajorReleases(
  json: unknown,
  channel: VersionChannel
): { version: string; supportType: string | null } | null {
  if (!json || typeof json !== 'object') {
    throw new Error('format API berubah: root bukan object di downloads.mariadb.org')
  }
  const api = json as MariaDbMajorApiResponse
  if (!Array.isArray(api.major_releases)) {
    throw new Error('format API berubah: major_releases bukan array')
  }

  const candidates = api.major_releases.filter(r => {
    if (!r.release_id || !r.release_status) return false
    const status = r.release_status.toLowerCase()
    // Channel mapping: 'stable'/'lts' → LTS or Stable; 'latest' → any Stable
    if (channel === 'stable' || channel === 'lts') {
      return status.includes('stable') && r.release_support_type === 'Long Term Support'
    }
    if (channel === 'latest') {
      return status.includes('stable')
    }
    return false
  })

  if (candidates.length === 0) return null

  // Sort by version descending (newest first)
  candidates.sort((a, b) => compareVersionStrings(b.release_id, a.release_id))

  return {
    version: candidates[0].release_id,
    supportType: candidates[0].release_support_type,
  }
}

/**
 * Parse files list for a specific version — pure, no I/O.
 * Returns winx64 zip file info.
 */
export function parseMariaDbFiles(
  json: unknown,
  version: string
): { url: string; sha256: string; archiveRoot: string } | null {
  if (!json || typeof json !== 'object') {
    throw new Error(`format API berubah: root bukan object untuk MariaDB ${version}`)
  }
  const api = json as MariaDbFilesResponse
  const releaseData = api.releases?.[version]
  if (!releaseData || !Array.isArray(releaseData.files)) {
    throw new Error(`format API berubah: files array tidak ditemukan untuk ${version}`)
  }

  const zipFile = releaseData.files.find(
    (f) =>
      f.package_type?.toLowerCase() === 'zip file' &&
      (f.cpu?.toLowerCase().includes('x86_64') || f.cpu?.toLowerCase().includes('x64')) &&
      f.os?.toLowerCase().includes('windows')
  )

  if (!zipFile?.file_download_url) return null
  if (!isAllowedUrl(zipFile.file_download_url)) return null

  const sha256 = zipFile.checksum?.sha256sum?.toLowerCase() ?? ''
  const archiveRoot = zipFile.file_name?.replace(/\.(zip|tar\.\w+)$/i, '') ?? `mariadb-${version}-winx64`

  return { url: zipFile.file_download_url, sha256, archiveRoot }
}

export async function resolveMariaDbLts(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    // Step 1: Fetch major releases list
    const listResponse = await fetch(MARIADB_API_BASE, { signal: AbortSignal.timeout(10000) })
    if (!listResponse.ok) throw new Error(`HTTP ${listResponse.status}`)
    const listData = await listResponse.json()

    const major = parseMariaDbMajorReleases(listData, channel)
    if (!major) throw new Error(`Tidak ada rilis MariaDB ${channel === 'lts' ? 'LTS' : 'Stable'} ditemukan via API`)

    // Step 2: Fetch files for that version
    const filesUrl = `${MARIADB_API_BASE}${encodeURIComponent(major.version)}/`
    const filesResponse = await fetch(filesUrl, { signal: AbortSignal.timeout(10000) })
    if (!filesResponse.ok) throw new Error(`HTTP ${filesResponse.status} saat mengambil file list`)
    const filesData = await filesResponse.json()

    const parsed = parseMariaDbFiles(filesData, major.version)
    if (!parsed) throw new Error('File ZIP MariaDB Windows x64 tidak ditemukan via API')

    return {
      type: 'mariadb',
      channel,
      version: major.version,
      url: parsed.url,
      archiveRoot: parsed.archiveRoot,
      sha256: parsed.sha256 || undefined,
      label: `MariaDB ${major.version} (x64, ${major.supportType ?? 'Stable'})`,
      fromCache: false,
      needsManualVerification: false,
      warnings: parsed.sha256 ? warnings : [...warnings, 'SHA-256 MariaDB tidak tersedia dari API Downloads.'],
    }
  } catch (err) {
    warnings.push(`Resolver MariaDB gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('mariadb', channel) ?? findCatalogEntry('mariadb', 'stable') ?? findCatalogEntry('mariadb', 'lts')
  if (!entry) {
    throw new Error('Resolver MariaDB: tidak ada data di sumber resmi maupun katalog lokal.')
  }

  return {
    type: 'mariadb',
    channel,
    version: entry.version,
    url: entry.url,
    archiveRoot: entry.archiveRoot,
    sha256: entry.sha256,
    label: entry.label ?? `MariaDB ${entry.version}`,
    fromCache: false,
    needsManualVerification: entry.url.startsWith('TODO_VERIFY:'),
    warnings,
  }
}
