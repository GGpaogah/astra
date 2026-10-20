import { BaseService } from './BaseService.ts'

/**
 * DummyService
 * PERINGATAN: Service ini HANYA digunakan untuk uji coba Fase 2 (Paths, BaseService, ServiceManager, IPC, UI).
 * HAPUS service ini pada Fase 4 saat Apache & MariaDB sudah diintegrasikan.
 */
export class DummyService extends BaseService {
  public readonly name = 'dummy'
  public port = 8080

  private timer: NodeJS.Timeout | null = null
  private counter = 0

  public async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      return
    }

    this.setStatus('starting')
    this.appendLog('Starting DummyService...')

    await new Promise((resolve) => setTimeout(resolve, 300))

    this.counter = 0
    this.setStatus('running')
    this.appendLog(`DummyService started on port ${this.port}`)

    this.timer = setInterval(() => {
      this.counter += 1
      this.appendLog(`Tick #${this.counter}: dummy service is running normally`)
    }, 1000)
  }

  public async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return
    }

    this.setStatus('stopping')
    this.appendLog('Stopping DummyService...')

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    await new Promise((resolve) => setTimeout(resolve, 200))
    this.setStatus('stopped')
    this.appendLog('DummyService stopped successfully')
  }
}
