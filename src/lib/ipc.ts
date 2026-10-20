import type { ServiceInfo, ServiceLogEvent, ServiceStatus, ServiceStatusEvent } from '../types.d.ts'

export async function ping(): Promise<string> {
  return window.api.ping()
}

export async function listServices(): Promise<ServiceInfo[]> {
  return window.api.listServices()
}

export async function startService(name: string): Promise<ServiceStatus> {
  return window.api.startService(name)
}

export async function stopService(name: string): Promise<ServiceStatus> {
  return window.api.stopService(name)
}

export async function restartService(name: string): Promise<ServiceStatus> {
  return window.api.restartService(name)
}

export async function getLogs(name: string): Promise<string[]> {
  return window.api.getLogs(name)
}

export function onServiceStatus(callback: (data: ServiceStatusEvent) => void): () => void {
  return window.api.onServiceStatus(callback)
}

export function onServiceLog(callback: (data: ServiceLogEvent) => void): () => void {
  return window.api.onServiceLog(callback)
}

export default ping
