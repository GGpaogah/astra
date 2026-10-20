import fs from 'node:fs'
import path from 'node:path'
import { Paths } from './Paths.ts'
import { Settings } from './Settings.ts'

export interface PhpVersionInfo {
  version: string
  path: string
  hasApacheModule: boolean
  modulePath: string | null
}

export class PhpManager {
  /**
   * Pindai folder bin/php untuk mencari versi PHP Thread Safe yang terpasang
   */
  public static listVersions(): PhpVersionInfo[] {
    const phpRootDir = path.join(Paths.bin, 'php')
    if (!fs.existsSync(phpRootDir)) {
      return []
    }

    const entries = fs.readdirSync(phpRootDir, { withFileTypes: true })
    const versions: PhpVersionInfo[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const versionDir = path.join(phpRootDir, entry.name)
      const phpExe = path.join(versionDir, 'php.exe')

      if (fs.existsSync(phpExe)) {
        // Cek modul Apache (php8apache2_4.dll atau php7apache2_4.dll)
        let modulePath: string | null = null
        const php8Dll = path.join(versionDir, 'php8apache2_4.dll')
        const php7Dll = path.join(versionDir, 'php7apache2_4.dll')

        if (fs.existsSync(php8Dll)) {
          modulePath = php8Dll
        } else if (fs.existsSync(php7Dll)) {
          modulePath = php7Dll
        }

        versions.push({
          version: entry.name,
          path: versionDir,
          hasApacheModule: modulePath !== null,
          modulePath
        })
      }
    }

    // Urutkan versi secara descending (versi tertinggi di atas)
    return versions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
  }

  /**
   * Dapatkan versi PHP yang aktif saat ini dari Settings atau versi terbaru yang tersedia
   */
  public static getActive(): PhpVersionInfo | null {
    const versions = this.listVersions()
    if (versions.length === 0) {
      return null
    }

    const settings = Settings.get()
    if (settings.phpVersion) {
      const match = versions.find((v) => v.version === settings.phpVersion)
      if (match) {
        return match
      }
    }

    // Default ke versi pertama (terbaru) yang memiliki modul Apache, atau versi pertama apa pun
    const defaultVersion = versions.find((v) => v.hasApacheModule) || versions[0]
    Settings.set({ phpVersion: defaultVersion.version })
    return defaultVersion
  }

  /**
   * Set versi PHP aktif
   */
  public static setActive(versionName: string): boolean {
    const versions = this.listVersions()
    const match = versions.find((v) => v.version === versionName)
    if (!match) {
      return false
    }

    Settings.set({ phpVersion: match.version })
    return true
  }
}
