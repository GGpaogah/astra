import type {
  ServiceInfo,
  ServiceLogEvent,
  ServiceStatus,
  ServiceStatusEvent,
  RuntimeGroupInfo,
  RuntimeSetResult,
  RuntimePreferences,
  TmpSizeResult,
  TmpCleanResult,
  CopyTemplateResult
} from '../types.d.ts'

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

export async function startAllServices(): Promise<ServiceInfo[]> {
  return window.api.startAllServices()
}

export async function stopAllServices(): Promise<ServiceInfo[]> {
  return window.api.stopAllServices()
}

export async function getLogs(name: string): Promise<string[]> {
  return window.api.getLogs(name)
}

export async function listRuntimes(): Promise<RuntimeGroupInfo[]> {
  return window.api.listRuntimes()
}

export async function setRuntimeActive(type: string, folderId: string): Promise<RuntimeSetResult> {
  return window.api.setRuntimeActive(type, folderId)
}

export async function refreshRuntimes(): Promise<RuntimeGroupInfo[]> {
  return window.api.refreshRuntimes()
}

export async function openRuntimeFolder(type: string, folderId?: string): Promise<boolean> {
  return window.api.openRuntimeFolder(type, folderId)
}

export async function getRuntimePreferences(): Promise<RuntimePreferences> {
  return window.api.getRuntimePreferences()
}

export async function setRuntimeAutoRestart(enabled: boolean): Promise<RuntimePreferences> {
  return window.api.setRuntimeAutoRestart(enabled)
}

export async function openExternal(url: string): Promise<boolean> {
  return window.api.openExternal(url)
}

export async function openPath(relativePath: string): Promise<boolean> {
  return window.api.openPath(relativePath)
}

// Tmp API
export async function getTmpSize(): Promise<TmpSizeResult> {
  return window.api.getTmpSize()
}

export async function cleanTmp(): Promise<TmpCleanResult> {
  return window.api.cleanTmp()
}

export async function listBuiltinTemplates(): Promise<string[]> {
  return window.api.listBuiltinTemplates()
}

export async function copyBuiltinTemplate(name: string): Promise<CopyTemplateResult> {
  return window.api.copyBuiltinTemplate(name)
}

export function onServiceStatus(callback: (data: ServiceStatusEvent) => void): () => void {
  return window.api.onServiceStatus(callback)
}

export function onServiceLog(callback: (data: ServiceLogEvent) => void): () => void {
  return window.api.onServiceLog(callback)
}

export default ping
