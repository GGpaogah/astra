import fs from 'node:fs'
import path from 'node:path'
import { Paths } from './Paths.ts'

/**
 * Karakter yang tidak diizinkan dalam nama template (cegah path traversal).
 * Nama template harus berupa nama file sederhana, tanpa separator direktori
 * dan tanpa segmen "..".
 */
const FORBIDDEN_PATTERN = /[/\\]|\.\./

/**
 * Validasi nama template: hanya nama file sederhana (e.g. "php.ini.tpl").
 * Throws jika nama tidak valid.
 */
function validateTemplateName(name: string): void {
  if (!name || FORBIDDEN_PATTERN.test(name)) {
    throw new Error(
      `Nama template tidak valid: "${name}". Gunakan nama file sederhana tanpa path separator atau "..".`
    )
  }
}

/**
 * TemplateResolver: resolusi template dengan urutan prioritas:
 *   1. usr/tpl/<name>   — override pengguna
 *   2. electron/templates/<name>  — template bawaan
 *
 * Jika template pengguna gagal dirender (placeholder tidak dikenal atau error),
 * jatuh kembali ke template bawaan dan log peringatan.
 */
export class TemplateResolver {
  /**
   * Membaca konten template.
   * Selalu mengembalikan { content, isUserTemplate, resolvedPath }.
   */
  public static readTemplate(name: string): {
    content: string
    isUserTemplate: boolean
    resolvedPath: string
  } {
    validateTemplateName(name)

    const userPath = path.join(Paths.usrTpl, name)
    const builtinPath = path.join(Paths.templates, name)

    if (fs.existsSync(userPath)) {
      try {
        const content = fs.readFileSync(userPath, 'utf-8')
        return { content, isUserTemplate: true, resolvedPath: userPath }
      } catch (err) {
        console.warn(
          `[TemplateResolver] Gagal membaca template pengguna "${name}" di ${userPath}:`,
          err
        )
        // fall through ke template bawaan
      }
    }

    if (!fs.existsSync(builtinPath)) {
      throw new Error(`Template bawaan tidak ditemukan: ${builtinPath}`)
    }

    const content = fs.readFileSync(builtinPath, 'utf-8')
    return { content, isUserTemplate: false, resolvedPath: builtinPath }
  }

  /**
   * Merender template dengan variabel yang diberikan.
   * Jika template pengguna menyebabkan error render (misal: placeholder tidak dikenal),
   * fallback ke template bawaan dan kembalikan pesan peringatan.
   *
   * @returns { rendered, warning } — warning berisi pesan jika fallback terjadi
   */
  public static renderTemplate(
    name: string,
    vars: Record<string, string | number>,
    renderFn: (content: string, v: Record<string, string | number>) => string
  ): { rendered: string; warning?: string } {
    validateTemplateName(name)

    const { content, isUserTemplate, resolvedPath } = this.readTemplate(name)

    if (isUserTemplate) {
      try {
        const rendered = renderFn(content, vars)
        // Periksa apakah ada placeholder yang tidak tergantikan
        const unresolved = rendered.match(/\{\{[^}]+\}\}/g)
        if (unresolved && unresolved.length > 0) {
          throw new Error(
            `Placeholder tidak dikenal dalam template pengguna: ${unresolved.join(', ')}`
          )
        }
        return { rendered }
      } catch (err) {
        const warningMsg = `Template pengguna "${name}" (${resolvedPath}) gagal dirender: ${(err as Error).message}. Menggunakan template bawaan.`
        console.warn(`[TemplateResolver] ${warningMsg}`)

        // Fallback ke template bawaan
        const builtinPath = path.join(Paths.templates, name)
        if (!fs.existsSync(builtinPath)) {
          throw new Error(`Template bawaan juga tidak ditemukan saat fallback: ${builtinPath}`)
        }
        const builtinContent = fs.readFileSync(builtinPath, 'utf-8')
        const rendered = renderFn(builtinContent, vars)
        return { rendered, warning: warningMsg }
      }
    }

    const rendered = renderFn(content, vars)
    return { rendered }
  }

  /**
   * Menyalin template bawaan ke usr/tpl/<name>.
   * Tidak menimpa file yang sudah ada (safe copy).
   *
   * @returns true jika disalin, false jika sudah ada (tidak ditimpa)
   */
  public static copyBuiltinToUser(name: string): boolean {
    validateTemplateName(name)

    const builtinPath = path.join(Paths.templates, name)
    if (!fs.existsSync(builtinPath)) {
      throw new Error(`Template bawaan tidak ditemukan: ${builtinPath}`)
    }

    const userPath = path.join(Paths.usrTpl, name)
    if (fs.existsSync(userPath)) {
      // Sudah ada — tidak menimpa
      return false
    }

    // Pastikan folder usr/tpl ada
    if (!fs.existsSync(Paths.usrTpl)) {
      fs.mkdirSync(Paths.usrTpl, { recursive: true })
    }

    fs.copyFileSync(builtinPath, userPath)
    return true
  }

  /**
   * Mengembalikan daftar nama template bawaan yang tersedia.
   */
  public static listBuiltinTemplates(): string[] {
    if (!fs.existsSync(Paths.templates)) return []
    return fs.readdirSync(Paths.templates).filter((f) => f.endsWith('.tpl'))
  }
}
