import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),

  listServices: () => ipcRenderer.invoke('services:list'),
  startService: (name: string) => ipcRenderer.invoke('services:start', name),
  stopService: (name: string) => ipcRenderer.invoke('services:stop', name),
  restartService: (name: string) => ipcRenderer.invoke('services:restart', name),
  getLogs: (name: string) => ipcRenderer.invoke('services:logs', name),

  onServiceStatus: (callback: (data: { service: string; status: string }) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: { service: string; status: string }) => callback(data)
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
