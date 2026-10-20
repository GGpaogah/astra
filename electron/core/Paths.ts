import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getAppRoot(): string {
  // Produksi: root adalah folder di samping Astra.exe (bukan di dalam app.asar)
  if (app && app.isPackaged) {
    return path.dirname(process.execPath)
  }

  // Dev: dist-electron/main.js -> satu level ke atas = root proyek
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

/**
 * Lokasi template .tpl:
 * - Dev       : <root>/electron/templates/
 * - Packaged  : process.resourcesPath/electron/templates/
 *   Template tidak masuk app.asar (read-only), dikemas via extraResources di electron-builder.
 */
function getTemplatesDir(appRoot: string): string {
  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, 'electron', 'templates')
  }
  return path.join(appRoot, 'electron', 'templates')
}

/**
 * Lokasi skrip helper (PowerShell, dll.) yang dijalankan di luar Electron:
 * - Dev       : <root>/electron/helpers/
 * - Packaged  : process.resourcesPath/electron/helpers/
 *   Harus di-copy via extraResources karena tidak masuk app.asar.
 */
function getHelpersDir(appRoot: string): string {
  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, 'electron', 'helpers')
  }
  return path.join(appRoot, 'electron', 'helpers')
}

const root = getAppRoot()

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

  /**
   * Folder template bawaan .tpl.
   * Dev: electron/templates/ di repo.
   * Packaged: process.resourcesPath/electron/templates/ (via extraResources).
   */
  templates: getTemplatesDir(root),

  /**
   * Folder skrip helper (PowerShell, dll.) yang dijalankan di luar Electron.
   * Dev: electron/helpers/ di repo.
   * Packaged: process.resourcesPath/electron/helpers/ (via extraResources).
   */
  helpers: getHelpersDir(root),

  // tmp/ — file sementara PHP (sess_*, upload); flat seperti Laragon
  tmp: path.join(root, 'tmp'),

  // data/downloads/ — arsip runtime yang sedang/sudah diunduh
  downloads: path.join(root, 'data', 'downloads'),

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
      Paths.tmp,
      Paths.downloads,
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
