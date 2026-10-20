import { ipcMain } from 'electron'
import { serviceManager } from '../core/ServiceManager.ts'

export function registerServicesIpc(): void {
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
}
