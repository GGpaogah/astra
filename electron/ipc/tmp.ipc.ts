import { ipcMain } from 'electron'
import { TmpCleaner, type TmpCleanResult } from '../core/TmpCleaner.ts'
import { TemplateResolver } from '../core/TemplateResolver.ts'
import { Settings } from '../core/Settings.ts'

export interface TmpSizeResult {
  bytes: number
  formatted: string
}

export interface CopyTemplateResult {
  name: string
  copied: boolean
  /** false = file sudah ada, tidak ditimpa */
  alreadyExists: boolean
}

export function registerTmpIpc(): void {
  /**
   * Kembalikan ukuran tmp/ saat ini.
   */
  ipcMain.handle('tmp:size', (): TmpSizeResult => {
    return TmpCleaner.currentSize()
  })

  /**
   * Bersihkan tmp/ — hapus file sesi & upload lama.
   * Mengembalikan TmpCleanResult.
   */
  ipcMain.handle('tmp:clean', (): TmpCleanResult => {
    const settings = Settings.get()
    const maxDays = settings.tmpSessionMaxAgeDays ?? 7
    const result = TmpCleaner.clean(maxDays)
    console.log(
      `[TmpCleaner] Pembersihan selesai: ${result.totalFiles} file, ${result.freedFormatted} dibebaskan` +
        ` (sesi: ${result.sessionFiles}, upload: ${result.uploadFiles})`
    )
    return result
  })

  /**
   * Salin template bawaan ke usr/tpl/<name>.
   * Validasi nama di dalam TemplateResolver (tidak perlu duplikasi di sini).
   */
  ipcMain.handle('tmp:copy-builtin-template', (_event, name: unknown): CopyTemplateResult => {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Nama template harus berupa string non-kosong')
    }

    const copied = TemplateResolver.copyBuiltinToUser(name)
    return {
      name,
      copied,
      alreadyExists: !copied
    }
  })

  /**
   * Kembalikan daftar nama template bawaan yang tersedia.
   */
  ipcMain.handle('tmp:list-builtin-templates', (): string[] => {
    return TemplateResolver.listBuiltinTemplates()
  })
}
