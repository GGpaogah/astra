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

export interface AstraApi {
  ping: () => Promise<string>
  listServices: () => Promise<ServiceInfo[]>
  startService: (name: string) => Promise<ServiceStatus>
  stopService: (name: string) => Promise<ServiceStatus>
  restartService: (name: string) => Promise<ServiceStatus>
  getLogs: (name: string) => Promise<string[]>
  onServiceStatus: (callback: (data: ServiceStatusEvent) => void) => () => void
  onServiceLog: (callback: (data: ServiceLogEvent) => void) => () => void
}

declare global {
  interface Window {
    api: AstraApi
  }
}
