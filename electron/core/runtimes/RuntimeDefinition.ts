import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export type RuntimeType =
  | 'php'
  | 'apache'
  | 'nginx'
  | 'mariadb'
  | 'postgresql'
  | 'node'
  | 'python'
  | 'composer'

export interface RuntimeVersionInfo {
  type: RuntimeType
  folderId: string
  versionNumber: string
  label: string
  path: string
  executablePath: string
  isLegacy: boolean
  isValid: boolean
  invalidReason?: string
  selectionWarning?: string
  isThreadSafe?: boolean
  isNtsHint?: boolean
  apacheModulePath?: string | null
  envPaths: string[]
}

export interface RuntimeDefinition {
  type: RuntimeType
  name: string
  folderName: string
  markerFiles: string[]
  versionRegex: RegExp
  archivePattern: RegExp
  internalSubdirs: string[]
  detect: (runtimeDir: string) => boolean
  getExecutable: (runtimeDir: string) => string
  getAuxiliaryExecutables?: (runtimeDir: string) => Record<string, string>
  getVersionFromCli?: (exePath: string) => string | null
  getEnvPaths: (runtimeDir: string) => string[]
}

const commonInternalSubdirs = [
  'bin',
  'conf',
  'modules',
  'logs',
  'share',
  'lib',
  'include',
  'data',
  'doc',
  'docs',
  'ext',
  'extras',
  'dev',
  'cgi-bin',
  'error',
  'icons',
  'manual',
  'temp',
  'html',
  'symbols',
  'scripts',
  'lib64'
]

function hasMarkers(runtimeDir: string, markerFiles: string[]): boolean {
  return markerFiles.every((marker) => {
    try {
      return fs.statSync(path.join(runtimeDir, marker)).isFile()
    } catch {
      return false
    }
  })
}

function readVersionFromCli(
  executablePath: string,
  args: string[],
  expression: RegExp,
  useStderr = false
): string | null {
  try {
    const result = spawnSync(executablePath, args, {
      timeout: 3000,
      windowsHide: true,
      shell: false,
      encoding: 'utf8'
    })
    if (result.error || result.status !== 0) return null
    const output = useStderr ? result.stderr || result.stdout : result.stdout || result.stderr
    return output.match(expression)?.[1] ?? null
  } catch {
    return null
  }
}

function defineRuntime(
  definition: Omit<RuntimeDefinition, 'detect' | 'internalSubdirs'> & {
    internalSubdirs?: string[]
  }
): RuntimeDefinition {
  return {
    ...definition,
    internalSubdirs: definition.internalSubdirs ?? commonInternalSubdirs,
    detect: (runtimeDir) => hasMarkers(runtimeDir, definition.markerFiles)
  }
}

