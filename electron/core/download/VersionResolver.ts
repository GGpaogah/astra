import type { ResolveResult, VersionChannel } from './CatalogTypes.ts'
import type { RuntimeType } from '../runtimes/RuntimeDefinition.ts'
import { readCache, writeCache } from './ResolverCache.ts'
import { findCatalogEntry } from './catalog.ts'
import { resolvePhpLatest } from './resolvers/PhpResolver.ts'
import { resolveNodeLts } from './resolvers/NodeResolver.ts'
import { resolveMariaDbLts } from './resolvers/MariaDbResolver.ts'
import {
  resolveNginxStable,
  resolveComposerStable,
  resolvePythonStable
} from './resolvers/SimpleResolvers.ts'

/** Domain yang diizinkan untuk URL unduhan runtime */
const ALLOWED_DOMAINS = new Set([
  'windows.php.net',
  'downloads.php.net',          // arsip rilis PHP (termasuk ~windows/releases/archives/)
  'nodejs.org',
  'downloads.mariadb.org',
  'dlm.mariadb.com',
  'nginx.org',
  'getcomposer.org',
  'www.python.org',
  'files.phpmyadmin.net',
  'www.phpmyadmin.net',
  'files.apachelounge.com',
  'www.apachelounge.com',
  'apachelounge.com',
  'get.enterprisedb.com',       // PostgreSQL binaries
])

/**
 * Validasi URL akhir sebelum dikembalikan ke caller.
 * URL dengan prefix TODO_VERIFY: dikecualikan dari validasi domain (sudah ditandai manual).
 */
export function validateDownloadUrl(url: string): { valid: boolean; reason?: string } {
  if (url.startsWith('TODO_VERIFY:')) {
    return { valid: true } // Tandai valid tapi needsManualVerification = true
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { valid: false, reason: 'URL tidak valid' }
  }
  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Hanya HTTPS yang diizinkan' }
  }
  if (!ALLOWED_DOMAINS.has(parsed.hostname)) {
    return { valid: false, reason: `Domain "${parsed.hostname}" tidak ada dalam allowlist` }
  }
  return { valid: true }
}

/**
 * Resolve versi konkret untuk runtime + channel.
 *
 * Urutan:
 * 1. Cache (jika masih dalam TTL)
 * 2. Resolver per runtime (fetch sumber resmi)
 * 3. Fallback katalog lokal
 *
 * @param forceRefresh  Abaikan cache dan fetch ulang dari sumber
 */
export async function resolveLatest(
  type: RuntimeType,
  channel: VersionChannel = 'stable',
  forceRefresh = false
): Promise<ResolveResult> {
  // 1. Cek cache
  if (!forceRefresh) {
    const cached = readCache(type, channel)
    if (cached) return cached
  }

  // 2. Resolve dari sumber
  let result: ResolveResult
  try {
    result = await dispatchResolver(type, channel)
  } catch (err) {
    // Resolver gagal total — coba katalog sebagai last resort
    const entry = findCatalogEntry(type, channel)
    if (!entry) {
      throw new Error(
        `Tidak dapat me-resolve versi ${type} (${channel}): ${(err as Error).message}. Tidak ada fallback katalog.`
      )
    }
    result = {
      type,
      channel,
      version: entry.version,
      url: entry.url,
      archiveRoot: entry.archiveRoot,
      sha256: entry.sha256,
      label: entry.label ?? `${type} ${entry.version}`,
      fromCache: false,
      needsManualVerification: entry.url.startsWith('TODO_VERIFY:'),
      warnings: [`Resolver gagal: ${(err as Error).message}. Menggunakan katalog fallback.`]
    }
  }

  // 3. Validasi URL hasil resolve
  const urlCheck = validateDownloadUrl(result.url)
  if (!urlCheck.valid) {
    throw new Error(`URL tidak valid dari resolver ${type}: ${urlCheck.reason} — "${result.url}"`)
  }

  // 4. Simpan ke cache (hanya jika bukan dari katalog stale)
  try {
    writeCache(result)
  } catch {
    // non-fatal
  }

  return result
}

/**
 * Ambil versi yang tersimpan dari cache tanpa fetch.
 * Berguna untuk UI yang hanya perlu menampilkan info tanpa menunggu network.
 */
export function getCachedResolution(
  type: RuntimeType,
  channel: VersionChannel = 'stable'
): ResolveResult | null {
  return readCache(type, channel, Infinity) // Infinity = abaikan TTL, ambil apapun ada
}

async function dispatchResolver(
  type: RuntimeType,
  channel: VersionChannel
): Promise<ResolveResult> {
  switch (type) {
    case 'php':
      return resolvePhpLatest(channel)

    case 'node':
      return resolveNodeLts(channel)

    case 'mariadb':
      return resolveMariaDbLts(channel)

    case 'nginx':
      return resolveNginxStable(channel)

    case 'composer':
      return resolveComposerStable(channel)

    case 'python':
      return resolvePythonStable(channel)

    case 'apache':
      // Apache Lounge menerapkan hotlink protection — tidak bisa di-resolve otomatis.
      return resolveFallbackOnly(type, channel, [
        'Apache Lounge menerapkan hotlink protection. URL unduhan harus diisi manual di Settings atau diverifikasi sebelum instalasi.'
      ])

    case 'postgresql':
      // Resolver PostgreSQL direncanakan di Fase 8B.
      return resolveFallbackOnly(type, channel, [
        'Resolver PostgreSQL belum diimplementasikan (dijadwalkan Fase 8B). Menggunakan katalog jika tersedia.'
      ])

    default: {
      const _exhaustive: never = type
      throw new Error(`Tidak ada resolver untuk runtime "${String(_exhaustive)}"`)
    }
  }
}

async function resolveFallbackOnly(
  type: RuntimeType,
  channel: VersionChannel,
  extraWarnings: string[]
): Promise<ResolveResult> {
  const entry = findCatalogEntry(type, channel)
  if (!entry) {
    throw new Error(
      `Tidak ada resolver aktif dan tidak ada katalog fallback untuk ${type} (${channel}).`
    )
  }
  return {
    type,
    channel,
    version: entry.version,
    url: entry.url,
    archiveRoot: entry.archiveRoot,
    sha256: entry.sha256,
    label: entry.label ?? `${type} ${entry.version}`,
    fromCache: false,
    needsManualVerification: entry.url.startsWith('TODO_VERIFY:'),
    warnings: extraWarnings
  }
}
