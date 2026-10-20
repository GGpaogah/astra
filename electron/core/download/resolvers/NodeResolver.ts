import type { ResolveResult } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

/**
 * Sumber: https://nodejs.org/dist/index.json
 * Filter: lts !== false, files includes "win-x64-zip"
 * SHA-256 tersedia via SHASUMS256.txt di folder versi.
 */

const INDEX_URL = 'https://nodejs.org/dist/index.json'
const ALLOWED_HOST = 'nodejs.org'

interface NodeRelease {
  version?: string   // mis. "v20.19.0"
  lts?: string | false
  files?: string[]
}

function isExpectedHost(url: string): boolean {
  try {
    return new URL(url).hostname === ALLOWED_HOST
  } catch {
    return false
  }
}

export async function resolveNodeLts(): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const response = await fetch(INDEX_URL, {
      signal: AbortSignal.timeout(10000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const releases = await response.json() as NodeRelease[]

    // Ambil versi LTS terbaru dengan file win-x64-zip
    const ltsRelease = releases.find(
      (r) => r.lts !== false && r.lts && r.files?.includes('win-x64-zip') && typeof r.version === 'string'
    )

    if (!ltsRelease?.version) {
      throw new Error('Tidak ada rilis Node.js LTS win-x64 ditemukan')
    }

    const version = ltsRelease.version.replace(/^v/, '')
    const tag = ltsRelease.version // mis. "v20.19.0"
    const filename = `node-${tag}-win-x64.zip`
    const baseUrl = `https://${ALLOWED_HOST}/dist/${tag}/${filename}`

    if (!isExpectedHost(baseUrl)) {
      throw new Error('URL Node.js tidak sesuai host yang diizinkan')
    }

    // Ambil SHA-256 dari SHASUMS256.txt
    let sha256: string | undefined
    try {
      const shaResponse = await fetch(`https://${ALLOWED_HOST}/dist/${tag}/SHASUMS256.txt`, {
        signal: AbortSignal.timeout(8000)
      })
      if (shaResponse.ok) {
        const shaText = await shaResponse.text()
        const match = shaText.split('\n').find((line) => line.includes(filename))
        if (match) {
          sha256 = match.trim().split(/\s+/)[0]
        }
      }
    } catch {
      warnings.push('Tidak dapat mengambil SHASUMS256.txt dari nodejs.org.')
    }

    if (!sha256) {
      warnings.push('SHA-256 Node.js tidak tersedia; verifikasi manual diperlukan sebelum instalasi.')
    }

    return {
      type: 'node',
      channel: 'lts',
      version,
      url: baseUrl,
      archiveRoot: `node-${tag}-win-x64`,
      sha256,
      label: `Node.js ${version} LTS (x64)`,
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Node.js gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('node', 'lts')
  if (!entry) {
    throw new Error('Resolver Node.js: tidak ada data di sumber resmi maupun katalog lokal.')
  }

  return {
    type: 'node',
    channel: 'lts',
    version: entry.version,
    url: entry.url,
    archiveRoot: entry.archiveRoot,
    sha256: entry.sha256,
    label: entry.label ?? `Node.js ${entry.version} LTS`,
    fromCache: false,
    needsManualVerification: entry.url.startsWith('TODO_VERIFY:'),
    warnings
  }
}
