import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),

  listServices: () => ipcRenderer.invoke('services:list'),
  startService: (name: string) => ipcRenderer.invoke('services:start', name),
  stopService: (name: string) => ipcRenderer.invoke('services:stop', name),
  restartService: (name: string) => ipcRenderer.invoke('services:restart', name),
  startAllServices: () => ipcRenderer.invoke('services:start-all'),
  stopAllServices: () => ipcRenderer.invoke('services:stop-all'),
  getLogs: (name: string) => ipcRenderer.invoke('services:logs', name),

  listPhpVersions: () => ipcRenderer.invoke('php:list'),
  getActivePhpVersion: () => ipcRenderer.invoke('php:get-active'),
  setActivePhpVersion: (version: string) => ipcRenderer.invoke('php:set-active', version),

  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  openPath: (relativePath: string) => ipcRenderer.invoke('app:open-path', relativePath),

  onServiceStatus: (callback: (data: { service: string; status: string; lastError?: string | null }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: { service: string; status: string; lastError?: string | null }) => callback(data)
    ipcRenderer.on('services:status', subscription)
    return () => {
      ipcRenderer.removeListener('services:status', subscription)
    }
  },

  onServiceLog: (callback: (data: { service: string; lines: string[] }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: { service: string; lines: string[] }) => callback(data)
    ipcRenderer.on('services:log', subscription)
    return () => {
      ipcRenderer.removeListener('services:log', subscription)
    }
  }
})
