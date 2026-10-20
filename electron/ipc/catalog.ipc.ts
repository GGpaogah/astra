import { ipcMain } from 'electron'
import { isRuntimeType } from '../core/runtimes/RuntimeManager.ts'
import { resolveLatest, getCachedResolution, validateDownloadUrl } from '../core/download/VersionResolver.ts'
import { invalidateCache } from '../core/download/ResolverCache.ts'
import { loadCatalog } from '../core/download/catalog.ts'
import type { VersionChannel } from '../core/download/CatalogTypes.ts'

const VALID_CHANNELS = new Set<VersionChannel>(['stable', 'lts', 'latest'])

function assertChannel(channel: unknown): asserts channel is VersionChannel {
  if (typeof channel !== 'string' || !VALID_CHANNELS.has(channel as VersionChannel)) {
    throw new Error(`Channel "${String(channel)}" tidak valid. Gunakan: stable, lts, atau latest.`)
  }
}

export function registerCatalogIpc(): void {
  /**
   * Resolve versi konkret untuk satu runtime + channel.
   * Tidak memulai download. Gunakan cache jika tersedia dan masih valid.
   */
  ipcMain.handle(
    'catalog:resolve-latest',
    async (_event, type: unknown, channel: unknown, forceRefresh?: unknown) => {
      if (typeof type !== 'string' || !isRuntimeType(type)) {
        throw new Error(`Tipe runtime "${String(type)}" tidak valid`)
      }
      assertChannel(channel)
      const refresh = forceRefresh === true

      return resolveLatest(type, channel, refresh)
    }
  )

  /**
   * Ambil hasil resolve yang sudah di-cache tanpa fetch network.
   * Mengembalikan null jika belum pernah di-resolve.
   */
  ipcMain.handle('catalog:get-cached', (_event, type: unknown, channel: unknown) => {
    if (typeof type !== 'string' || !isRuntimeType(type)) {
      throw new Error(`Tipe runtime "${String(type)}" tidak valid`)
    }
    assertChannel(channel)
    return getCachedResolution(type, channel)
  })

  /**
   * Invalidasi cache untuk satu runtime (atau semua jika type tidak diberikan).
   */
  ipcMain.handle('catalog:invalidate-cache', (_event, type?: unknown) => {
    if (type !== undefined) {
      if (typeof type !== 'string' || !isRuntimeType(type)) {
        throw new Error(`Tipe runtime "${String(type)}" tidak valid`)
      }
      invalidateCache(type)
    } else {
      invalidateCache()
    }
    return true
  })

  /**
   * Kembalikan daftar entri katalog lokal (tanpa fetch network).
   */
  ipcMain.handle('catalog:list', () => {
    const catalog = loadCatalog()
    return catalog.entries
  })

  /**
   * Validasi URL secara eksplisit (dipakai Fase 6B untuk URL kustom Apache).
   * Input: URL string. Return: { valid, reason? }
   */
  ipcMain.handle('catalog:validate-url', (_event, url: unknown) => {
    if (typeof url !== 'string') {
      throw new Error('url harus berupa string')
    }
    return validateDownloadUrl(url)
  })
}
