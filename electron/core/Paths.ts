import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getAppRoot(): string {
  if (app.isPackaged) {
    return path.dirname(app.getAppPath())
  }
  return path.resolve(__dirname, '..')
}

export const Paths = {
  appRoot: getAppRoot(),
  bin: path.join(getAppRoot(), 'bin'),
  data: path.join(getAppRoot(), 'data'),
  etc: path.join(getAppRoot(), 'etc'),
  logs: path.join(getAppRoot(), 'logs'),
  www: path.join(getAppRoot(), 'www'),
  templates: path.join(__dirname, 'templates')
} as const

export type Paths = typeof Paths