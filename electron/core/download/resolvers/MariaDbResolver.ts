import type { ResolveResult } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

/**
 * Sumber: https://downloads.mariadb.org/rest-api/mariadb/
 * Endpoint: ?release_status=Stable&os_type=Windows&cpu_type=x86_64&package_type=ZIP
 *
 * Catatan: struktur respons API MariaDB Downloads perlu diverifikasi manual
 * karena endpoint dan schema-nya dapat berubah. Implementasi ini menggunakan
 * struktur yang umum diketahui — tandai sebagai TODO_VERIFY jika respons tidak sesuai.
 */

const API_URL = 'https://downloads.mariadb.org/rest-api/mariadb/'
const ALLOWED_HOST = 'downloads.mariadb.org'

interface MariaDbRelease {
  release_id?: string
  release_name?: string
  release_status?: string
}

interface MariaDbFile {
  package_type?: string
  cpu?: string
  os?: string
  checksum?: { md5?: string; sha256?: string } | null
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
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && (
      parsed.hostname === ALLOWED_HOST ||
      parsed.hostname.endsWith('.mariadb.org') ||
      parsed.hostname === 'dlm.mariadb.com'
    )
  } catch {
    return false
  }
}

export async function resolveMariaDbLts(): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const listResponse = await fetch(API_URL, {
      signal: AbortSignal.timeout(10000)
    })
    if (!listResponse.ok) throw new Error(`HTTP ${listResponse.status}`)

    const listData = await listResponse.json() as MariaDbApiResponse
    const releases = listData.releases ?? {}

    // Cari versi LTS stabil tertinggi (LTS = versi Mayor dengan dukungan panjang, mis. 11.4.x)
    let bestVersion = ''
    for (const [releaseId, info] of Object.entries(releases)) {
      if (
        typeof info.release_status === 'string' &&
        info.release_status.toLowerCase().includes('stable') &&
        typeof releaseId === 'string'
      ) {
        if (!bestVersion || compareVersionStrings(releaseId, bestVersion) > 0) {
          bestVersion = releaseId
        }
      }
    }

    if (!bestVersion) throw new Error('Tidak ada rilis MariaDB Stable ditemukan via API')

    // Ambil file untuk versi ini
    const filesUrl = `${API_URL}${encodeURIComponent(bestVersion)}/`
    const filesResponse = await fetch(filesUrl, {
      signal: AbortSignal.timeout(10000)
    })
    if (!filesResponse.ok) throw new Error(`HTTP ${filesResponse.status} saat mengambil file list`)

    const filesData = await filesResponse.json() as MariaDbFilesResponse
    const files = filesData.files ?? []

    // Cari ZIP Windows x64
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
      warnings.push(`URL MariaDB dari API (${downloadUrl}) berada di luar domain yang diizinkan; tandai TODO_VERIFY.`)
      const safeUrl = `TODO_VERIFY:${downloadUrl}`
      const archiveName = zipFile.file_name?.replace(/\.(zip|tar\.\w+)$/, '') ?? `mariadb-${bestVersion}-winx64`
      return fallbackWithWarnings(bestVersion, safeUrl, archiveName, warnings)
    }

    const sha256 = zipFile.checksum?.sha256 ?? undefined
    if (!sha256) {
      warnings.push('SHA-256 MariaDB tidak tersedia dari API Downloads.')
    }

    const archiveRoot = zipFile.file_name?.replace(/\.(zip|tar\.\w+)$/, '') ?? `mariadb-${bestVersion}-winx64`

    return {
      type: 'mariadb',
      channel: 'lts',
      version: bestVersion,
      url: downloadUrl,
      archiveRoot,
      sha256,
      label: `MariaDB ${bestVersion} LTS (x64)`,
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver MariaDB gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('mariadb', 'lts')
  if (!entry) {
    throw new Error('Resolver MariaDB: tidak ada data di sumber resmi maupun katalog lokal.')
  }

  return {
    type: 'mariadb',
    channel: 'lts',
    version: entry.version,
    url: entry.url,
    archiveRoot: entry.archiveRoot,
    sha256: entry.sha256,
    label: entry.label ?? `MariaDB ${entry.version} LTS`,
    fromCache: false,
    needsManualVerification: entry.url.startsWith('TODO_VERIFY:'),
    warnings
  }
}

function fallbackWithWarnings(
  version: string,
  url: string,
  archiveRoot: string,
  warnings: string[]
): ResolveResult {
  return {
    type: 'mariadb',
    channel: 'lts',
    version,
    url,
    archiveRoot,
    label: `MariaDB ${version} LTS (x64)`,
    fromCache: false,
    needsManualVerification: true,
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
