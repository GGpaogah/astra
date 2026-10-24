import fs from 'node:fs'
import path from 'node:path'
import { Paths } from '../Paths.ts'

const LOG_DIR = Paths.logs
const LOG_FILE = path.join(LOG_DIR, 'astra-downloads.log')
const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_LOG_FILES = 3

/** Ensure log directory exists */
function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

/** Rotate log files if current exceeds max size */
function rotateIfNeeded(): void {
  try {
    if (!fs.existsSync(LOG_FILE)) return
    const stats = fs.statSync(LOG_FILE)
    if (stats.size < MAX_LOG_SIZE) return

    // Rotate: astra-downloads.log.2 -> .3, .1 -> .2, current -> .1
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
      const src = `${LOG_FILE}.${i}`
      const dst = `${LOG_FILE}.${i + 1}`
      if (fs.existsSync(src)) {
        if (i === MAX_LOG_FILES - 1) {
          fs.unlinkSync(src) // delete oldest
        } else {
          fs.renameSync(src, dst)
        }
      }
    }
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`)
  } catch { /* ignore rotation errors */ }
}

/** Format log line: [ISO] LEVEL [jobId] message */
function formatLine(level: string, jobId: string | null, message: string): string {
  const ts = new Date().toISOString()
  const prefix = jobId ? `[${jobId}] ` : ''
  return `[${ts}] ${level.padEnd(7)} ${prefix}${message}`
}

/** Write a log line (sync, fire-and-forget) */
function writeLine(level: string, jobId: string | null, message: string): void {
  ensureLogDir()
  rotateIfNeeded()
  try {
    fs.appendFileSync(LOG_FILE, formatLine(level, jobId, message) + '\n', 'utf8')
  } catch { /* ignore write errors */ }
}

export const DownloadLogger = {
  /** Info level */
  info(jobId: string | null, message: string): void {
    writeLine('INFO', jobId, message)
  },

  /** Warning level */
  warn(jobId: string | null, message: string): void {
    writeLine('WARN', jobId, message)
  },

  /** Error level */
  error(jobId: string | null, message: string): void {
    writeLine('ERROR', jobId, message)
  },

  /** Debug level (verbose) */
  debug(jobId: string | null, message: string): void {
    writeLine('DEBUG', jobId, message)
  },

  /** Log a retry attempt with errno/code */
  retry(jobId: string | null, attempt: number, maxAttempts: number, errno: string | number | undefined, path: string, action: string): void {
    const code = typeof errno === 'number' ? `errno ${errno}` : (errno || 'unknown')
    writeLine('RETRY', jobId, `attempt ${attempt}/${maxAttempts} ${action} ${path} (${code})`)
  },

  /** Log stage transition */
  stage(jobId: string | null, stage: string, detail = ''): void {
    writeLine('STAGE', jobId, `${stage}${detail ? ': ' + detail : ''}`)
  },

  /** Get recent log lines for UI display */
  getRecentLines(count = 100): string[] {
    if (!fs.existsSync(LOG_FILE)) return []
    try {
      const content = fs.readFileSync(LOG_FILE, 'utf8')
      const lines = content.trim().split('\n')
      return lines.slice(-count)
    } catch {
      return []
    }
  },

  /** Clear all logs */
  clear(): void {
    try {
      if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE)
      for (let i = 1; i <= MAX_LOG_FILES; i++) {
        const f = `${LOG_FILE}.${i}`
        if (fs.existsSync(f)) fs.unlinkSync(f)
      }
    } catch { /* ignore */ }
  }
}