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

    service.on('status', () => {
      if (this.webContents && !this.webContents.isDestroyed()) {
        this.webContents.send('services:status', {
          service: service.name,
          status: service.getStatus(),
          lastError: service.getLastError()
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
        status: service.getStatus(),
        lastError: service.getLastError()
      })
    }
    return result
  }

  /**
   * Jalankan semua service secara berurutan: mariadb lalu apache
   */
  public async startAll(): Promise<void> {
    const order = ['mariadb', 'apache']
    for (const name of order) {
      const s = this.services.get(name)
      if (s && s.getStatus() !== 'running') {
        await s.start()
      }
    }

    // Untuk service lainnya jika ada
    for (const [name, service] of this.services.entries()) {
      if (!order.includes(name) && service.getStatus() !== 'running') {
        await service.start()
      }
    }
  }

  /**
   * Hentikan semua service secara berurutan terbalik: apache dulu, lalu mariadb
   */
  public async stopAll(): Promise<void> {
    const reverseOrder = ['apache', 'mariadb']
    for (const name of reverseOrder) {
      const s = this.services.get(name)
      if (s && s.getStatus() !== 'stopped') {
        await s.stop()
      }
    }

    // Untuk service lainnya jika ada
    for (const [name, service] of this.services.entries()) {
      if (!reverseOrder.includes(name) && service.getStatus() !== 'stopped') {
        await service.stop()
      }
    }

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
