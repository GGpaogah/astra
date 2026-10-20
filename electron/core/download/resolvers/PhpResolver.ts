import type { ResolveResult, VersionChannel } from '../CatalogTypes.ts'
import { findCatalogEntry } from '../catalog.ts'

const PHP_RELEASES_URL = 'https://windows.php.net/downloads/releases/releases.json'
const PHP_DOWNLOAD_BASE = 'https://windows.php.net/downloads/releases/'

// Channel default: cabang stabil yang masih mendapat update keamanan
const CHANNEL_DEFAULT: VersionChannel = 'stable'

// ── Types matching real API ──────────────────────────────────────────────────

interface PhpReleaseFile {
  zip: { path: string; size: number; sha256: string }
}

interface PhpReleaseVariant {
  version: string
  'ts-vs17-x64'?: PhpReleaseFile
  'nts-vs17-x64'?: PhpReleaseFile
  'ts-vs16-x64'?: PhpReleaseFile
  'nts-vs16-x64'?: PhpReleaseFile
}

// ── Pure parse function (testable without network) ────────────────────────────

/**
 * Parse PHP releases.json and pick the best variant for a channel.
 * Returns null if no matching branch/variant found (caller decides fallback).
 */
export function parsePhpReleases(
  json: Record<string, PhpReleaseVariant>,
  channel: VersionChannel
): { version: string; url: string; archiveRoot: string; sha256: string; label: string; isTS: boolean } | null {
  if (!json || typeof json !== 'object') {
    throw new Error('format API berubah: root bukan object di windows.php.net')
  }

  // 1. Find matching branch
  let branchKey: string | null = null
  const isNts = channel === 'nts'

  if (channel === 'stable' || isNts) {
    // Stable: highest supported branch (e.g., 8.4, 8.3, 8.2...)
    const stableBranches = Object.keys(json)
      .filter((k) => /^\d+\.\d+$/.test(k))
      .sort((a, b) => {
        const [ma, mi] = a.split('.').map(Number)
        const [mb, mib] = b.split('.').map(Number)
        return mb - ma || mib - mi
      })
    branchKey = stableBranches[0] ?? null
  } else if (json[channel]) {
    // Explicit branch like '8.4', '8.3'
    branchKey = channel
  }

  if (!branchKey) return null

  const branch = json[branchKey]
  if (!branch || typeof branch !== 'object' || !branch.version) {
    return null // schema guard: malformed branch
  }

  // 2. Pick variant: prefer VS17, then VS16; TS for stable, NTS for nts channel
  const prefix = isNts ? 'nts-' : 'ts-'
  const vsOrder = ['vs17', 'vs16'] as const
  let variant: PhpReleaseFile | null = null

  for (const vs of vsOrder) {
    const key = `${prefix}${vs}-x64` as const
    const v = branch[key]
    if (v?.zip?.path) {
      variant = v.zip
      break
    }
  }
  if (!variant?.path) return null

  // 3. Build result
  const version = String(branch.version)
  const url = `${PHP_DOWNLOAD_BASE}${variant.path}`
  const sha256 = variant.sha256 ?? ''
  const archiveRoot = variant.path.replace(/\.zip$/i, '')
  const isTS = !isNts
  const label = `PHP ${version} (${isTS ? 'Thread Safe' : 'Non Thread Safe'}, VS17, x64)`

  return { version, url, archiveRoot, sha256, label, isTS }
}

// ── Network fetch with allowlist redirect check ───────────────────────────────

async function fetchPhpReleases(): Promise<Record<string, PhpReleaseVariant>> {
  const res = await fetch(PHP_RELEASES_URL, { redirect: 'manual' })
  if (!res.ok) throw new Error(`PHP releases.json HTTP ${res.status}`)
  return res.json() as Promise<Record<string, PhpReleaseVariant>>
}

export async function resolvePhpLatest(channel: VersionChannel = CHANNEL_DEFAULT): Promise<ResolveResult> {
  const warnings: string[] = []

  try {
    const releases = await fetchPhpReleases()
    const parsed = parsePhpReleases(releases, channel)

    if (!parsed) {
      // Fallback to catalog if parse fails
      const cat = findCatalogEntry('php', channel) ?? findCatalogEntry('php', 'stable')
      if (cat?.url) {
        return {
          type: 'php',
          channel,
          version: cat.version,
          url: cat.url,
          archiveRoot: cat.archiveRoot,
          sha256: cat.sha256,
          label: cat.label ?? `PHP ${cat.version}`,
          fromCache: false,
          needsManualVerification: cat.url.startsWith('TODO_VERIFY:'),
          warnings: [...warnings, `Format API PHP berubah; menggunakan katalog fallback. Channel: ${channel}`],
        }
      }
      throw new Error(`Cabang atau varian PHP untuk channel "${channel}" tidak ditemukan di API dan tidak ada fallback katalog.`)
    }

    return {
      type: 'php',
      channel,
      version: parsed.version,
      url: parsed.url,
      archiveRoot: parsed.archiveRoot,
      sha256: parsed.sha256 || undefined,
      label: parsed.label,
      fromCache: false,
      needsManualVerification: false,
      warnings: parsed.sha256 ? warnings : [...warnings, 'SHA-256 tidak tersedia dari sumber; verifikasi manual disarankan.'],
    }
  } catch (err) {
    warnings.push(`Fetch PHP releases gagal: ${(err as Error).message}. Menggunakan katalog fallback.`)
    const cat = findCatalogEntry('php', channel) ?? findCatalogEntry('php', 'stable')
    if (!cat?.url) throw new Error('Resolver PHP: tidak ada data di sumber maupun katalog.')
    return {
      type: 'php',
      channel,
      version: cat.version,
      url: cat.url,
      archiveRoot: cat.archiveRoot,
      sha256: cat.sha256,
      label: cat.label ?? `PHP ${cat.version}`,
      fromCache: false,
      needsManualVerification: cat.url.startsWith('TODO_VERIFY:'),
      warnings,
    }
  }
}
