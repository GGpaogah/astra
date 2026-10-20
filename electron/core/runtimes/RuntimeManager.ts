import fs from 'node:fs'
import path from 'node:path'
import { Paths } from '../Paths.ts'
import { Settings } from '../Settings.ts'
import {
  RUNTIME_DEFINITIONS,
  compareSemver,
  parseSemver,
  type RuntimeType,
  type RuntimeVersionInfo
} from './RuntimeDefinition.ts'

export interface AstraProjectConfig {
  php?: string
  node?: string
  python?: string
  [key: string]: unknown
}

export function isRuntimeType(type: string): type is RuntimeType {
  return Object.prototype.hasOwnProperty.call(RUNTIME_DEFINITIONS, type)
}

export class RuntimeManager {
  public static listTypes(): RuntimeType[] {
    return Object.keys(RUNTIME_DEFINITIONS) as RuntimeType[]
  }

  public static listVersions(type: RuntimeType): RuntimeVersionInfo[] {
    const definition = RUNTIME_DEFINITIONS[type]
    const baseDir = path.join(Paths.bin, definition.folderName)
    if (!fs.existsSync(baseDir)) return []

    const versions: RuntimeVersionInfo[] = []
    if (definition.detect(baseDir)) {
      const versionNumber = this.resolveVersionNumber(baseDir, 'default', definition)
      const info: RuntimeVersionInfo = {
        type,
        folderId: 'default',
        versionNumber,
        label: this.makeLabel(definition.name, versionNumber, 'default/legacy'),
        path: baseDir,
        executablePath: definition.getExecutable(baseDir),
        isLegacy: true,
        isValid: true,
        envPaths: definition.getEnvPaths(baseDir)
      }
      this.enrichMetadata(info, baseDir)
      versions.push(info)
    }

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(baseDir, { withFileTypes: true })
    } catch (error) {
      throw new Error(`Gagal membaca folder runtime ${baseDir}: ${(error as Error).message}`)
    }

    const internalSubdirs = new Set(
      definition.internalSubdirs.map((name) => name.toLowerCase())
    )
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const folderId = entry.name
      if (internalSubdirs.has(folderId.toLowerCase())) continue

      const runtimeDir = path.join(baseDir, folderId)
      if (!definition.detect(runtimeDir)) {
        const isVersionCandidate =
          definition.archivePattern.test(folderId) || /^\d+(?:\.\d+)*$/.test(folderId)
        if (!isVersionCandidate) continue

        versions.push({
          type,
          folderId,
          versionNumber: 'unknown',
          label: `${folderId} (Invalid: marker file missing)`,
          path: runtimeDir,
          executablePath: definition.getExecutable(runtimeDir),
          isLegacy: /^\d+(?:\.\d+)*$/.test(folderId),
          isValid: false,
          invalidReason: `Required marker file(s) missing: ${definition.markerFiles.join(', ')}`,
          envPaths: []
        })
        continue
      }

