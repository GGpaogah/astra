import { ipcMain, shell } from 'electron'
import path from 'node:path'
import { serviceManager } from '../core/ServiceManager.ts'
import { Paths } from '../core/Paths.ts'

export function registerServicesIpc(): void {
  // Service controls
  ipcMain.handle('services:list', () => {
    return serviceManager.list()
  })

  ipcMain.handle('services:start', async (_event, name: unknown) => {
    if (typeof name !== 'string') {
      throw new Error('Service name must be a string')
    }
    const service = serviceManager.get(name)
    if (!service) {
      throw new Error(`Service "${name}" not found`)
    }
    await service.start()
    return service.getStatus()
  })

  ipcMain.handle('services:stop', async (_event, name: unknown) => {
    if (typeof name !== 'string') {
      throw new Error('Service name must be a string')
    }
    const service = serviceManager.get(name)
    if (!service) {
      throw new Error(`Service "${name}" not found`)
    }
    await service.stop()
    return service.getStatus()
  })

  ipcMain.handle('services:restart', async (_event, name: unknown) => {
    if (typeof name !== 'string') {
      throw new Error('Service name must be a string')
    }
    const service = serviceManager.get(name)
    if (!service) {
      throw new Error(`Service "${name}" not found`)
    }
    await service.restart()
    return service.getStatus()
  })

  ipcMain.handle('services:start-all', async () => {
    await serviceManager.startAll()
    return serviceManager.list()
  })

  ipcMain.handle('services:stop-all', async () => {
    await serviceManager.stopAll()
    return serviceManager.list()
  })

  ipcMain.handle('services:logs', (_event, name: unknown) => {
    if (typeof name !== 'string') {
      throw new Error('Service name must be a string')
    }
    const service = serviceManager.get(name)
    if (!service) {
      throw new Error(`Service "${name}" not found`)
    }
    return service.getLogs()
  })

  // Shell & Path opening with strict validation
  ipcMain.handle('app:open-external', async (_event, targetUrl: unknown) => {
    if (typeof targetUrl !== 'string') {
      throw new Error('URL must be a string')
    }

    let parsed: URL
    try {
      parsed = new URL(targetUrl)
    } catch {
      throw new Error('Format URL tidak valid')
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Hanya protokol http/https yang diizinkan')
    }

    if (parsed.hostname !== 'localhost') {
      throw new Error('Hanya hostname "localhost" yang diizinkan untuk dibuka')
    }

    await shell.openExternal(targetUrl)
    return true
  })

  ipcMain.handle('app:open-path', async (_event, relativeOrAbsolutePath: unknown) => {
    if (typeof relativeOrAbsolutePath !== 'string') {
      throw new Error('Path must be a string')
    }

    const resolved = path.resolve(Paths.root, relativeOrAbsolutePath)
    const rel = path.relative(Paths.root, resolved)

    // Pastikan path berada di dalam root proyek (tidak dimulai dengan '..' dan bukan drive lain)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('Akses path di luar folder proyek ditolak demi keamanan')
    }

    await shell.openPath(resolved)
    return true
  })
}
