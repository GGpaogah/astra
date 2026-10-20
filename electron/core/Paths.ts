import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getAppRoot(): string {
  if (app && app.isPackaged) {
    return path.dirname(app.getAppPath())
  }
  // Di dev, file hasil build ada di dist-electron/main.js -> root proyek 1 level ke atas
  // Jika dieksekusi dari electron/core/Paths.ts sebelum bundler -> 2 level ke atas
  const oneUp = path.resolve(__dirname, '..')
  const twoUp = path.resolve(__dirname, '..', '..')

  // Cek package.json untuk menentukan root proyek yang sebenarnya
  if (fs.existsSync(path.join(oneUp, 'package.json'))) {
    return oneUp
  }
  if (fs.existsSync(path.join(twoUp, 'package.json'))) {
    return twoUp
  }
  return process.cwd()
}

const root = getAppRoot()

export const Paths = {
  root,
  bin: path.join(root, 'bin'),
  data: path.join(root, 'data'),
  etc: path.join(root, 'etc'),
  logs: path.join(root, 'logs'),
  www: path.join(root, 'www'),
  templates: path.join(root, 'electron', 'templates'),

  ensureDirs(): void {
    const dirsToEnsure = [
      Paths.bin,
      Paths.data,
      Paths.etc,
      Paths.logs,
      Paths.www
    ]
    for (const dir of dirsToEnsure) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  },

  getBinPath(...parts: string[]): string {
    return path.join(Paths.bin, ...parts)
  }
} as const

export type PathsType = typeof Paths
