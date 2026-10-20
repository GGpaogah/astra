import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getAppRoot(): string {
  // Jika app sudah ter-package (produksi), root adalah folder di samping file executable (Astra.exe)
  // BUKAN di dalam app.asar yang bersifat read-only
  if (app && app.isPackaged) {
    return path.dirname(process.execPath)
  }

  // Di dev, file hasil build ada di dist-electron/main.js -> root proyek 1 level ke atas
  // Jika dieksekusi dari electron/core/Paths.ts sebelum bundler -> 2 level ke atas
  const oneUp = path.resolve(__dirname, '..')
  const twoUp = path.resolve(__dirname, '..', '..')

  if (fs.existsSync(path.join(oneUp, 'package.json'))) {
    return oneUp
  }
  if (fs.existsSync(path.join(twoUp, 'package.json'))) {
    return twoUp
  }
  return process.cwd()
}

const root = getAppRoot()

// tmp sub-dirs
const tmp = path.join(root, 'tmp')
const tmpSessions = path.join(tmp, 'sessions')
const tmpUploads = path.join(tmp, 'uploads')

// usr sub-dirs
const usr = path.join(root, 'usr')
const usrTpl = path.join(usr, 'tpl')
const usrBin = path.join(usr, 'bin')

export const Paths = {
  root,
  bin: path.join(root, 'bin'),
  data: path.join(root, 'data'),
  etc: path.join(root, 'etc'),
  logs: path.join(root, 'logs'),
  www: path.join(root, 'www'),
  templates: path.join(root, 'electron', 'templates'),

  // tmp/ — file sementara PHP (session, upload); aman dihapus
  tmp,
  tmpSessions,
  tmpUploads,

  // usr/ — override pengguna (tpl) dan binary tambahan (bin)
  usr,
  usrTpl,
  usrBin,

  ensureDirs(): void {
    const dirsToEnsure = [
      Paths.bin,
      Paths.data,
      Paths.etc,
      Paths.logs,
      Paths.www,
      // tmp sub-dirs
      Paths.tmp,
      Paths.tmpSessions,
      Paths.tmpUploads,
      // usr sub-dirs
      Paths.usr,
      Paths.usrTpl,
      Paths.usrBin,
    ]
    for (const dir of dirsToEnsure) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  },

  getBinPath(...parts: string[]): string {
    return path.join(Paths.bin, ...parts)
  },

  /**
   * Direktori tambahan untuk PATH saat Terminal dijalankan (Fase 10).
   * Mengembalikan [usr/bin] agar binary user-installed tersedia.
   */
  getExtraPathDirs(): string[] {
    return [Paths.usrBin]
  }
} as const

export type PathsType = typeof Paths