      const versionNumber = this.resolveVersionNumber(runtimeDir, folderId, definition)
      const info: RuntimeVersionInfo = {
        type,
        folderId,
        versionNumber,
        label: this.makeLabel(definition.name, versionNumber, folderId),
        path: runtimeDir,
        executablePath: definition.getExecutable(runtimeDir),
        isLegacy: /^\d+(?:\.\d+)*$/.test(folderId),
        isValid: true,
        envPaths: definition.getEnvPaths(runtimeDir)
      }
      this.enrichMetadata(info, runtimeDir)
      versions.push(info)
    }

    return versions.sort((left, right) => {
      if (left.isValid !== right.isValid) return left.isValid ? -1 : 1
      return compareSemver(right.versionNumber, left.versionNumber) ||
        left.folderId.localeCompare(right.folderId)
    })
  }

  public static getActive(type: RuntimeType): RuntimeVersionInfo | null {
    const versions = this.listVersions(type).filter((version) => version.isValid)
    if (versions.length === 0) return null

    const settings = Settings.get()
    const runtimes = settings.runtimes ?? {}
    const configuredId = runtimes[type]
    const legacyPhpSetting = type === 'php' && !configuredId && settings.phpVersion
      ? String(settings.phpVersion)
      : undefined
    const targetId = configuredId ?? legacyPhpSetting

    if (targetId) {
      const exactFolder = versions.find((version) => version.folderId === targetId)
      let matched = configuredId
        ? exactFolder
        : exactFolder ?? this.matchVersion(type, targetId)
      if (type === 'php' && legacyPhpSetting && matched && matched.isThreadSafe !== true) {
        const requestedParts = parseSemver(legacyPhpSetting)
        if (requestedParts) {
          matched = versions.find((version) => {
            const versionParts = parseSemver(version.versionNumber)
            return version.isThreadSafe === true &&
              versionParts !== null &&
              requestedParts.every((part, index) => versionParts[index] === part)
          }) ?? matched
        }
      }
      if (matched) {
        if (runtimes[type] !== matched.folderId) {
          Settings.set({ runtimes: { ...runtimes, [type]: matched.folderId } })
        }
        return matched
      }
    }

    const fallback = versions[0]
    const warning = targetId
      ? `Versi runtime "${targetId}" tidak ditemukan; menggunakan ${fallback.folderId}.`
      : undefined
    Settings.set({ runtimes: { ...runtimes, [type]: fallback.folderId } })
    return warning ? { ...fallback, selectionWarning: warning } : fallback
  }

  public static setActive(
    type: RuntimeType,
    folderId: string
  ): { success: boolean; active: RuntimeVersionInfo | null; error?: string } {
    const definition = RUNTIME_DEFINITIONS[type]
    if (!definition) {
      return { success: false, active: null, error: `Tipe runtime "${type}" tidak dikenal` }
    }
    if (
      folderId.trim() === '' ||
      folderId.includes('..') ||
      path.isAbsolute(folderId) ||
      folderId.includes('/') ||
      folderId.includes('\\')
    ) {
      return { success: false, active: null, error: 'folderId harus berupa nama folder yang valid' }
    }

    const version = this.listVersions(type).find(
      (candidate) => candidate.isValid && candidate.folderId === folderId
    )
    if (!version) {
      return {
        success: false,
        active: null,
        error: `Folder versi "${folderId}" tidak ditemukan atau tidak valid untuk ${definition.name}`
      }
    }

    const settings = Settings.get()
    const runtimes = settings.runtimes ?? {}
    Settings.set({
      runtimes: { ...runtimes, [type]: version.folderId },
      ...(type === 'php' ? { phpVersion: version.folderId } : {})
    })
    return { success: true, active: version }
  }

  public static getPath(type: RuntimeType): string | null {
    return this.getActive(type)?.path ?? null
  }

  public static getExecutablePath(type: RuntimeType, executable = 'default'): string | null {
    const active = this.getActive(type)
    if (!active) return null
    if (executable === 'default') return active.executablePath

    const getAuxiliaryExecutables = RUNTIME_DEFINITIONS[type].getAuxiliaryExecutables
    return getAuxiliaryExecutables?.(active.path)[executable] ?? null
  }

  public static matchVersion(type: RuntimeType, spec: string): RuntimeVersionInfo | null {
    const versions = this.listVersions(type).filter((version) => version.isValid)
    const cleanSpec = spec.trim()
    if (!cleanSpec) return null

    const exactFolder = versions.find(
      (version) => version.folderId.toLowerCase() === cleanSpec.toLowerCase()
    )
    if (exactFolder) return exactFolder

    const specParts = parseSemver(cleanSpec)
    if (!specParts) return null

    return versions.find((version) => {
      const versionParts = parseSemver(version.versionNumber)
      return versionParts !== null &&
        specParts.every((part, index) => versionParts[index] === part)
    }) ?? null
  }

  public static readAstraConfig(siteDir: string): AstraProjectConfig | null {
    const filePath = path.join(siteDir, '.astra.json')
    if (!fs.existsSync(filePath)) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch (error) {
      throw new Error(`File .astra.json tidak valid: ${(error as Error).message}`)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('File .astra.json harus berisi objek JSON')
    }

    for (const key of ['php', 'node', 'python']) {
      const value = (parsed as Record<string, unknown>)[key]
      if (value !== undefined && typeof value !== 'string') {
        throw new Error(`Nilai "${key}" di .astra.json harus berupa string`)
      }
    }
    return parsed as AstraProjectConfig
  }

  private static resolveVersionNumber(
    runtimeDir: string,
    folderId: string,
    definition: (typeof RUNTIME_DEFINITIONS)[RuntimeType]
  ): string {
    const folderMatch = folderId.match(definition.versionRegex)
    if (folderMatch?.[1]) return folderMatch[1]
    if (/^\d+(?:\.\d+)*$/.test(folderId)) return folderId

    const executable = definition.getExecutable(runtimeDir)
    if (fs.existsSync(executable) && definition.getVersionFromCli) {
      return definition.getVersionFromCli(executable) ?? 'unknown'
    }
    return 'unknown'
  }

  private static makeLabel(name: string, version: string, suffix: string): string {
    return version === 'unknown'
      ? `${name} (${suffix})`
      : `${name} ${version} (${suffix})`
  }

  private static enrichMetadata(info: RuntimeVersionInfo, runtimeDir: string): void {
    if (info.type !== 'php') return

    const apacheModuleNames = ['php8apache2_4.dll', 'php7apache2_4.dll']
    const moduleName = apacheModuleNames.find((name) => {
      try {
        return fs.statSync(path.join(runtimeDir, name)).isFile()
      } catch {
        return false
      }
    })
    info.isThreadSafe = moduleName !== undefined
    info.apacheModulePath = moduleName ? path.join(runtimeDir, moduleName) : null
    info.isNtsHint = /nts/i.test(info.folderId)
    info.label += moduleName
      ? ` [Thread Safe${info.isNtsHint ? '; NTS name hint only' : ''}]`
      : ' [NTS / PHP-CGI (Nginx)]'
  }
}
