export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export interface ServiceInfo {
  name: string
  port: number
  status: ServiceStatus
  lastError?: string | null
}

export interface ServiceLogEvent {
  service: string
  lines: string[]
}

export interface ServiceStatusEvent {
  service: string
  status: ServiceStatus
  lastError?: string | null
}

export type RuntimeType =
  | 'php'
  | 'apache'
  | 'nginx'
  | 'mariadb'
  | 'postgresql'
  | 'node'
  | 'python'
  | 'composer'

export interface RuntimeVersionInfo {
  type: RuntimeType
  folderId: string
  versionNumber: string
  label: string
  path: string
  executablePath: string
  isLegacy: boolean
  isValid: boolean
  invalidReason?: string
  selectionWarning?: string
  isThreadSafe?: boolean
  isNtsHint?: boolean
  apacheModulePath?: string | null
  envPaths: string[]
}

export interface RuntimeGroupInfo {
  type: RuntimeType
  name: string
  folderName: string
  versions: RuntimeVersionInfo[]
  active: RuntimeVersionInfo | null
}

export interface RuntimeSetResult {
  active: RuntimeVersionInfo
  restarted: boolean
  restartRequired?: string | null
  message?: string | null
}

export interface RuntimePreferences {
  autoRestartOnRuntimeChange: boolean
}

export interface TmpSizeResult {
  bytes: number
  formatted: string
}

export interface TmpCleanResult {
  sessionFiles: number
  uploadFiles: number
  totalFiles: number
  totalBytes: number
  freedFormatted: string
}

export interface CopyTemplateResult {
  name: string
  copied: boolean
  alreadyExists: boolean
}

export type VersionChannel = 'stable' | 'lts' | 'latest'

export interface CatalogEntry {
  type: RuntimeType
  version: string
  channel: VersionChannel
  platform: 'win32'
  arch: 'x64'
  url: string
  archiveRoot?: string
  sha256?: string
  label?: string
}

export interface ResolveResult {
  type: RuntimeType
  channel: VersionChannel
  version: string
  url: string
  archiveRoot?: string
  sha256?: string
  label: string
  fromCache: boolean
  needsManualVerification: boolean
  warnings: string[]
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
  id: string
  type: RuntimeType
  channel: VersionChannel
  version?: string
  url?: string
  status: DownloadStatus
  progressPercent: number
  bytesReceived: number
  totalBytes: number
  archiveFile?: string
  destFolder?: string
  error?: string
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

export interface AstraApi {
  ping: () => Promise<string>
  listServices: () => Promise<ServiceInfo[]>
  startService: (name: string) => Promise<ServiceStatus>
  stopService: (name: string) => Promise<ServiceStatus>
  restartService: (name: string) => Promise<ServiceStatus>
  startAllServices: () => Promise<ServiceInfo[]>
  stopAllServices: () => Promise<ServiceInfo[]>
  getLogs: (name: string) => Promise<string[]>

  // Runtimes API
  listRuntimes: () => Promise<RuntimeGroupInfo[]>
  setRuntimeActive: (type: string, folderId: string) => Promise<RuntimeSetResult>
  refreshRuntimes: () => Promise<RuntimeGroupInfo[]>
  openRuntimeFolder: (type: string, folderId?: string) => Promise<boolean>
  getRuntimePreferences: () => Promise<RuntimePreferences>
  setRuntimeAutoRestart: (enabled: boolean) => Promise<RuntimePreferences>

  // Tmp API
  getTmpSize: () => Promise<TmpSizeResult>
  cleanTmp: () => Promise<TmpCleanResult>
  listBuiltinTemplates: () => Promise<string[]>
  copyBuiltinTemplate: (name: string) => Promise<CopyTemplateResult>

  // Catalog / Resolver API
  resolveLatest: (type: string, channel: string, forceRefresh?: boolean) => Promise<ResolveResult>
  getCachedResolution: (type: string, channel: string) => Promise<ResolveResult | null>
  invalidateResolverCache: (type?: string) => Promise<boolean>
  listCatalog: () => Promise<CatalogEntry[]>
  validateDownloadUrl: (url: string) => Promise<{ valid: boolean; reason?: string }>

  // Download API
  startDownload: (type: string, channel: string, forceRefresh?: boolean) => Promise<string>
  cancelDownload: (type: string) => Promise<boolean>
  getDownloadStatus: () => Promise<DownloadJob[]>
  deleteRuntimeVersion: (type: string, folderId: string) => Promise<boolean>
  onDownloadProgress: (callback: (data: DownloadProgressEvent) => void) => () => void

  openExternal: (url: string) => Promise<boolean>
  openPath: (relativePath: string) => Promise<boolean>

  onServiceStatus: (callback: (data: ServiceStatusEvent) => void) => () => void
  onServiceLog: (callback: (data: ServiceLogEvent) => void) => () => void
}

declare global {
  interface Window {
    api: AstraApi
  }
}
