import type { ResolveResult, VersionChannel } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

const INDEX_URL = 'https://nodejs.org/dist/index.json'
const ALLOWED_HOST = 'nodejs.org'

interface NodeRelease {
  version?: string
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

export async function resolveNodeLts(channel: VersionChannel = 'lts'): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const response = await fetch(INDEX_URL, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const releases = await response.json() as NodeRelease[]

    // channel 'lts' → ambil yang ber-LTS, channel lain → ambil terbaru apapun
    const wantLts = channel === 'lts'
    const candidate = releases.find(
      (r) => (!wantLts || (r.lts !== false && r.lts)) &&
             r.files?.includes('win-x64-zip') &&
             typeof r.version === 'string'
    )

    if (!candidate?.version) {
      throw new Error(`Tidak ada rilis Node.js ${wantLts ? 'LTS' : ''} win-x64 ditemukan`)
    }

    const version = candidate.version.replace(/^v/, '')
    const tag = candidate.version
    const filename = `node-${tag}-win-x64.zip`
    const baseUrl = `https://${ALLOWED_HOST}/dist/${tag}/${filename}`

    if (!isExpectedHost(baseUrl)) throw new Error('URL Node.js tidak sesuai host yang diizinkan')

    let sha256: string | undefined
    try {
      const shaRes = await fetch(`https://${ALLOWED_HOST}/dist/${tag}/SHASUMS256.txt`, {
        signal: AbortSignal.timeout(8000)
      })
      if (shaRes.ok) {
        const shaText = await shaRes.text()
        const match = shaText.split('\n').find((line) => line.includes(filename))
        if (match) sha256 = match.trim().split(/\s+/)[0]
      }
    } catch {
      warnings.push('Tidak dapat mengambil SHASUMS256.txt dari nodejs.org.')
    }

    if (!sha256) {
      warnings.push('SHA-256 Node.js tidak tersedia; verifikasi manual diperlukan sebelum instalasi.')
    }

    return {
      type: 'node',
      channel,
      version,
      url: baseUrl,
      archiveRoot: `node-${tag}-win-x64`,
      sha256,
      label: `Node.js ${version} ${wantLts ? 'LTS' : ''} (x64)`.trim(),
      fromCache: false,
      needsManualVerification: false,
      warnings
    }
  } catch (err) {
    warnings.push(`Resolver Node.js gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
  }

  const entry = findCatalogEntry('node', channel) ?? findCatalogEntry('node', 'lts') ?? findCatalogEntry('node', 'stable')
  if (!entry) {
    throw new Error('Resolver Node.js: tidak ada data di sumber resmi maupun katalog lokal.')
  }

  return {
    type: 'node',
    channel,
    version: entry.version,
    url: entry.url,
    archiveRoot: entry.archiveRoot,
    sha256: entry.sha256,
    label: entry.label ?? `Node.js ${entry.version}`,
    fromCache: false,
    needsManualVerification: entry.url.startsWith('TODO_VERIFY:'),
    warnings
  }
}
