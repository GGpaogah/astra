import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Paths } from './Paths.ts'
import { TemplateResolver } from './TemplateResolver.ts'
import type { RuntimeVersionInfo } from './runtimes/RuntimeDefinition.ts'
import { RuntimeManager } from './runtimes/RuntimeManager.ts'

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
   * Menghasilkan konfigurasi etc/mariadb/my.ini dari template (usr/tpl/my.ini.tpl atau bawaan)
   */
  public static generateMariaDbConfig(port: number): string {
    // Resolusi direktori MariaDB via RuntimeManager
    const mariadbDir = RuntimeManager.getPath('mariadb')
    if (!mariadbDir) {
      throw new Error('Runtime MariaDB aktif tidak ditemukan')
    }
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

    const vars = {
      basedir: this.toIniPath(mariadbDir),
      datadir: this.toIniPath(dataDir),
      port,
      logerror: this.toIniPath(logErrorFile)
    }

    const { rendered, warning } = TemplateResolver.renderTemplate(
      'my.ini.tpl',
      vars,
      this.renderTemplate.bind(this)
    )
    if (warning) {
      console.warn(`[ConfigGenerator] ${warning}`)
    }

    const targetIniPath = path.join(targetDir, 'my.ini')
    fs.writeFileSync(targetIniPath, rendered, 'utf-8')

    return targetIniPath
  }

  /**
   * Menghasilkan konfigurasi etc/php/php.ini dari template (usr/tpl/php.ini.tpl atau bawaan)
   * Folder tmp/sessions dan tmp/uploads dipastikan ada sebelum dikonfigurasi ke php.ini.
   */
  public static generatePhpConfig(phpInfo: RuntimeVersionInfo): string {
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

    // Pastikan folder tmp ada sebelum dikonfigurasi
    if (!fs.existsSync(Paths.tmp)) {
      fs.mkdirSync(Paths.tmp, { recursive: true })
    }

    const logErrorFile = path.join(logsPhpDir, 'error.log')

    const vars = {
      extensiondir: this.toIniPath(extDir),
      extensions: extensionLines.join('\n'),
      errorlog: this.toIniPath(logErrorFile),
      session_save_path: this.toIniPath(Paths.tmp),
      upload_tmp_dir: this.toIniPath(Paths.tmp),
      sys_temp_dir: this.toIniPath(Paths.tmp)
    }

    const { rendered, warning } = TemplateResolver.renderTemplate(
      'php.ini.tpl',
      vars,
      this.renderTemplate.bind(this)
    )
    if (warning) {
      console.warn(`[ConfigGenerator] ${warning}`)
    }

    const targetIniPath = path.join(targetDir, 'php.ini')
    fs.writeFileSync(targetIniPath, rendered, 'utf-8')

    return targetIniPath
  }

  /**
   * Menghasilkan konfigurasi etc/apache/httpd.conf dari template (usr/tpl/httpd.conf.tpl atau bawaan)
   */
  public static generateApacheConfig(port: number, phpInfo: RuntimeVersionInfo): string {
    if (!phpInfo.apacheModulePath || !fs.existsSync(phpInfo.apacheModulePath)) {
      throw new Error(`Apache module DLL untuk PHP ${phpInfo.folderId} tidak ditemukan`)
    }

    // Resolusi direktori Apache via RuntimeManager
    const srvRoot = RuntimeManager.getPath('apache')
    if (!srvRoot) {
      throw new Error('Runtime Apache aktif tidak ditemukan')
    }
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

    const vars = {
      srvroot: this.toIniPath(srvRoot),
      port,
      phpmodule: this.toIniPath(phpInfo.apacheModulePath),
      phpinidir: this.toIniPath(phpIniDir),
      documentroot: this.toIniPath(documentRoot),
      errorlog: this.toIniPath(errorLogFile),
      accesslog: this.toIniPath(accessLogFile),
      pidfile: this.toIniPath(pidFile),
      vhostsdir: this.toIniPath(vhostsDir)
    }

    const { rendered, warning } = TemplateResolver.renderTemplate(
      'httpd.conf.tpl',
      vars,
      this.renderTemplate.bind(this)
    )
    if (warning) {
      console.warn(`[ConfigGenerator] ${warning}`)
    }

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
