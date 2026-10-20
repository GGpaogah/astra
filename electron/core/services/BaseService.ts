import { EventEmitter } from 'node:events'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import readline from 'node:readline'
import treeKill from 'tree-kill'
import type { ServiceStatus } from '../types.ts'

export abstract class BaseService extends EventEmitter {
  public abstract readonly name: string
  public abstract port: number
  public status: ServiceStatus = 'stopped'
  public lastError: string | null = null

  private readonly maxLogs: number = 1000
  private logs: string[] = []
  protected process: ChildProcessWithoutNullStreams | null = null

  constructor() {
    super()
  }

  public abstract start(): Promise<void>
  public abstract stop(): Promise<void>

  public getStatus(): ServiceStatus {
    return this.status
  }

  public getLastError(): string | null {
    return this.lastError
  }

  public async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }

  public getLogs(): string[] {
    return [...this.logs]
  }

  protected setStatus(status: ServiceStatus, error?: string | null): void {
    const errorChanged = error !== undefined && this.lastError !== error
    if (error !== undefined) {
      this.lastError = error
    } else if (status === 'running' || status === 'stopped') {
      this.lastError = null
    }

    if (this.status !== status || errorChanged) {
      this.status = status
      this.emit('status', {
        status: this.status,
        lastError: this.lastError
      })
    }
  }

  protected appendLog(line: string): void {
    const timestamp = new Date().toISOString()
    const formatted = `[${timestamp}] [${this.name}] ${line}`
    this.logs.push(formatted)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
    this.emit('log', formatted)
  }

  protected spawnProcess(
    command: string,
    args: string[] = [],
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
  ): ChildProcessWithoutNullStreams {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      windowsHide: true,
      shell: false
    })

    this.process = child

    if (child.stdout) {
      const rlStdout = readline.createInterface({ input: child.stdout })
      rlStdout.on('line', (line) => {
        this.appendLog(line)
      })
    }

    if (child.stderr) {
      const rlStderr = readline.createInterface({ input: child.stderr })
      rlStderr.on('line', (line) => {
        this.appendLog(`[STDERR] ${line}`)
      })
    }

    child.on('error', (err) => {
      this.appendLog(`[ERROR] Process error: ${err.message}`)
      this.setStatus('error', `Process error: ${err.message}`)
    })

    child.on('exit', (code, signal) => {
      this.appendLog(`Process exited with code ${code ?? 'null'} signal ${signal ?? 'null'}`)
      this.process = null
      if (this.status !== 'stopping' && this.status !== 'stopped') {
        const exitMsg = code !== 0 ? `Process exited unexpectedly with code ${code}` : null
        this.setStatus(code === 0 ? 'stopped' : 'error', exitMsg)
      } else {
        this.setStatus('stopped')
      }
    })

    return child
  }

  protected async stopProcess(signal: string | number = 'SIGTERM'): Promise<void> {
    if (!this.process || !this.process.pid) {
      this.setStatus('stopped')
      return
    }

    const pid = this.process.pid
    return new Promise<void>((resolve) => {
      treeKill(pid, signal, (err) => {
        if (err) {
          this.appendLog(`[WARN] tree-kill error: ${err.message}`)
        }
        this.process = null
        this.setStatus('stopped')
        resolve()
      })
    })
  }
}
