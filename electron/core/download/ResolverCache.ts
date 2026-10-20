import fs from 'node:fs'
import path from 'node:path'
import { Paths } from '../Paths.ts'
import type { ResolveResult, ResolverCache, CacheEntry } from './CatalogTypes.ts'

const CACHE_FILE = 'resolver-cache.json'
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000  // 4 jam
const MAX_STALE_MS  = 24 * 60 * 60 * 1000  // 24 jam — lebih lama dari ini selalu dianggap usang

function getCachePath(): string {
  return path.join(Paths.data, CACHE_FILE)
}

function readRaw(): ResolverCache {
  const p = getCachePath()
  if (!fs.existsSync(p)) {
    return { schemaVersion: '1', entries: [] }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as ResolverCache
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
      return { schemaVersion: '1', entries: [] }
    }
    return parsed
  } catch {
    return { schemaVersion: '1', entries: [] }
  }
}

function writeRaw(cache: ResolverCache): void {
  if (!fs.existsSync(Paths.data)) {
    fs.mkdirSync(Paths.data, { recursive: true })
  }
  const tmp = `${getCachePath()}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf-8')
  fs.renameSync(tmp, getCachePath())
}

/**
 * Baca hasil resolusi dari cache.
 * @param ttlMs  Batas usia cache yang diterima (default 4 jam).
 * @returns hasil cache beserta flag `fromCache: true`, atau null jika tidak ada / kadaluarsa.
 */
export function readCache(
  type: string,
  channel: string,
  ttlMs = DEFAULT_TTL_MS
): ResolveResult | null {
  const cache = readRaw()
  const entry = cache.entries.find((e) => e.type === type && e.channel === channel)
  if (!entry) return null

  const ageMs = Date.now() - new Date(entry.resolvedAt).getTime()
  if (ageMs > MAX_STALE_MS) return null   // buang entri yang sangat usang
  if (ageMs > ttlMs) {
    // Kembalikan tapi tandai sebagai stale via warning agar caller bisa memutuskan
    return {
      ...entry.result,
      fromCache: true,
      warnings: [
        ...entry.result.warnings,
        `Cache kadaluarsa (${Math.round(ageMs / 3600000)}j > ${ttlMs / 3600000}j TTL). Pertimbangkan refresh.`
      ]
    }
  }

  return { ...entry.result, fromCache: true }
}

/**
 * Simpan hasil resolusi ke cache.
 */
export function writeCache(result: ResolveResult): void {
  const cache = readRaw()
  const now = new Date().toISOString()

  const index = cache.entries.findIndex(
    (e) => e.type === result.type && e.channel === result.channel
  )

  const entry: CacheEntry = {
    type: result.type,
    channel: result.channel,
    result: { ...result, fromCache: false },
    resolvedAt: now
  }

  if (index >= 0) {
    cache.entries[index] = entry
  } else {
    cache.entries.push(entry)
  }

  try {
    writeRaw(cache)
  } catch {
    // Gagal tulis cache adalah non-fatal — resolver tetap mengembalikan hasil
  }
}

/**
 * Hapus semua entri cache untuk type tertentu (dipakai saat user memicu refresh manual).
 */
export function invalidateCache(type?: string): void {
  const cache = readRaw()
  if (type) {
    cache.entries = cache.entries.filter((e) => e.type !== type)
  } else {
    cache.entries = []
  }
  try {
    writeRaw(cache)
  } catch {
    // non-fatal
  }
}