export const RUNTIME_DEFINITIONS: Record<RuntimeType, RuntimeDefinition> = {
  php: defineRuntime({
    type: 'php',
    name: 'PHP',
    folderName: 'php',
    markerFiles: ['php.exe'],
    versionRegex: /php-(\d+\.\d+\.\d+)/i,
    archivePattern: /^php-\d+\.\d+\.\d+(?:-.+)?$/i,
    getExecutable: (dir) => path.join(dir, 'php.exe'),
    getVersionFromCli: (exe) =>
      readVersionFromCli(exe, ['--version'], /PHP\s+(\d+\.\d+(?:\.\d+)?)/i),
    getEnvPaths: (dir) => [dir]
  }),
  apache: defineRuntime({
    type: 'apache',
    name: 'Apache',
    folderName: 'apache',
    markerFiles: [path.join('bin', 'httpd.exe')],
    versionRegex: /httpd-(\d+\.\d+\.\d+)/i,
    archivePattern: /^httpd-\d+\.\d+\.\d+(?:-.+)?$/i,
    getExecutable: (dir) => path.join(dir, 'bin', 'httpd.exe'),
    getVersionFromCli: (exe) =>
      readVersionFromCli(exe, ['-v'], /Apache\/(\d+\.\d+(?:\.\d+)?)/i),
    getEnvPaths: (dir) => [path.join(dir, 'bin')]
  }),
  nginx: defineRuntime({
    type: 'nginx',
    name: 'Nginx',
    folderName: 'nginx',
    markerFiles: ['nginx.exe'],
    versionRegex: /nginx-(\d+\.\d+\.\d+)/i,
    archivePattern: /^nginx-\d+\.\d+\.\d+(?:-.+)?$/i,
    getExecutable: (dir) => path.join(dir, 'nginx.exe'),
    getVersionFromCli: (exe) =>
      readVersionFromCli(exe, ['-v'], /nginx\/(\d+\.\d+(?:\.\d+)?)/i, true),
    getEnvPaths: (dir) => [dir]
  }),
  mariadb: defineRuntime({
    type: 'mariadb',
    name: 'MariaDB',
    folderName: 'mariadb',
    markerFiles: [path.join('bin', 'mariadbd.exe')],
    versionRegex: /mariadb-(\d+\.\d+\.\d+)/i,
    archivePattern: /^mariadb-\d+\.\d+\.\d+(?:-.+)?$/i,
    getExecutable: (dir) => path.join(dir, 'bin', 'mariadbd.exe'),
    getAuxiliaryExecutables: (dir) => ({
      admin: path.join(dir, 'bin', 'mariadb-admin.exe'),
      installDb: path.join(dir, 'bin', 'mariadb-install-db.exe')
    }),
    getVersionFromCli: (exe) =>
      readVersionFromCli(exe, ['--version'], /(\d+\.\d+(?:\.\d+)?)-MariaDB/i),
    getEnvPaths: (dir) => [path.join(dir, 'bin')]
  }),
  postgresql: defineRuntime({
    type: 'postgresql',
    name: 'PostgreSQL',
    folderName: 'postgresql',
    markerFiles: [
      path.join('bin', 'postgres.exe'),
      path.join('bin', 'initdb.exe'),
      path.join('bin', 'pg_ctl.exe')
    ],
    versionRegex: /postgresql-(\d+(?:\.\d+)*)/i,
    archivePattern: /^postgresql-\d+(?:\.\d+)*(?:-.+)?$/i,
    getExecutable: (dir) => path.join(dir, 'bin', 'postgres.exe'),
    getVersionFromCli: (exe) =>
      readVersionFromCli(exe, ['--version'], /postgres\s+\(PostgreSQL\)\s+(\d+(?:\.\d+)*)/i),
    getEnvPaths: (dir) => [path.join(dir, 'bin')]
  }),
  node: defineRuntime({
    type: 'node',
    name: 'Node.js',
    folderName: 'nodejs',
    markerFiles: ['node.exe'],
    versionRegex: /node-v(\d+\.\d+\.\d+)/i,
    archivePattern: /^node-v\d+\.\d+\.\d+(?:-.+)?$/i,
    getExecutable: (dir) => path.join(dir, 'node.exe'),
    getVersionFromCli: (exe) =>
      readVersionFromCli(exe, ['--version'], /^v?(\d+\.\d+(?:\.\d+)?)/im),
    getEnvPaths: (dir) => [dir]
  }),
  python: defineRuntime({
    type: 'python',
    name: 'Python',
    folderName: 'python',
    markerFiles: ['python.exe'],
    versionRegex: /python-(\d+\.\d+\.\d+)/i,
    archivePattern: /^python-\d+\.\d+\.\d+(?:-.+)?$/i,
    getExecutable: (dir) => path.join(dir, 'python.exe'),
    getVersionFromCli: (exe) =>
      readVersionFromCli(exe, ['--version'], /Python\s+(\d+\.\d+(?:\.\d+)?)/i),
    getEnvPaths: (dir) => [dir, path.join(dir, 'Scripts')]
  }),
  composer: defineRuntime({
    type: 'composer',
    name: 'Composer',
    folderName: 'composer',
    markerFiles: ['composer.phar'],
    versionRegex: /composer-(\d+(?:\.\d+)*)/i,
    archivePattern: /^composer-\d+(?:\.\d+)*(?:-.+)?$/i,
    getExecutable: (dir) => path.join(dir, 'composer.phar'),
    getVersionFromCli: (exe) =>
      readVersionFromCli(exe, ['--version'], /Composer version\s+(\d+(?:\.\d+)*)/i),
    getEnvPaths: (dir) => [dir]
  })
}

export function parseSemver(version: string): number[] | null {
  const clean = version.trim().replace(/^v/i, '')
  if (!/^\d+(?:\.\d+)*$/.test(clean)) return null
  return clean.split('.').map(Number)
}

export function compareSemver(versionA: string, versionB: string): number {
  const partsA = parseSemver(versionA)
  const partsB = parseSemver(versionB)
  if (partsA === null) return partsB === null ? 0 : -1
  if (partsB === null) return 1

  const length = Math.max(partsA.length, partsB.length)
  for (let index = 0; index < length; index++) {
    const difference = (partsA[index] ?? 0) - (partsB[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}
