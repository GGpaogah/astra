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

export interface PhpVersionInfo {
  version: string
  path: string
  hasApacheModule: boolean
  modulePath: string | null
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

  listPhpVersions: () => Promise<PhpVersionInfo[]>
  getActivePhpVersion: () => Promise<PhpVersionInfo | null>
  setActivePhpVersion: (version: string) => Promise<PhpVersionInfo | null>

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
