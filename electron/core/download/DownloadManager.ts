import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import type { WebContents } from 'electron'
import { Paths } from '../Paths.ts'
import { RUNTIME_DEFINITIONS } from '../runtimes/RuntimeDefinition.ts'
import { resolveLatest } from './VersionResolver.ts'
import type {
  DownloadJob,
  DownloadProgressEvent,
  VersionChannel,
  ResolveResult
} from './CatalogTypes.ts'
import type { RuntimeType } from '../runtimes/RuntimeDefinition.ts'
import {
  createJournalEntry,
  updateJournalEntry,
  finishJournalEntry,
  cleanupOrphanFoldersFromJournal,
  cleanupLegacyOrphanFolders
} from './InstallJournal.ts'
import { DownloadLogger } from './DownloadLogger.ts'

// ─── helpers ────────────────────────────────────────────────────────────────

function formatJobId(type: RuntimeType): string {
  return `${type}-${Date.now()}`
}

function safeUnlink(filePath: string): void {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath) } catch { /* non-fatal */ }
}

function safeRmDir(dirPath: string, jobId?: string | null): boolean {
  if (!fs.existsSync(dirPath)) return true

  const maxRetries = 8
  const baseDelayMs = 200

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (process.platform === 'win32') {
        try {
          const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true })
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name)
            try { fs.chmodSync(fullPath, entry.isDirectory() ? 0o777 : 0o666) } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
      fs.rmSync(dirPath, { recursive: true, force: true })
      return true
    } catch (err) {
      const errno = (err as NodeJS.ErrnoException).errno
      const code = (err as NodeJS.ErrnoException).code
      if (attempt < maxRetries - 1) {
        DownloadLogger.retry(jobId, attempt + 1, maxRetries, errno, dirPath, 'rm')
        const delay = baseDelayMs * Math.pow(1.5, attempt)
        const start = Date.now()
        while (Date.now() - start < delay) { /* busy wait */ }
      } else {
        DownloadLogger.error(jobId, `safeRmDir failed after ${maxRetries} attempts: ${dirPath} (${code || errno})`)
      }
    }
  }
  return false
}

