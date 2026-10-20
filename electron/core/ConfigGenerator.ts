import fs from 'node:fs'
import path from 'node:path'
import { Paths } from './Paths.ts'

export class ConfigGenerator {
  /**
   * Helper mengubah path Windows (\) menjadi format forward slash (/) untuk file konfigurasi .ini
   */
  public static toIniPath(filePath: string): string {
    return filePath.replace(/\\/g, '/')
  }

  /**
   * Merender string template dengan mengganti placeholder {{key}}
   */
  public static renderTemplate(
    templateContent: string,
    vars: Record<string, string | number>
  ): string {
    let result = templateContent
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      result = result.replace(regex, String(value))
    }
    return result
  }

  /**
   * Menghasilkan konfigurasi etc/mariadb/my.ini dari template electron/templates/my.ini.tpl
   */
  public static generateMariaDbConfig(port: number): string {
    const templatePath = path.join(Paths.templates, 'my.ini.tpl')
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`)
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8')

    const baseDir = path.join(Paths.bin, 'mariadb')
    const dataDir = path.join(Paths.data, 'mysql')
    const logErrorFile = path.join(Paths.logs, 'mariadb', 'error.log')

    // Pastikan folder etc/mariadb dan logs/mariadb ada
    const targetDir = path.join(Paths.etc, 'mariadb')
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const logsMariaDbDir = path.join(Paths.logs, 'mariadb')
    if (!fs.existsSync(logsMariaDbDir)) {
      fs.mkdirSync(logsMariaDbDir, { recursive: true })
    }

    const rendered = this.renderTemplate(templateContent, {
      basedir: this.toIniPath(baseDir),
      datadir: this.toIniPath(dataDir),
      port,
      logerror: this.toIniPath(logErrorFile)
    })

    const targetIniPath = path.join(targetDir, 'my.ini')
    fs.writeFileSync(targetIniPath, rendered, 'utf-8')

    return targetIniPath
  }
}

