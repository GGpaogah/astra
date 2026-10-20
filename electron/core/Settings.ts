import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Paths } from './Paths.ts'

export interface AstraSettingsData {
  phpVersion?: string
  mariadbPort?: number
  apachePort?: number
  mariadbAdminUser?: string
  mariadbAdminPassword?: string
  runtimes?: Record<string, string> // mapping: runtimeType -> folderId aktif
  autoRestartOnRuntimeChange?: boolean
  /** Usia maksimum file sesi PHP (hari) sebelum dibersihkan. Default: 7 */
  tmpSessionMaxAgeDays?: number
  /**
   * Versi konkret yang terakhir di-resolve per runtime+channel.
   * Hanya metadata informasional untuk UI (Fase 6B). Tidak mempengaruhi versi aktif.
   * Format: { "php:stable": "8.3.16", "node:lts": "20.19.0" }
   */
  resolvedVersions?: Record<string, string>
  [key: string]: unknown
}

export class Settings {
  private static filePath = path.join(Paths.data, 'astra-settings.json')

  private static defaultSettings(): AstraSettingsData {
    return {
      mariadbPort: 3306,
      apachePort: 80,
      mariadbAdminUser: 'astra_admin',
      mariadbAdminPassword: crypto.randomBytes(16).toString('hex'),
      runtimes: {},
      autoRestartOnRuntimeChange: false,
      tmpSessionMaxAgeDays: 7
    }
  }

  public static get(): AstraSettingsData {
    try {
      if (!fs.existsSync(this.filePath)) {
        const defaults = this.defaultSettings()
        this.set(defaults)
        return defaults
      }

      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as AstraSettingsData

      // Pastikan kredensial admin MariaDB selalu ada
      let modified = false
      if (!parsed.mariadbAdminUser) {
        parsed.mariadbAdminUser = 'astra_admin'
        modified = true
      }
      if (!parsed.mariadbAdminPassword) {
        parsed.mariadbAdminPassword = crypto.randomBytes(16).toString('hex')
        modified = true
      }
      if (!parsed.runtimes) {
        parsed.runtimes = {}
        modified = true
      }
      if (typeof parsed.autoRestartOnRuntimeChange !== 'boolean') {
        parsed.autoRestartOnRuntimeChange = false
        modified = true
      }
      if (typeof parsed.tmpSessionMaxAgeDays !== 'number' || parsed.tmpSessionMaxAgeDays < 1) {
        parsed.tmpSessionMaxAgeDays = 7
        modified = true
      }

      if (modified) {
        this.set(parsed)
      }

      return parsed
    } catch {
      // Jika file JSON rusak/corrupt, fallback ke default tanpa crash
      const defaults = this.defaultSettings()
      try {
        this.set(defaults)
      } catch {
        // Abaikan error penulisan fallback
      }
      return defaults
    }
  }

  public static set(newSettings: Partial<AstraSettingsData>): AstraSettingsData {
    let current: AstraSettingsData
    try {
      if (fs.existsSync(this.filePath)) {
        current = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as AstraSettingsData
      } else {
        current = this.defaultSettings()
      }
    } catch {
      current = this.defaultSettings()
    }

    const updated = { ...current, ...newSettings }

    // Pastikan folder data ada
    if (!fs.existsSync(Paths.data)) {
      fs.mkdirSync(Paths.data, { recursive: true })
    }

    // Tulis atomik: tulis file temporary lalu rename
    const tempPath = `${this.filePath}.${Date.now()}.tmp`
    fs.writeFileSync(tempPath, JSON.stringify(updated, null, 2), 'utf-8')
    fs.renameSync(tempPath, this.filePath)

    return updated
  }
}
