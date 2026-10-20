import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import readline from 'node:readline'
import { BaseService } from './BaseService.ts'
import { Paths } from '../Paths.ts'
import { PortChecker } from '../PortChecker.ts'
import { ConfigGenerator } from '../ConfigGenerator.ts'

export class MariaDbService extends BaseService {
  public readonly name = 'mariadb'
  public port = 3306

  private configPath: string | null = null

  public async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      return
    }

    this.setStatus('starting')
    this.appendLog('Memulai MariaDB pre-check...')

    // 1. Validasi keberadaan binary mariadbd.exe
    const mariadbdPath = Paths.getBinPath('mariadb', 'bin', 'mariadbd.exe')
    if (!fs.existsSync(mariadbdPath)) {
      const err = `Binary mariadbd.exe tidak ditemukan di ${mariadbdPath}. Silakan unduh MariaDB ZIP (Windows x64) dan ekstrak foldernya ke bin/mariadb/.`
      this.appendLog(`[ERROR] ${err}`)
      this.setStatus('error', err)
      return
    }

    // 2. Validasi ketersediaan port
    const isFree = await PortChecker.isPortFree(this.port)
    if (!isFree) {
      const err = `Port ${this.port} sudah digunakan oleh aplikasi lain (misal: MySQL/MariaDB service bawaan). Tutup aplikasi tersebut atau ubah port MariaDB.`
      this.appendLog(`[ERROR] ${err}`)
      this.setStatus('error', err)
      return
    }

    // 3. Inisialisasi awal datadir jika data/mysql/mysql belum ada
    const dataDir = path.join(Paths.data, 'mysql')
    const mysqlSystemDb = path.join(dataDir, 'mysql')
    if (!fs.existsSync(mysqlSystemDb)) {
      this.appendLog('Folder data/mysql belum terinisialisasi. Menjalankan inisialisasi awal database...')
      const initSuccess = await this.initDatabase(dataDir)
      if (!initSuccess) {
        return
      }
    }

    // 4. Generate konfigurasi etc/mariadb/my.ini
    try {
      this.configPath = ConfigGenerator.generateMariaDbConfig(this.port)
      this.appendLog(`Konfigurasi my.ini dihasilkan di: ${this.configPath}`)
    } catch (err) {
      const msg = `Gagal membuat konfigurasi my.ini: ${(err as Error).message}`
      this.appendLog(`[ERROR] ${msg}`)
      this.setStatus('error', msg)
      return
    }

    // 5. Spawn mariadbd.exe dengan --defaults-file
    this.appendLog(`Menjalankan mariadbd.exe pada port ${this.port}...`)
    this.spawnProcess(mariadbdPath, [
      `--defaults-file=${this.configPath}`,
      '--console'
    ])

    // 6. Polling sampai port TCP merespons (siap menerima koneksi)
    const isReady = await PortChecker.waitForPort(this.port, 30000, 500)
    if (isReady && this.process && !this.process.killed) {
      this.setStatus('running')
      this.appendLog(`MariaDB berhasil berjalan dan siap melayani koneksi di port ${this.port}`)
    } else {
      if (this.status !== 'error') {
        const recentLogs = this.getLogs().slice(-20).join('\n')
        const err = `MariaDB gagal siap melayani koneksi di port ${this.port} dalam 30 detik.\n${recentLogs}`
        this.appendLog(`[ERROR] ${err}`)
        this.setStatus('error', `MariaDB gagal listen di port ${this.port} dalam 30 detik`)
        await this.stopProcess()
      }
    }
  }

  public async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return
    }

    this.setStatus('stopping')
    this.appendLog('Menghentikan layanan MariaDB...')

    const adminPath = Paths.getBinPath('mariadb', 'bin', 'mariadb-admin.exe')
    let shutdownGraceful = false

    // Coba shutdown graceful via mariadb-admin jika binary ada
    if (fs.existsSync(adminPath) && this.process) {
      this.appendLog('Mencoba graceful shutdown via mariadb-admin...')
      shutdownGraceful = await this.adminShutdown(adminPath, 10000)
    }

    // Fallback ke stopProcess (tree-kill) jika graceful shutdown gagal atau timeout
    if (!shutdownGraceful && this.process) {
      this.appendLog('[WARN] Graceful shutdown gagal/timeout, mematikan proses via tree-kill...')
      await this.stopProcess()
    } else {
      this.setStatus('stopped')
    }

    this.appendLog('MariaDB berhasil dihentikan')
  }

  private async initDatabase(dataDir: string): Promise<boolean> {
    const installDbPath = Paths.getBinPath('mariadb', 'bin', 'mariadb-install-db.exe')
    if (!fs.existsSync(installDbPath)) {
      const err = `Binary mariadb-install-db.exe tidak ditemukan di ${installDbPath}`
      this.appendLog(`[ERROR] ${err}`)
      this.setStatus('error', err)
      return false
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    return new Promise<boolean>((resolve) => {
      this.appendLog(`Menjalankan: ${installDbPath} --datadir="${dataDir}"`)
      const child = spawn(installDbPath, [`--datadir=${dataDir}`], {
        windowsHide: true,
        shell: false
      })

      if (child.stdout) {
        const rl = readline.createInterface({ input: child.stdout })
        rl.on('line', (line) => this.appendLog(`[INIT] ${line}`))
      }

      if (child.stderr) {
        const rl = readline.createInterface({ input: child.stderr })
        rl.on('line', (line) => this.appendLog(`[INIT STDERR] ${line}`))
      }

      child.on('error', (err) => {
        this.appendLog(`[ERROR] Gagal menjalankan mariadb-install-db: ${err.message}`)
        this.cleanupFailedInit(dataDir)
        this.setStatus('error', `Gagal inisialisasi database: ${err.message}`)
        resolve(false)
      })

      child.on('exit', (code) => {
        if (code === 0) {
          this.appendLog('Inisialisasi database MariaDB selesai dengan sukses')
          resolve(true)
        } else {
          this.appendLog(`[ERROR] mariadb-install-db keluar dengan kode ${code}`)
          this.cleanupFailedInit(dataDir)
          this.setStatus('error', `Inisialisasi database gagal (kode keluar: ${code})`)
          resolve(false)
        }
      })
    })
  }

  private cleanupFailedInit(dataDir: string): void {
    try {
      this.appendLog(`Membersihkan folder data/mysql yang gagal terinisialisasi...`)
      if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true })
      }
    } catch (cleanupErr) {
      this.appendLog(`[WARN] Gagal membersihkan folder: ${(cleanupErr as Error).message}`)
    }
  }

  private async adminShutdown(adminPath: string, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let resolved = false

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve(false)
        }
      }, timeoutMs)

      const child = spawn(
        adminPath,
        ['--protocol=tcp', '-h', '127.0.0.1', `-P`, String(this.port), '-u', 'root', 'shutdown'],
        { windowsHide: true, shell: false }
      )

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
