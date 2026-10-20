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
