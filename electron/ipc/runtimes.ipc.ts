import { ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { RuntimeManager, isRuntimeType } from '../core/runtimes/RuntimeManager.ts'
import { RUNTIME_DEFINITIONS } from '../core/runtimes/RuntimeDefinition.ts'
import { serviceManager } from '../core/ServiceManager.ts'
import { Settings } from '../core/Settings.ts'
import { Paths } from '../core/Paths.ts'

function listRuntimeGroups() {
  return RuntimeManager.listTypes().map((type) => ({
    type,
    name: RUNTIME_DEFINITIONS[type].name,
    folderName: RUNTIME_DEFINITIONS[type].folderName,
    versions: RuntimeManager.listVersions(type),
    active: RuntimeManager.getActive(type)
  }))
}

function assertRuntimeType(type: unknown): asserts type is ReturnType<typeof RuntimeManager.listTypes>[number] {
  if (typeof type !== 'string' || !isRuntimeType(type)) {
    throw new Error(`Tipe runtime "${String(type)}" tidak valid`)
  }
}

export function registerRuntimesIpc(): void {
  ipcMain.handle('runtimes:list', () => listRuntimeGroups())
  ipcMain.handle('runtimes:refresh', () => listRuntimeGroups())

  ipcMain.handle('runtimes:get-preferences', () => ({
    autoRestartOnRuntimeChange: Settings.get().autoRestartOnRuntimeChange ?? false
  }))

  ipcMain.handle('runtimes:set-auto-restart', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') {
      throw new Error('Opsi restart otomatis harus berupa boolean')
    }
    const settings = Settings.set({ autoRestartOnRuntimeChange: enabled })
    return { autoRestartOnRuntimeChange: settings.autoRestartOnRuntimeChange ?? false }
  })

  ipcMain.handle('runtimes:set-active', async (_event, type: unknown, folderId: unknown) => {
    assertRuntimeType(type)
    if (typeof folderId !== 'string') {
      throw new Error('folderId harus berupa string')
    }

    const runtimeType = type
    const selected = RuntimeManager.listVersions(runtimeType).find(
      (version) => version.folderId === folderId && version.isValid
    )
    if (!selected) {
      throw new Error(`Versi "${folderId}" tidak ada dalam hasil scan valid ${runtimeType}`)
    }
    if (runtimeType === 'php' && selected.isThreadSafe !== true) {
      throw new Error('Build PHP ini tidak memiliki modul Apache; pilih PHP Thread Safe untuk Apache.')
    }

    const result = RuntimeManager.setActive(runtimeType, folderId)
    if (!result.success || !result.active) {
      throw new Error(result.error || 'Gagal mengubah versi runtime')
    }

    const settings = Settings.get()
    const autoRestart = settings.autoRestartOnRuntimeChange ?? false
    const serviceName = runtimeType === 'php' || runtimeType === 'apache'
      ? 'apache'
      : runtimeType === 'mariadb'
        ? 'mariadb'
        : null
    const service = serviceName ? serviceManager.get(serviceName) : undefined
    let restarted = false
    let restartRequired: string | null = null

    if (service && service.getStatus() === 'running') {
      if (autoRestart) {
        await service.restart()
        restarted = true
      } else {
        restartRequired = serviceName
      }
    }

    return {
      active: result.active,
      restarted,
      restartRequired,
      message: restartRequired
        ? `${serviceName} sedang berjalan. Restart agar runtime baru digunakan.`
        : null
    }
  })

  ipcMain.handle('runtimes:open-folder', async (_event, type: unknown, folderId?: unknown) => {
    assertRuntimeType(type)
    const definition = RUNTIME_DEFINITIONS[type]
    const basePath = path.join(Paths.bin, definition.folderName)
    let targetPath = basePath

    if (folderId !== undefined) {
      if (
        typeof folderId !== 'string' ||
        folderId.trim() === '' ||
        folderId.includes('..') ||
        path.isAbsolute(folderId) ||
        folderId.includes('/') ||
        folderId.includes('\\')
      ) {
        throw new Error('folderId harus berupa nama folder runtime yang valid')
      }
      if (folderId !== 'default') {
        const knownFolder = RuntimeManager.listVersions(type).some(
          (version) => version.folderId === folderId
        )
        if (!knownFolder) throw new Error('Folder runtime tidak ditemukan dalam hasil scan')
        targetPath = path.join(basePath, folderId)
      }
    }

    const relativePath = path.relative(Paths.bin, targetPath)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Akses path di luar folder bin ditolak')
    }

    if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true })
    const realBinPath = fs.realpathSync(Paths.bin)
    const realBasePath = fs.realpathSync(basePath)
    const relativeBasePath = path.relative(realBinPath, realBasePath)
    if (relativeBasePath.startsWith('..') || path.isAbsolute(relativeBasePath)) {
      throw new Error('Folder runtime berada di luar folder bin')
    }

    if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath)
    const realTargetPath = fs.realpathSync(targetPath)
    const relativeTargetPath = path.relative(realBinPath, realTargetPath)
    if (relativeTargetPath.startsWith('..') || path.isAbsolute(relativeTargetPath)) {
      throw new Error('Akses folder runtime di luar bin ditolak')
    }

    const openError = await shell.openPath(realTargetPath)
    if (openError) throw new Error(`Gagal membuka folder runtime: ${openError}`)
    return true
  })
}
