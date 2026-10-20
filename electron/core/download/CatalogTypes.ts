import type { RuntimeType } from '../runtimes/RuntimeDefinition.ts'

/** Kanal versi yang diminta saat resolve */
export type VersionChannel = 'stable' | 'lts' | 'latest'

/**
 * Satu entri dalam catalog.json.
 * sha256 opsional — jika tidak ada dari sumber resmi, kolom dihilangkan.
 * url bertanda "TODO_VERIFY:" artinya perlu verifikasi manual sebelum dipakai di Fase 6B.
 */
export interface CatalogEntry {
  type: RuntimeType
  version: string
  channel: VersionChannel
  /** Platform target, selalu "win32" untuk Astra */
  platform: 'win32'
  /** Arsitektur, selalu "x64" untuk Astra */
  arch: 'x64'
  /** URL unduhan — diawali "TODO_VERIFY:" jika belum terverifikasi */
  url: string
  /** Nama folder arsip setelah diekstrak (root pertama di ZIP/tar) */
  archiveRoot?: string
  /** SHA-256 hex dari file arsip; dihilangkan jika tidak tersedia dari sumber resmi */
  sha256?: string
  /** Label tampilan untuk UI */
  label?: string
}

export interface RuntimeCatalog {
  /** Versi skema katalog, saat ini "1" */
  schemaVersion: string
  /** Tanggal terakhir katalog dibuat/diperbarui (ISO 8601) */
  updatedAt: string
  entries: CatalogEntry[]
}

/** Hasil resolusi versi konkret dari resolver */
export interface ResolveResult {
  type: RuntimeType
  channel: VersionChannel
  /** Versi konkret yang diselesaikan, mis. "8.3.16" */
  version: string
  url: string
  archiveRoot?: string
  sha256?: string
  label: string
  /** true = data berasal dari cache, false = sumber langsung */
  fromCache: boolean
  /** true = url belum terverifikasi manual (diawali TODO_VERIFY:) */
  needsManualVerification: boolean
  /** Peringatan non-fatal, mis. "checksum tidak tersedia" */
  warnings: string[]
}

/** Entry cache per type+channel */
export interface CacheEntry {
  type: RuntimeType
  channel: VersionChannel
  result: ResolveResult
  resolvedAt: string // ISO 8601
}

export interface ResolverCache {
  schemaVersion: string
  entries: CacheEntry[]
}

export type DownloadStatus =
  | 'idle'
  | 'resolving'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'done'
  | 'error'
  | 'cancelled'

export interface DownloadJob {
  /** Unique job ID: "<type>-<timestamp>" */
  id: string
  type: RuntimeType
  channel: VersionChannel
  /** Versi konkret yang di-resolve, diisi setelah resolving selesai */
  version?: string
  /** URL arsip yang diunduh */
  url?: string
  status: DownloadStatus
  /** 0–100 */
  progressPercent: number
  bytesReceived: number
  totalBytes: number
  /** Nama file yang disimpan di data/downloads/ */
  archiveFile?: string
  /** Folder tujuan di bin/<folderName>/<destFolder>/ */
  destFolder?: string
  error?: string
  /** Peringatan non-fatal (mis. SHA tidak tersedia) */
  warnings: string[]
  startedAt: string
  finishedAt?: string
}

export interface DownloadProgressEvent {
  id: string
  type: RuntimeType
  status: DownloadStatus
  progressPercent: number
  bytesReceived: number
  totalBytes: number
  version?: string
  error?: string
  warnings: string[]
  destFolder?: string
}
