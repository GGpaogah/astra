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

  // Runtimes API
  listRuntimes: () => ipcRenderer.invoke('runtimes:list'),
  setRuntimeActive: (type: string, folderId: string) => ipcRenderer.invoke('runtimes:set-active', type, folderId),
  refreshRuntimes: () => ipcRenderer.invoke('runtimes:refresh'),
  openRuntimeFolder: (type: string, folderId?: string) => ipcRenderer.invoke('runtimes:open-folder', type, folderId),
  getRuntimePreferences: () => ipcRenderer.invoke('runtimes:get-preferences'),
  setRuntimeAutoRestart: (enabled: boolean) => ipcRenderer.invoke('runtimes:set-auto-restart', enabled),

  // Tmp API
  getTmpSize: () => ipcRenderer.invoke('tmp:size'),
  cleanTmp: () => ipcRenderer.invoke('tmp:clean'),
  listBuiltinTemplates: () => ipcRenderer.invoke('tmp:list-builtin-templates'),
  copyBuiltinTemplate: (name: string) => ipcRenderer.invoke('tmp:copy-builtin-template', name),

  // Catalog / Resolver API
  resolveLatest: (type: string, channel: string, forceRefresh?: boolean) =>
    ipcRenderer.invoke('catalog:resolve-latest', type, channel, forceRefresh),
  getCachedResolution: (type: string, channel: string) =>
    ipcRenderer.invoke('catalog:get-cached', type, channel),
  invalidateResolverCache: (type?: string) =>
    ipcRenderer.invoke('catalog:invalidate-cache', type),
  listCatalog: () => ipcRenderer.invoke('catalog:list'),
  validateDownloadUrl: (url: string) =>
    ipcRenderer.invoke('catalog:validate-url', url),

  // Download API
  startDownload: (type: string, channel: string, forceRefresh?: boolean) =>
    ipcRenderer.invoke('download:start', type, channel, forceRefresh),
  cancelDownload: (type: string) =>
    ipcRenderer.invoke('download:cancel', type),
  getDownloadStatus: () =>
    ipcRenderer.invoke('download:status'),
  deleteRuntimeVersion: (type: string, folderId: string) =>
    ipcRenderer.invoke('download:delete-version', type, folderId),
  onDownloadProgress: (callback: (data: import('./core/download/CatalogTypes.ts').DownloadProgressEvent) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, data: import('./core/download/CatalogTypes.ts').DownloadProgressEvent) => callback(data)
    ipcRenderer.on('download:progress', subscription)
    return () => { ipcRenderer.removeListener('download:progress', subscription) }
  },

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
