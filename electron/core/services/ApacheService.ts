import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { BaseService } from './BaseService.ts'
import { Paths } from '../Paths.ts'
import { PortChecker } from '../PortChecker.ts'
import { ConfigGenerator } from '../ConfigGenerator.ts'
import { PhpManager } from '../PhpManager.ts'
import { Settings } from '../Settings.ts'

export class ApacheService extends BaseService {
  public readonly name = 'apache'
  public port = 80

  private configPath: string | null = null

  constructor() {
    super()
    const settings = Settings.get()
    if (typeof settings.apachePort === 'number') {
      this.port = settings.apachePort
    }
  }

  public async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      return
    }

    this.setStatus('starting')
    this.appendLog('Memulai Apache pre-check...')

    // 1. Validasi binary httpd.exe
    const httpdPath = Paths.getBinPath('apache', 'bin', 'httpd.exe')
    if (!fs.existsSync(httpdPath)) {
      const err = `Binary httpd.exe tidak ditemukan di ${httpdPath}. Silakan unduh Apache (Win64 Thread Safe) dari Apache Lounge dan ekstrak ke bin/apache/.`
      this.appendLog(`[ERROR] ${err}`)
      this.setStatus('error', err)
      return
    }

    // 2. Validasi PHP
    const phpInfo = PhpManager.getActive()
    if (!phpInfo) {
      const err = 'PHP tidak ditemukan. Letakkan PHP Thread Safe di bin/php/<versi>/ (contoh: bin/php/8.3/). Pastikan berisi php.exe dan php8apache2_4.dll.'
      this.appendLog(`[ERROR] ${err}`)
      this.setStatus('error', err)
      return
    }

    if (!phpInfo.hasApacheModule || !phpInfo.modulePath) {
      const err = `PHP versi ${phpInfo.version} tidak memiliki modul Apache (php8apache2_4.dll atau php7apache2_4.dll). Pastikan mengunduh PHP build Thread Safe.`
      this.appendLog(`[ERROR] ${err}`)
      this.setStatus('error', err)
      return
    }

    this.appendLog(`Menggunakan PHP versi: ${phpInfo.version}`)

    // 3. Validasi port 80
    const isFree = await PortChecker.isPortFree(this.port)
    if (!isFree) {
      const err = `Port ${this.port} sudah digunakan oleh aplikasi lain. Kemungkinan penyebab: Windows IIS / World Wide Web Publishing Service (W3SVC), aplikasi lain, atau XAMPP/Laragon. Matikan layanan tersebut atau ubah port Apache.`
      this.appendLog(`[ERROR] ${err}`)
      this.setStatus('error', err)
      return
    }

    // 4. Generate konfigurasi php.ini & httpd.conf
    try {
      ConfigGenerator.generatePhpConfig(phpInfo)
      this.configPath = ConfigGenerator.generateApacheConfig(this.port, phpInfo)
      this.appendLog(`Konfigurasi httpd.conf dihasilkan di: ${this.configPath}`)
    } catch (err) {
      const msg = `Gagal membuat file konfigurasi Apache: ${(err as Error).message}`
      this.appendLog(`[ERROR] ${msg}`)
      this.setStatus('error', msg)
      return
    }

    // 5. Cek dan buat konfigurasi phpMyAdmin jika ada
    const settings = Settings.get()
    const dbPort = (typeof settings.mariadbPort === 'number') ? settings.mariadbPort : 3306
    ConfigGenerator.generatePhpMyAdminConfig(dbPort)

    // 6. Jalankan test sintaks konfigurasi: httpd.exe -t -f <config>
    this.appendLog('Menguji sintaks konfigurasi Apache (httpd -t)...')
    const configValid = await this.testConfig(httpdPath, this.configPath)
    if (!configValid) {
      return
    }

    // 7. Spawn httpd.exe
    this.appendLog(`Menjalankan Apache HTTP Server pada port ${this.port}...`)
    this.appendLog('[INFO] Catatan: Jika dialog Windows Defender Firewall muncul, izinkan akses jaringan untuk Apache.')

    const normalizedConfig = this.configPath.replace(/\\/g, '/')
    this.spawnProcess(httpdPath, ['-f', normalizedConfig])

    // 8. Polling port TCP sampai merespons
    const isReady = await PortChecker.waitForPort(this.port, 20000, 500)
    if (isReady && this.process && !this.process.killed) {
      this.setStatus('running')
      this.appendLog(`Apache berhasil berjalan dan siap melayani permintaan di http://localhost:${this.port}`)
    } else {
      if (this.status !== 'error') {
        const recentLogs = this.getLogs().slice(-20).join('\n')
        const err = `Apache gagal siap melayani koneksi di port ${this.port} dalam 20 detik.\n${recentLogs}`
        this.appendLog(`[ERROR] ${err}`)
        this.setStatus('error', `Apache gagal listen di port ${this.port} dalam 20 detik`)
        await this.stopProcess()
      }
    }
  }

  public async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return
    }

    this.setStatus('stopping')
    this.appendLog('Menghentikan layanan Apache...')

    const httpdPath = Paths.getBinPath('apache', 'bin', 'httpd.exe')
    let gracefulOk = false

    if (this.configPath && fs.existsSync(httpdPath) && this.process) {
      this.appendLog('Mencoba graceful stop via httpd -k stop...')
      gracefulOk = await this.gracefulStop(httpdPath, this.configPath, 8000)
    }

    if (gracefulOk) {
      this.appendLog('Graceful stop Apache berhasil (httpd -k stop)')
      this.setStatus('stopped')
    } else if (this.process) {
      this.appendLog('[WARN] Graceful stop gagal/timeout, beralih ke forced kill (fallback tree-kill)...')
      await this.stopProcess()
      this.appendLog('Forced kill Apache selesai')
    } else {
      this.setStatus('stopped')
    }

    this.appendLog('Apache berhasil dihentikan')
  }

  private async testConfig(httpdPath: string, configPath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const normalizedConfig = configPath.replace(/\\/g, '/')
      const child = spawn(httpdPath, ['-t', '-f', normalizedConfig], {
        windowsHide: true,
        shell: false
      })

      let output = ''
      child.stdout?.on('data', (d) => { output += d.toString() })
      child.stderr?.on('data', (d) => { output += d.toString() })

      child.on('exit', (code) => {
        if (code === 0) {
          this.appendLog('Sintaks konfigurasi Apache valid (Syntax OK)')
          resolve(true)
        } else {
          const lines = output.trim().split(/\r?\n/).slice(-20).join('\n')
          const err = `Uji konfigurasi Apache gagal:\n${lines}`
          this.appendLog(`[ERROR] ${err}`)
          this.setStatus('error', 'Sintaks konfigurasi Apache gagal (cek log)')
          resolve(false)
        }
      })

      child.on('error', (err) => {
        const msg = `Gagal menjalankan pengujian konfigurasi Apache: ${err.message}`
        this.appendLog(`[ERROR] ${msg}`)
        this.setStatus('error', msg)
        resolve(false)
      })
    })
  }

  private async gracefulStop(httpdPath: string, configPath: string, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let resolved = false

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve(false)
        }
      }, timeoutMs)

      const normalizedConfig = configPath.replace(/\\/g, '/')
      const child = spawn(httpdPath, ['-k', 'stop', '-f', normalizedConfig], {
        windowsHide: true,
        shell: false
      })

      child.on('exit', (code) => {
        clearTimeout(timer)
        if (!resolved) {
          resolved = true
          resolve(code === 0)
        }
      })

      child.on('error', () => {
        clearTimeout(timer)
        if (!resolved) {
          resolved = true
          resolve(false)
        }
      })
    })
  }
}