/** Check for running processes using files in the given directory (Windows) */
function getProcessesUsingDirectory(dirPath: string): Array<{ pid: number; name: string; exe: string }> {
  const result: Array<{ pid: number; name: string; exe: string }> = []
  if (process.platform !== 'win32') return result

  try {
    const ps = spawnSync('tasklist.exe', ['/v', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true })
    if (ps.error || ps.status !== 0) return result

    const lines = ps.stdout.trim().split('\n')
    const realDir = fs.realpathSync(dirPath).toLowerCase()

    for (const line of lines) {
      const match = line.match(/"([^"]+)","(\d+)","[^"]*","[^"]*","[^"]*","[^"]*","[^"]*","[^"]*","([^"]*)"/)
      if (!match) continue
      const [, name, pidStr, windowTitle] = match
      const pid = parseInt(pidStr, 10)

      const knownExes = ['httpd.exe', 'nginx.exe', 'php.exe', 'php-cgi.exe', 'mariadbd.exe', 'mysqld.exe',
        'postgres.exe', 'node.exe', 'python.exe']
      const checkPaths = [windowTitle, name].filter(Boolean).join(' ').toLowerCase()
      if (knownExes.some(exe => checkPaths.includes(exe.toLowerCase()))) {
        try {
          const wmic = spawnSync('wmic.exe', ['process', 'where', `ProcessId=${pid}`, 'get', 'ExecutablePath', '/value'], { encoding: 'utf8', windowsHide: true })
          if (wmic.stdout) {
            const exeMatch = wmic.stdout.match(/ExecutablePath=(.+)/)
            if (exeMatch) {
              const exePath = exeMatch[1].trim().toLowerCase()
              if (exePath.startsWith(realDir)) {
                result.push({ pid, name, exe: exePath })
              }
            }
          }
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return result
}

/** Check if a runtime version is currently active */
async function isVersionActive(type: RuntimeType, folderId: string): Promise<{ active: boolean; processes?: Array<{ pid: number; name: string; exe: string }> }> {
  const definition = RUNTIME_DEFINITIONS[type]
  const target = path.join(Paths.bin, definition.folderName, folderId)
  if (!fs.existsSync(target)) return { active: false }

  const processes = getProcessesUsingDirectory(target)
  return { active: processes.length > 0, processes }
}

// ─── DownloadManager ────────────────────────────────────────────────────────

class DownloadManagerClass extends EventEmitter {
  private jobs = new Map<string, DownloadJob>()
  /** type → jobId mapping untuk cegah duplikat per runtime */
  private activeByType = new Map<RuntimeType, string>()
  /** jobId → journalId mapping untuk tracking jurnal per job */
  private journalByJob = new Map<string, string>()
  private webContents: WebContents | null = null
  /** AbortController per job id */
  private controllers = new Map<string, AbortController>()

  public setWebContents(wc: WebContents | null): void {
    this.webContents = wc
  }

  // ── public API ─────────────────────────────────────────────────────────────

  public getJob(jobId: string): DownloadJob | undefined {
    return this.jobs.get(jobId)
  }

  public getJobByType(type: RuntimeType): DownloadJob | undefined {
    const id = this.activeByType.get(type)
    return id ? this.jobs.get(id) : undefined
  }

  public listJobs(): DownloadJob[] {
    return [...this.jobs.values()]
  }

  /**
   * Mulai download runtime.
   * Jika ada job aktif (resolving/downloading/extracting) untuk type yang sama → throw.
   */
  public async start(
    type: RuntimeType,
    channel: VersionChannel = 'stable',
    forceRefresh = false
  ): Promise<string> {
    const existingId = this.activeByType.get(type)
    if (existingId) {
      const existing = this.jobs.get(existingId)
      if (existing && ['resolving', 'downloading', 'verifying', 'extracting'].includes(existing.status)) {
        throw new Error(`Download ${type} sudah berjalan (job: ${existingId})`)
      }
    }

    const jobId = formatJobId(type)
    const job: DownloadJob = {
      id: jobId,
      type,
      channel,
      status: 'resolving',
      progressPercent: 0,
      bytesReceived: 0,
      totalBytes: 0,
      warnings: [],
      startedAt: new Date().toISOString()
    }
    this.jobs.set(jobId, job)
    this.activeByType.set(type, jobId)
    this.pushProgress(job)

    // Create journal entry
    const journalEntry = createJournalEntry(type, 'install', '', undefined)
    const journalId = journalEntry.id
    this.journalByJob.set(jobId, journalId)
    DownloadLogger.stage(journalId, 'resolving')

    // Jalankan async tanpa blocking caller
    this.runJob(job, forceRefresh, journalId).catch((err) => {
      this.failJob(job, (err as Error).message)
    })

    return jobId
  }

  /** Batalkan job aktif untuk type tertentu */
  public cancel(type: RuntimeType): boolean {
    const jobId = this.activeByType.get(type)
    if (!jobId) return false
    const job = this.jobs.get(jobId)
    if (!job) return false
    if (['done', 'error', 'cancelled'].includes(job.status)) return false

    const controller = this.controllers.get(jobId)
    controller?.abort()

    const journalId = this.journalByJob.get(jobId)
    if (journalId) {
      finishJournalEntry(journalId, false, new Error('Dibatalkan oleh user'))
      DownloadLogger.stage(journalId, 'cancelled')
    }

    this.updateJob(job, { status: 'cancelled', finishedAt: new Date().toISOString() })
    this.activeByType.delete(type)
    this.journalByJob.delete(jobId)
    return true
  }

  /**
   * Hapus versi yang sudah terinstall dari bin/.
   * Validasi: type valid, folderId tidak mengandung path traversal,
   * folder berada di dalam bin/<folderName>/.
   */
  public async deleteVersion(type: RuntimeType, folderId: string): Promise<void> {
    if (!folderId || folderId.includes('..') || path.isAbsolute(folderId) ||
        folderId.includes('/') || folderId.includes('\\')) {
      throw new Error('folderId tidak valid')
    }
    const definition = RUNTIME_DEFINITIONS[type]
    const base = path.join(Paths.bin, definition.folderName)
    const target = path.join(base, folderId)

    // Realpath check: target must be inside base
    const realBase = fs.realpathSync(base)
    const realTarget = fs.realpathSync(target)
    if (!realTarget.startsWith(realBase + path.sep)) {
      throw new Error('Akses di luar folder bin ditolak')
    }
    if (!fs.existsSync(target)) {
      throw new Error(`Folder versi tidak ditemukan: ${target}`)
    }

    // Check for running processes using this version
    const { active, processes } = await isVersionActive(type, folderId)
    if (active && processes && processes.length > 0) {
      const procList = processes.map(p => `${p.name} (PID ${p.pid})`).join(', ')
      throw new Error(`Versi ini sedang digunakan oleh proses: ${procList}. Hentikan service/proses terlebih dahulu.`)
    }

    // Create journal entry for uninstall
    const journalId = createJournalEntry(type, 'uninstall', folderId, target).id
    DownloadLogger.stage(journalId, 'uninstall', `target: ${target}`)

    // Rename to __del_<timestamp> first (atomic disappearance from listing)
    const delName = `__del_${Date.now()}`
    const delPath = path.join(base, delName)

    try {
      fs.renameSync(target, delPath)
    } catch (err) {
      const errno = (err as NodeJS.ErrnoException).errno
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EBUSY' || code === 'EPERM' || errno === -4082 || errno === -4048) {
        const { processes } = await isVersionActive(type, folderId)
        const procList = processes?.length ? processes.map(p => `${p.name} (PID ${p.pid})`).join(', ') : 'tidak diketahui'
        throw new Error(`Tidak dapat menghapus: folder digunakan oleh ${procList} (${code || `errno ${errno}`})`)
      }
      throw new Error(`Gagal rename ke __del_: ${(err as Error).message}`)
    }

    // Version is now gone from listings; update journal
    updateJournalEntry(journalId, { stage: 'moving', tempPath: delPath })
    DownloadLogger.info(journalId, `Renamed to ${delPath}`)

    // Now delete with retries
    const success = safeRmDir(delPath, journalId)
    if (!success) {
      // Leave __del_ folder for startup cleanup
      DownloadLogger.warn(journalId, `Delete failed, left ${delPath} for startup cleanup`)
      finishJournalEntry(journalId, false, new Error('Hapus gagal, dibiarkan untuk cleanup saat startup'))
      throw new Error(`Hapus gagal setelah retry. Folder dibiarkan di ${delPath} dan akan dihapus saat aplikasi restart.`)
    }

    finishJournalEntry(journalId, true)
    DownloadLogger.stage(journalId, 'done')
  }

  // ── internal ───────────────────────────────────────────────────────────────

  private readInstalledVersion(destPath: string): string | null {
    // Look for version marker file or infer from folder name
    try {
      // Try to read from a .version file we could create on install
      const versionFile = path.join(destPath, '.version')
      if (fs.existsSync(versionFile)) {
        return fs.readFileSync(versionFile, 'utf8').trim()
      }
    } catch { /* ignore */ }
    // Fallback: infer from folder name (destFolder already contains version)
    // Extract version from folder name pattern: php-8.3.16, nginx-1.26.3, etc.
    const folderName = path.basename(destPath)
    const match = folderName.match(/(\d+(?:\.\d+)+(?:-[a-z0-9]+)?)/i)
    return match ? match[1] : null
  }

  private async runJob(job: DownloadJob, forceRefresh: boolean, journalId: string): Promise<void> {
    const controller = new AbortController()
    this.controllers.set(job.id, controller)

    try {
      // ── 1. Resolve version ────────────────────────────────────────────────
      let resolved: ResolveResult
      try {
        resolved = await resolveLatest(job.type, job.channel, forceRefresh)
      } catch (err) {
        throw new Error(`Resolve gagal: ${(err as Error).message}`)
      }

      if (controller.signal.aborted) return

      // Update journal with resolved version
      updateJournalEntry(journalId, { version: resolved.version })

      // Block unverified URLs
      if (resolved.needsManualVerification) {
        throw new Error(
          `URL untuk ${job.type} belum diverifikasi manual (diawali TODO_VERIFY:). ` +
          `Perbarui catalog.json atau isi URL kustom di Settings sebelum mengunduh.`
        )
      }

      if (resolved.warnings.length > 0) {
        job.warnings.push(...resolved.warnings)
      }

      this.updateJob(job, {
        status: 'downloading',
        version: resolved.version,
        url: resolved.url
      })
      DownloadLogger.stage(journalId, 'downloading', resolved.url)

      // ── 2. Tentukan nama file dan folder tujuan ─────────────────────────
      const definition = RUNTIME_DEFINITIONS[job.type]
      const isComposer = job.type === 'composer'
      const archiveName = isComposer
        ? `composer-${resolved.version}.phar`
        : path.basename(resolved.url)
      const archivePath = path.join(Paths.downloads, archiveName)

      // Nama folder tujuan = nama arsip tanpa ekstensi (ala Laragon)
      const destFolder = isComposer
        ? 'composer'
        : archiveName.replace(/\.(zip|tar\.\w+)$/, '')
      const destPath = path.join(Paths.bin, definition.folderName, destFolder)

      this.updateJob(job, { archiveFile: archiveName, destFolder })

      // Early abort: versi sudah terpasang → tidak perlu download ulang
      if (fs.existsSync(destPath)) {
        const existingVersion = this.readInstalledVersion(destPath)
        if (existingVersion === resolved.version && definition.detect(destPath)) {
          job.warnings.push(`Versi ${resolved.version} sudah terpasang di ${destPath}. Hapus dulu jika ingin instal ulang.`)
          this.updateJob(job, {
            status: 'done',
            version: resolved.version,
            warnings: job.warnings,
            archiveFile: archiveName,
            destFolder,
            progressPercent: 100,
            totalBytes: 0,
            bytesReceived: 0,
          })
          finishJournalEntry(journalId, true)
          DownloadLogger.stage(journalId, 'done', 'already installed')
          return
        }
        // Folder ada tapi versi beda atau detect() gagal → akan overwrite
      }

      if (!fs.existsSync(Paths.downloads)) {
        fs.mkdirSync(Paths.downloads, { recursive: true })
      }

      // ── 3. Download ─────────────────────────────────────────────────────
      let response: Response
      try {
        response = await fetch(resolved.url, { signal: controller.signal })
      } catch (err) {
        throw new Error(`Download gagal: ${(err as Error).message}`)
      }

      if (!response.ok) {
        throw new Error(`Server mengembalikan HTTP ${response.status} untuk ${resolved.url}`)
      }

      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
      this.updateJob(job, { totalBytes })

      const fileStream = fs.createWriteStream(archivePath)
      const hasher = crypto.createHash('sha256')
      let bytesReceived = 0

      try {
        const reader = response.body!.getReader()
        while (true) {
          if (controller.signal.aborted) {
            reader.cancel()
            fileStream.close()
            safeUnlink(archivePath)
            return
          }
          const { done, value } = await reader.read()
          if (done) break
          fileStream.write(value)
          hasher.update(value)
          bytesReceived += value.length
          const percent = totalBytes > 0 ? Math.round((bytesReceived / totalBytes) * 100) : 0
          this.updateJob(job, { bytesReceived, progressPercent: percent })
        }
        fileStream.end()
        await new Promise<void>((resolve, reject) => {
          fileStream.on('finish', resolve)
          fileStream.on('error', reject)
        })
      } catch (err) {
        fileStream.destroy()
        safeUnlink(archivePath)
        throw new Error(`Error saat menulis arsip: ${(err as Error).message}`)
      }

      // ── 4. Verifikasi SHA-256 ───────────────────────────────────────────
      this.updateJob(job, { status: 'verifying', progressPercent: 100 })
      DownloadLogger.stage(journalId, 'verifying', `sha256 expected: ${resolved.sha256 || 'none'}`)
      const actualSha = hasher.digest('hex')

      if (resolved.sha256) {
        if (actualSha.toLowerCase() !== resolved.sha256.toLowerCase()) {
          safeUnlink(archivePath)
          throw new Error(
            `SHA-256 tidak cocok untuk ${archiveName}.\n` +
            `  Diharapkan: ${resolved.sha256}\n` +
            `  Aktual    : ${actualSha}\n` +
            `Arsip telah dihapus. Coba unduh ulang.`
          )
        }
        DownloadLogger.info(journalId, `SHA-256 verified: ${actualSha}`)
      } else {
        job.warnings.push(
          `SHA-256 tidak tersedia untuk ${archiveName}; integritas tidak dapat diverifikasi secara otomatis.`
        )
        DownloadLogger.warn(journalId, 'SHA-256 not available, skipping verification')
      }

      if (controller.signal.aborted) {
        safeUnlink(archivePath)
        return
      }

      // ── 5. Ekstraksi ────────────────────────────────────────────────────
      this.updateJob(job, { status: 'extracting' })
      DownloadLogger.stage(journalId, 'extracting')

      if (isComposer) {
        // Composer adalah single .phar — salin langsung ke bin/composer/
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true })
        }
        fs.copyFileSync(archivePath, path.join(destPath, 'composer.phar'))
        safeUnlink(archivePath)
      } else {
        await this.extractZipAtomic(archivePath, destPath, resolved.archiveRoot, resolved.version, journalId)
      }

      // ── 6. Selesai ──────────────────────────────────────────────────────
      this.updateJob(job, {
        status: 'done',
        progressPercent: 100,
        finishedAt: new Date().toISOString()
      })
      this.activeByType.delete(job.type)
      finishJournalEntry(journalId, true)
      DownloadLogger.stage(journalId, 'done')
    } catch (err) {
      if (controller.signal.aborted) {
        // Sudah di-handle di cancel()
        return
      }
      DownloadLogger.error(journalId, `Job failed: ${(err as Error).message}`)
      finishJournalEntry(journalId, false, err as Error)
      this.failJob(job, (err as Error).message)
    } finally {
      this.controllers.delete(job.id)
      this.journalByJob.delete(job.id)
    }
  }

  /**
   * Ekstrak ZIP ke destPath.
   * Jika archiveRoot ada, angkat isi subfolder satu level.
   * Tolak path traversal di dalam arsip.
   */
  private async extractZipAtomic(
    archivePath: string,
    destPath: string,
    archiveRoot: string | undefined,
    version: string,
    journalId: string
  ): Promise<void> {
    // MAX_PATH check
    if (destPath.length > 240) {
      throw new Error(`Path terlalu panjang (${destPath.length} > 240): ${destPath}`)
    }

    const tmpDest = path.join(path.dirname(destPath), `__tmp_${journalId}`)

    DownloadLogger.stage(journalId, 'extracting', `tmp: ${tmpDest}`)

    // Clean up any leftover tmp
    if (fs.existsSync(tmpDest)) safeRmDir(tmpDest, journalId)
    fs.mkdirSync(tmpDest, { recursive: true })

    // Expand-Archive via PowerShell
    const psScript = [
      `$ErrorActionPreference = 'Stop'`,
      `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${tmpDest.replace(/'/g, "''")}' -Force`
    ].join('; ')

    await new Promise<void>((resolve, reject) => {
      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        windowsHide: true,
        shell: false
      })
      let stderr = ''
      ps.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
      ps.on('error', (err) => reject(new Error(`PowerShell gagal dijalankan: ${err.message}`)))
      ps.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Expand-Archive gagal (exit ${code}): ${stderr.slice(0, 300)}`))
      })
    })

    // Handle archiveRoot
    let sourceDir = tmpDest
    if (archiveRoot) {
      const inner = path.join(tmpDest, archiveRoot)
      if (!fs.existsSync(inner)) {
        // Auto-detect: if tmpDest has exactly one subdirectory, use it as the wrapper
        const entries = fs.readdirSync(tmpDest, { withFileTypes: true })
          .filter(e => e.isDirectory())
        if (entries.length === 1) {
          sourceDir = path.join(tmpDest, entries[0].name)
          DownloadLogger.info(journalId, `archiveRoot "${archiveRoot}" tidak ditemukan; auto-detected wrapper "${entries[0].name}"`)
        } else {
          safeRmDir(tmpDest, journalId)
          throw new Error(
            `archiveRoot "${archiveRoot}" tidak ditemukan setelah ekstraksi. ` +
            `Periksa nilai archiveRoot di catalog.json.`
          )
        }
      } else {
        sourceDir = inner
      }
      const realTmp = fs.realpathSync(tmpDest)
      const realInner = fs.realpathSync(sourceDir)
      if (!realInner.startsWith(realTmp + path.sep)) {
        safeRmDir(tmpDest, journalId)
        throw new Error('Path traversal terdeteksi di dalam arsip; ekstraksi dibatalkan.')
      }
    }

    // Verify with detect() before committing
    const definition = RUNTIME_DEFINITIONS[this.getTypeFromDest(destPath)]
    if (definition && !definition.detect(sourceDir)) {
      safeRmDir(tmpDest, journalId)
      throw new Error(`detect() gagal untuk versi ${version} di ${sourceDir}`)
    }

    // Remove read-only on Windows
    if (process.platform === 'win32') {
      try {
        const entries = fs.readdirSync(sourceDir, { withFileTypes: true, recursive: true })
        for (const entry of entries) {
          const fullPath = path.join(sourceDir, entry.name)
          try { fs.chmodSync(fullPath, entry.isDirectory() ? 0o777 : 0o666) } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    // Remove existing destPath first
    if (fs.existsSync(destPath)) {
      safeRmDir(destPath, journalId)
    }

    // Atomic move with retries
    const maxRetries = 8
    const baseDelayMs = 200
    let moveSuccess = false
    let lastErr: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        fs.renameSync(sourceDir, destPath)
        moveSuccess = true
        break
      } catch (err) {
        lastErr = err as Error
        const code = (err as NodeJS.ErrnoException).code
        const errno = (err as NodeJS.ErrnoException).errno
        if (code === 'EPERM' || code === 'EBUSY' || code === 'ENOTEMPTY' ||
            errno === -4048 || errno === -4082 || errno === -4090) {
          DownloadLogger.retry(journalId, attempt + 1, maxRetries, errno, destPath, 'rename')
          const delay = baseDelayMs * Math.pow(1.5, attempt)
          const start = Date.now()
          while (Date.now() - start < delay) { /* busy wait */ }
        } else {
          throw err
        }
      }
    }

    if (!moveSuccess) {
      DownloadLogger.warn(journalId, `Rename failed after ${maxRetries} attempts, trying fallback copy`)
      try {
        // Remove destination if it exists (partial)
        if (fs.existsSync(destPath)) safeRmDir(destPath, journalId)
        fs.cpSync(sourceDir, destPath, { recursive: true })
        moveSuccess = true
        DownloadLogger.info(journalId, 'Fallback copy succeeded')
      } catch (copyErr) {
        safeRmDir(tmpDest, journalId)
        throw new Error(
          `Gagal memindahkan hasil ekstraksi: rename gagal (${lastErr?.message}) dan fallback copy gagal: ${(copyErr as Error).message}`
        )
      }
    }

    // Clean up tmp
    safeRmDir(tmpDest, journalId)

    // Write .version file for future detection
    try {
      fs.writeFileSync(path.join(destPath, '.version'), version, 'utf8')
    } catch { /* ignore */ }
  }

  private getTypeFromDest(destPath: string): RuntimeType {
    const folderName = path.basename(path.dirname(destPath))
    const mapping: Record<string, RuntimeType> = {
      php: 'php',
      nginx: 'nginx',
      apache: 'apache',
      mariadb: 'mariadb',
      postgresql: 'postgresql',
      nodejs: 'nodejs',
      python: 'python',
      composer: 'composer'
    }
    return mapping[folderName] || 'php'
  }

  // ── utilities ──────────────────────────────────────────────────────────────

  private updateJob(job: DownloadJob, partial: Partial<DownloadJob>): void {
    Object.assign(job, partial)
    this.pushProgress(job)
  }

  private failJob(job: DownloadJob, error: string): void {
    this.updateJob(job, {
      status: 'error',
      error,
      finishedAt: new Date().toISOString()
    })
    this.activeByType.delete(job.type)
    this.controllers.delete(job.id)
  }

  private pushProgress(job: DownloadJob): void {
    const event: DownloadProgressEvent = {
      id: job.id,
      type: job.type,
      status: job.status,
      progressPercent: job.progressPercent,
      bytesReceived: job.bytesReceived,
      totalBytes: job.totalBytes,
      version: job.version,
      error: job.error,
      warnings: job.warnings,
      destFolder: job.destFolder
    }
    // Emit local untuk unit test / internal
    this.emit('progress', event)

    // Push ke renderer
    if (this.webContents && !this.webContents.isDestroyed()) {
      this.webContents.send('download:progress', event)
    }
  }
}

export const downloadManager = new DownloadManagerClass()

/**
 * Startup cleanup: bersihkan folder __tmp_* dan __del_* yang tertinggal.
 * Menggunakan journal instalasi sebagai sumber kebenaran; fallback ke pola nama.
 * JANGAN menyentuh folder versi valid (yang lolos detect()).
 */
export function startupCleanup(): void {
  // 1. Cleanup from journal entries
  cleanupOrphanFoldersFromJournal()

  // 2. Legacy cleanup for any __tmp_*/__del_* not in journal
  cleanupLegacyOrphanFolders()

  DownloadLogger.info('startup', 'Startup cleanup completed')
}
