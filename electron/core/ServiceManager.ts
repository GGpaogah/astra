import type { WebContents } from 'electron'
import type { BaseService } from './services/BaseService.ts'
import type { ServiceInfo } from './types.ts'

export class ServiceManager {
  private services = new Map<string, BaseService>()
  private webContents: WebContents | null = null

  // Batching log: serviceName -> string[]
  private pendingLogs = new Map<string, string[]>()
  private flushTimer: NodeJS.Timeout | null = null

  public setWebContents(webContents: WebContents | null): void {
    this.webContents = webContents
  }

  public register(service: BaseService): void {
    if (this.services.has(service.name)) {
      throw new Error(`Service "${service.name}" already registered`)
    }

    this.services.set(service.name, service)

    service.on('status', (status) => {
      if (this.webContents && !this.webContents.isDestroyed()) {
        this.webContents.send('services:status', {
          service: service.name,
          status
        })
      }
    })

    service.on('log', (line: string) => {
      this.enqueueLog(service.name, line)
    })
  }

  public get(name: string): BaseService | undefined {
    return this.services.get(name)
  }

  public list(): ServiceInfo[] {
    const result: ServiceInfo[] = []
    for (const service of this.services.values()) {
      result.push({
        name: service.name,
        port: service.port,
        status: service.getStatus()
      })
    }
    return result
  }

  public async startAll(): Promise<void> {
    const promises = Array.from(this.services.values()).map((service) => service.start())
    await Promise.all(promises)
  }

  public async stopAll(): Promise<void> {
    const promises = Array.from(this.services.values()).map((service) => service.stop())
    await Promise.all(promises)
    this.flushLogs()
  }

  private enqueueLog(serviceName: string, line: string): void {
    let list = this.pendingLogs.get(serviceName)
    if (!list) {
      list = []
      this.pendingLogs.set(serviceName, list)
    }
    list.push(line)

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        this.flushLogs()
      }, 250)
    }
  }

  private flushLogs(): void {
    if (this.pendingLogs.size === 0) return

    if (this.webContents && !this.webContents.isDestroyed()) {
      for (const [service, lines] of this.pendingLogs.entries()) {
        if (lines.length > 0) {
          this.webContents.send('services:log', {
            service,
            lines: [...lines]
          })
        }
      }
    }

    this.pendingLogs.clear()
  }
}

export const serviceManager = new ServiceManager()
