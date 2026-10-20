import { ipcMain } from 'electron'
import { downloadManager } from '../core/download/DownloadManager.ts'
import { isRuntimeType } from '../core/runtimes/RuntimeManager.ts'
import type { VersionChannel } from '../core/download/CatalogTypes.ts'
import { RuntimeManager } from '../core/runtimes/RuntimeManager.ts'
import { serviceManager } from '../core/ServiceManager.ts'

const VALID_CHANNELS = new Set<VersionChannel>(['stable', 'lts', 'latest'])

function assertChannel(channel: unknown): asserts channel is VersionChannel {
  if (typeof channel !== 'string' || !VALID_CHANNELS.has(channel as VersionChannel)) {
    throw new Error(`Channel "${String(channel)}" tidak valid. Gunakan: stable, lts, atau latest.`)
  }
}

export function registerDownloadIpc(): void {
  /**
   * Mulai download + ekstraksi runtime.
   * Tidak mengganti versi aktif secara otomatis.
   * Return: job id.
   */
  ipcMain.handle('download:start', async (_event, type: unknown, channel: unknown, forceRefresh?: unknown) => {
    if (typeof type !== 'string' || !isRuntimeType(type)) {
      throw new Error(`Tipe runtime "${String(type)}" tidak valid`)
    }
    assertChannel(channel)
    const refresh = forceRefresh === true
    return downloadManager.start(type, channel, refresh)
  })

  /**
   * Batalkan download aktif untuk runtime tertentu.
   */
  ipcMain.handle('download:cancel', (_event, type: unknown) => {
    if (typeof type !== 'string' || !isRuntimeType(type)) {
      throw new Error(`Tipe runtime "${String(type)}" tidak valid`)
    }
    return downloadManager.cancel(type)
  })

  /**
   * Kembalikan status semua job (aktif maupun selesai di sesi ini).
   */
  ipcMain.handle('download:status', () => {
    return downloadManager.listJobs()
  })

  /**
   * Hapus satu versi runtime dari bin/.
   * Validasi: tidak boleh menghapus versi aktif atau versi yang dipakai service yang berjalan.
   */
  ipcMain.handle('download:delete-version', (_event, type: unknown, folderId: unknown) => {
    if (typeof type !== 'string' || !isRuntimeType(type)) {
      throw new Error(`Tipe runtime "${String(type)}" tidak valid`)
    }
    if (typeof folderId !== 'string' || !folderId.trim()) {
      throw new Error('folderId harus berupa string non-kosong')
    }

    // Cegah hapus versi aktif
    const active = RuntimeManager.getActive(type)
    if (active?.folderId === folderId) {
      throw new Error(
        `Tidak dapat menghapus versi aktif "${folderId}". Pilih versi lain sebagai aktif terlebih dahulu.`
      )
    }

    // Cegah hapus saat service terkait sedang berjalan
    const relatedService = type === 'php' || type === 'apache' ? 'apache'
      : type === 'mariadb' ? 'mariadb'
      : null
    if (relatedService) {
      const svc = serviceManager.get(relatedService)
      if (svc?.getStatus() === 'running') {
        throw new Error(
          `Service ${relatedService} sedang berjalan. Hentikan service sebelum menghapus versi runtime.`
        )
      }
    }

    downloadManager.deleteVersion(type, folderId)
    return true
  })
}
