import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { fileURLToPath } from 'node:url'
import type { RuntimeCatalog, CatalogEntry } from './CatalogTypes.ts'
import { isRuntimeType } from '../runtimes/RuntimeManager.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Lokasi catalog.json:
 * - Dev: <root>/catalog/catalog.json
 * - Packaged: process.resourcesPath/catalog/catalog.json (via extraResources)
 */
function getCatalogPath(): string {
  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, 'catalog', 'catalog.json')
  }
  // dist-electron/main.js -> satu level ke atas = root proyek
  const oneUp = path.resolve(__dirname, '..')
  const twoUp = path.resolve(__dirname, '..', '..')
  const threeUp = path.resolve(__dirname, '..', '..', '..')

  for (const dir of [oneUp, twoUp, threeUp]) {
    const candidate = path.join(dir, 'catalog', 'catalog.json')
    if (fs.existsSync(candidate)) return candidate
  }
  return path.join(threeUp, 'catalog', 'catalog.json')
}

const REQUIRED_ENTRY_FIELDS: Array<keyof CatalogEntry> = ['type', 'version', 'channel', 'platform', 'arch', 'url']

function validateEntry(entry: unknown, index: number): entry is CatalogEntry {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`Katalog: entries[${index}] bukan objek`)
  }
  const e = entry as Record<string, unknown>
  for (const field of REQUIRED_ENTRY_FIELDS) {
    if (typeof e[field] !== 'string' || !(e[field] as string).trim()) {
      throw new Error(`Katalog: entries[${index}].${field} wajib berupa string non-kosong`)
    }
  }
  if (!isRuntimeType(e['type'] as string)) {
    throw new Error(`Katalog: entries[${index}].type "${e['type']}" tidak dikenal`)
  }
  const validChannels = ['stable', 'lts', 'latest']
  if (!validChannels.includes(e['channel'] as string)) {
    throw new Error(`Katalog: entries[${index}].channel harus salah satu dari ${validChannels.join(', ')}`)
  }
  if (e['platform'] !== 'win32') {
    throw new Error(`Katalog: entries[${index}].platform harus "win32"`)
  }
  if (e['arch'] !== 'x64') {
    throw new Error(`Katalog: entries[${index}].arch harus "x64"`)
  }
  // Validasi URL: harus HTTPS atau diawali TODO_VERIFY:
  const url = e['url'] as string
  if (!url.startsWith('TODO_VERIFY:') && !url.startsWith('https://')) {
    throw new Error(`Katalog: entries[${index}].url harus HTTPS atau diawali "TODO_VERIFY:"`)
  }
  return true
}

function validateCatalog(raw: unknown): RuntimeCatalog {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Katalog: file bukan objek JSON yang valid')
  }
  const obj = raw as Record<string, unknown>
  if (typeof obj['schemaVersion'] !== 'string') {
    throw new Error('Katalog: schemaVersion wajib berupa string')
  }
  if (!Array.isArray(obj['entries'])) {
    throw new Error('Katalog: entries wajib berupa array')
  }
  for (let i = 0; i < (obj['entries'] as unknown[]).length; i++) {
    validateEntry((obj['entries'] as unknown[])[i], i)
  }
  return raw as RuntimeCatalog
}

let _cache: RuntimeCatalog | null = null

/**
 * Muat dan validasi catalog.json.
 * Hasil di-cache in-memory selama proses berjalan.
 * Lempar Error jika file tidak ada, rusak, atau schema tidak valid.
 */
export function loadCatalog(forceReload = false): RuntimeCatalog {
  if (_cache && !forceReload) return _cache

  const catalogPath = getCatalogPath()
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`Katalog runtime tidak ditemukan di: ${catalogPath}`)
  }

  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'))
  } catch (err) {
    throw new Error(`Katalog tidak bisa dibaca: ${(err as Error).message}`)
  }

  _cache = validateCatalog(raw)
  return _cache
}

/**
 * Cari entri katalog untuk type + channel tertentu.
 * Mengembalikan entri versi tertinggi yang cocok, atau null jika tidak ada.
 */
export function findCatalogEntry(
  type: string,
  channel: string
): CatalogEntry | null {
  let catalog: RuntimeCatalog
  try {
    catalog = loadCatalog()
  } catch {
    return null
  }

  const matches = catalog.entries.filter(
    (e) => e.type === type && e.channel === channel
  )
  if (matches.length === 0) return null

  // Kembalikan versi tertinggi berdasarkan perbandingan semver sederhana
  return matches.reduce((best, current) => {
    return compareVersionStrings(current.version, best.version) > 0 ? current : best
  })
}

function compareVersionStrings(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}
