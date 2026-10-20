import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Paths } from './Paths.ts'
import type { PhpVersionInfo } from './PhpManager.ts'

export class ConfigGenerator {
  /**
   * Helper mengubah path Windows (\) menjadi format forward slash (/) untuk file konfigurasi
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

  /**
   * Menghasilkan konfigurasi etc/php/php.ini dari template electron/templates/php.ini.tpl
   */
  public static generatePhpConfig(phpInfo: PhpVersionInfo): string {
    const templatePath = path.join(Paths.templates, 'php.ini.tpl')
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`)
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8')
    const extDir = path.join(phpInfo.path, 'ext')

    // Daftar ekstensi yang disarankan
    const candidateExtensions = [
      'curl',
      'fileinfo',
      'gd',
      'intl',
      'mbstring',
      'mysqli',
      'openssl',
      'pdo_mysql',
      'zip'
    ]

    // Aktifkan ekstensi hanya jika file DLL ada di ext/
    const extensionLines: string[] = []
    for (const ext of candidateExtensions) {
      const dllName = `php_${ext}.dll`
      const dllPath = path.join(extDir, dllName)
      if (fs.existsSync(dllPath)) {
        extensionLines.push(`extension=${ext}`)
      } else {
        extensionLines.push(`;extension=${ext} ; (php_${ext}.dll tidak ditemukan di ext/)`)
      }
    }

    const targetDir = path.join(Paths.etc, 'php')
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const logsPhpDir = path.join(Paths.logs, 'php')
    if (!fs.existsSync(logsPhpDir)) {
      fs.mkdirSync(logsPhpDir, { recursive: true })
    }

    const logErrorFile = path.join(logsPhpDir, 'error.log')

    const rendered = this.renderTemplate(templateContent, {
      extensiondir: this.toIniPath(extDir),
      extensions: extensionLines.join('\n'),
      errorlog: this.toIniPath(logErrorFile)
    })

    const targetIniPath = path.join(targetDir, 'php.ini')
    fs.writeFileSync(targetIniPath, rendered, 'utf-8')

    return targetIniPath
  }

  /**
   * Menghasilkan konfigurasi etc/apache/httpd.conf dari template electron/templates/httpd.conf.tpl
   */
  public static generateApacheConfig(port: number, phpInfo: PhpVersionInfo): string {
    const templatePath = path.join(Paths.templates, 'httpd.conf.tpl')
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found at: ${templatePath}`)
    }

    if (!phpInfo.modulePath || !fs.existsSync(phpInfo.modulePath)) {
      throw new Error(`Apache module DLL untuk PHP ${phpInfo.version} tidak ditemukan`)
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8')

    const srvRoot = path.join(Paths.bin, 'apache')
    const documentRoot = Paths.www
    const phpIniDir = path.join(Paths.etc, 'php')

    const targetDir = path.join(Paths.etc, 'apache')
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const vhostsDir = path.join(targetDir, 'vhosts')
    if (!fs.existsSync(vhostsDir)) {
      fs.mkdirSync(vhostsDir, { recursive: true })
    }

    const logsApacheDir = path.join(Paths.logs, 'apache')
    if (!fs.existsSync(logsApacheDir)) {
      fs.mkdirSync(logsApacheDir, { recursive: true })
    }

    const errorLogFile = path.join(logsApacheDir, 'error.log')
    const accessLogFile = path.join(logsApacheDir, 'access.log')
    const pidFile = path.join(targetDir, 'httpd.pid')

    const rendered = this.renderTemplate(templateContent, {
      srvroot: this.toIniPath(srvRoot),
      port,
      phpmodule: this.toIniPath(phpInfo.modulePath),
      phpinidir: this.toIniPath(phpIniDir),
      documentroot: this.toIniPath(documentRoot),
      errorlog: this.toIniPath(errorLogFile),
      accesslog: this.toIniPath(accessLogFile),
      pidfile: this.toIniPath(pidFile),
      vhostsdir: this.toIniPath(vhostsDir)
    })

    const targetConfPath = path.join(targetDir, 'httpd.conf')
    fs.writeFileSync(targetConfPath, rendered, 'utf-8')

    return targetConfPath
  }

  /**
   * Menghasilkan file konfigurasi www/phpmyadmin/config.inc.php jika belum ada
   */
  public static generatePhpMyAdminConfig(dbPort: number): boolean {
    const pmaDir = path.join(Paths.www, 'phpmyadmin')
    if (!fs.existsSync(pmaDir)) {
      return false
    }

    const configFile = path.join(pmaDir, 'config.inc.php')
    if (fs.existsSync(configFile)) {
      return false
    }

    const secret = crypto.randomBytes(16).toString('hex') // 32 chars hex string

    const content = `<?php
/**
 * Konfigurasi otomatis Astra untuk phpMyAdmin
 */
declare(strict_types=1);

$cfg['blowfish_secret'] = '${secret}';

$i = 0;
$i++;
$cfg['Servers'][$i]['auth_type'] = 'cookie';
$cfg['Servers'][$i]['host'] = '127.0.0.1';
$cfg['Servers'][$i]['port'] = '${dbPort}';
$cfg['Servers'][$i]['compress'] = false;
$cfg['Servers'][$i]['AllowNoPassword'] = true;

$cfg['UploadDir'] = '';
$cfg['SaveDir'] = '';
`

    fs.writeFileSync(configFile, content, 'utf-8')
    return true
  }
}
