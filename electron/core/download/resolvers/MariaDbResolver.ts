import type { ResolveResult, VersionChannel } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

const API_URL = 'https://downloads.mariadb.org/rest-api/mariadb/'

const ALLOWED_HOSTS = new Set([
  'downloads.mariadb.org',
  'dlm.mariadb.com',
])

interface MariaDbRelease {
  release_status?: string
}

interface MariaDbFile {
  package_type?: string
  cpu?: string
  os?: string
  checksum?: { sha256?: string } | null
  file_download_url?: string
  file_name?: string
}

interface MariaDbApiResponse {
  releases?: Record<string, MariaDbRelease>
}

interface MariaDbFilesResponse {
  files?: MariaDbFile[]
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

export async function resolveMariaDbLts(channel: VersionChannel = 'stable'): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const listResponse = await fetch(API_URL, { signal: AbortSignal.timeout(10000) })
    if (!listResponse.ok) throw new Error(`HTTP ${listResponse.status}`)

    const listData = await listResponse.json() as MariaDbApiResponse
    const releases = listData.releases ?? {}

    let bestVersion = ''
    for (const [releaseId, info] of Object.entries(releases)) {
      if (
        typeof info.release_status === 'string' &&
        info.release_status.toLowerCase().includes('stable')
      ) {
        if (!bestVersion || compareVersionStrings(releaseId, bestVersion) > 0) {
          bestVersion = releaseId
        }
      }
    }

    if (!bestVersion) throw new Error('Tidak ada rilis MariaDB Stable ditemukan via API')

    const filesUrl = `${API_URL}${encodeURIComponent(bestVersion)}/`
    const filesResponse = await fetch(filesUrl, { signal: AbortSignal.timeout(10000) })
    if (!filesResponse.ok) throw new Error(`HTTP ${filesResponse.status} saat mengambil file list`)

    const filesData = await filesResponse.json() as MariaDbFilesResponse
    const files = filesData.files ?? []

    const zipFile = files.find(
      (f) =>
        f.package_type?.toLowerCase() === 'zip' &&
        (f.cpu?.toLowerCase().includes('x86_64') || f.cpu?.toLowerCase().includes('x64')) &&
        f.os?.toLowerCase().includes('windows')
    )

    if (!zipFile?.file_download_url) {
      throw new Error('File ZIP MariaDB Windows x64 tidak ditemukan via API')
    }

    const downloadUrl = zipFile.file_download_url
    if (!isAllowedUrl(downloadUrl)) {
      throw new Error(`URL MariaDB dari API (${downloadUrl}) berada di luar domain yang diizinkan`)
    }

    const sha256 = zipFile.checksum?.sha256 ?? undefined
    if (!sha256) {
      warnings.push('SHA-256 MariaDB tidak tersedia dari API Downloads.')
    }

    const archiveRoot = zipFile.file_name?.replace(/\.(zip|tar\.\w+)$/i, '') ?? `mariadb-${bestVersion}-winx64`

    return {
      type: 'mariadb',
      channel,
      version: bestVersion,
      url: downloadUrl,
      archiveRoot,
      sha256,
      label: `MariaDB ${bestVersion} (x64)`,
      fromCache: false,
      needsManualVerification: false,
      warnings
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
    warnings
  }
}
