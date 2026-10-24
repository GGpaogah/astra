import fs from 'node:fs'
import path from 'node:path'
import { Paths } from '../Paths.ts'

/** Journal entry for each install/uninstall operation */
export interface InstallJournalEntry {
  /** Unique job ID: "<type>-<timestamp>-<random>" */
  id: string
  /** Runtime type */
  type: string
  /** Operation kind */
  kind: 'install' | 'uninstall'
  /** Version being installed/uninstalled */
  version: string
  /** Current stage */
  stage: 'downloading' | 'verifying' | 'extracting' | 'moving' | 'done' | 'failed'
  /** ISO timestamp when entry was created */
  createdAt: string
  /** ISO timestamp of last update */
  updatedAt: string
  /** Last error if any: { errno, code, path, message } */
  lastError?: {
    errno?: number
    code?: string
    path?: string
    message: string
  }
  /** Temporary folder path if in progress */
  tempPath?: string
  /** Final destination path */
  destPath?: string
}

const JOURNAL_PATH = path.join(Paths.data, 'installs.json')
const JOURNAL_SCHEMA_VERSION = 1

interface JournalFile {
  schemaVersion: number
  entries: InstallJournalEntry[]
}

/** Generate unique job ID */
function genJobId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Read journal file (returns empty array if missing/corrupt) */
function readJournal(): InstallJournalEntry[] {
  try {
    const content = fs.readFileSync(JOURNAL_PATH, 'utf8')
    const parsed = JSON.parse(content) as JournalFile
    if (parsed.schemaVersion !== JOURNAL_SCHEMA_VERSION) return []
    return Array.isArray(parsed.entries) ? parsed.entries : []
  } catch {
    return []
  }
}

/** Write journal atomically */
function writeJournal(entries: InstallJournalEntry[]): void {
  const tmp = `${JOURNAL_PATH}.tmp`
  const data: JournalFile = {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    entries
  }
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, JOURNAL_PATH)
}

/** Create a new journal entry for an operation */
export function createJournalEntry(
  type: string,
  kind: 'install' | 'uninstall',
  version: string,
  destPath?: string
): InstallJournalEntry {
  const entries = readJournal()
  const now = new Date().toISOString()
  const entry: InstallJournalEntry = {
    id: genJobId(type),
    type,
    kind,
    version,
    stage: kind === 'install' ? 'downloading' : 'moving',
    createdAt: now,
    updatedAt: now,
    destPath
  }
  entries.push(entry)
  writeJournal(entries)
  return entry
}

/** Update journal entry stage/error */
export function updateJournalEntry(
  id: string,
  updates: Partial<Pick<InstallJournalEntry, 'stage' | 'lastError' | 'tempPath' | 'destPath'>>
): void {
  const entries = readJournal()
  const idx = entries.findIndex(e => e.id === id)
  if (idx === -1) return
  entries[idx] = { ...entries[idx], ...updates, updatedAt: new Date().toISOString() }
  writeJournal(entries)
}

/** Get journal entry by ID */
export function getJournalEntry(id: string): InstallJournalEntry | undefined {
  return readJournal().find(e => e.id === id)
}

/** Get all incomplete entries (not done/failed) */
export function getIncompleteEntries(): InstallJournalEntry[] {
  return readJournal().filter(e =>
    !['done', 'failed'].includes(e.stage)
  )
}

/** Mark entry as done or failed */
export function finishJournalEntry(
  id: string,
  success: boolean,
  error?: Error
): void {
  updateJournalEntry(id, {
    stage: success ? 'done' : 'failed',
    lastError: error ? {
      errno: (error as NodeJS.ErrnoException).errno,
      code: (error as NodeJS.ErrnoException).code,
      path: (error as NodeJS.ErrnoException).path,
      message: error.message
    } : undefined
  })
}

/** Remove completed entries older than maxAgeDays (default 7) */
export function pruneJournal(maxAgeDays = 7): number {
  const entries = readJournal()
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  const initialLen = entries.length
  const filtered = entries.filter(e => {
    if (!['done', 'failed'].includes(e.stage)) return true
    const updated = new Date(e.updatedAt).getTime()
    return updated > cutoff
  })
  if (filtered.length !== initialLen) {
    writeJournal(filtered)
  }
  return initialLen - filtered.length
}

/** Cleanup orphan temp/del folders from journal on startup */
export function cleanupOrphanFoldersFromJournal(): void {
  const entries = getIncompleteEntries()
  for (const entry of entries) {
    // Clean temp folder
    if (entry.tempPath && fs.existsSync(entry.tempPath)) {
      try {
        fs.rmSync(entry.tempPath, { recursive: true, force: true })
      } catch { /* ignore */ }
    }
    // Clean __del_ folders
    if (entry.destPath) {
      const base = path.dirname(entry.destPath)
      try {
        const entries2 = fs.readdirSync(base, { withFileTypes: true })
        for (const e of entries2) {
          if (e.isDirectory() && e.name.startsWith('__del_')) {
            try {
              fs.rmSync(path.join(base, e.name), { recursive: true, force: true })
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }
    }
  }
}

/** Also cleanup any __tmp_* and __del_* folders not tracked in journal (legacy) */
export function cleanupLegacyOrphanFolders(): void {
  for (const base of [path.join(Paths.bin, 'php'), path.join(Paths.bin, 'apache'),
    path.join(Paths.bin, 'nginx'), path.join(Paths.bin, 'mariadb'),
    path.join(Paths.bin, 'postgresql'), path.join(Paths.bin, 'nodejs'),
    path.join(Paths.bin, 'python'), path.join(Paths.bin, 'composer')]) {
    if (!fs.existsSync(base)) continue
    try {
      const entries = fs.readdirSync(base, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory() &&
            (e.name.includes('.__tmp_') || e.name.startsWith('__del_'))) {
          try {
            fs.rmSync(path.join(base, e.name), { recursive: true, force: true })
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
}