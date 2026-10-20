import { useState, useEffect } from 'react'
import type { RuntimeGroupInfo } from '../types.d.ts'
import {
  listRuntimes,
  setRuntimeActive,
  refreshRuntimes,
  openRuntimeFolder,
  getRuntimePreferences,
  setRuntimeAutoRestart,
  restartService
} from '../lib/ipc.ts'

export function VersionsPage() {
  const [runtimes, setRuntimes] = useState<RuntimeGroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRestart, setAutoRestart] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    let isMounted = true
    Promise.all([listRuntimes(), getRuntimePreferences()])
      .then(([data, preferences]) => {
        if (!isMounted) return
        setRuntimes(data)
        setAutoRestart(preferences.autoRestartOnRuntimeChange)
      })
      .catch((err) => {
        if (isMounted) setMessage({ text: (err as Error).message, type: 'error' })
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const data = await refreshRuntimes()
      setRuntimes(data)
      setMessage({ text: 'Daftar runtime berhasil dipindai ulang', type: 'info' })
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectVersion = async (type: string, folderId: string) => {
    setMessage(null)
    const group = runtimes.find((runtime) => runtime.type === type)
    const selectedVersion = group?.versions.find((version) => version.folderId === folderId)
    if (!group || !selectedVersion) return

    if (type === 'mariadb' && group.active && group.active.folderId !== folderId) {
      const oldMajor = group.active.versionNumber.split('.')[0]
      const newMajor = selectedVersion.versionNumber.split('.')[0]
      if (
        oldMajor !== newMajor ||
        group.active.versionNumber === 'unknown' ||
        selectedVersion.versionNumber === 'unknown'
      ) {
        const warning =
          `MariaDB major version berubah dari ${oldMajor} ke ${newMajor}. ` +
          'Keduanya memakai data dir data/mysql yang sama dan mungkin tidak kompatibel. ' +
          'Astra tidak akan menginisialisasi ulang data. Lanjutkan?'
        if (!window.confirm(warning)) return
      }
    }

    try {
      const res = await setRuntimeActive(type, folderId)
      // Update local state
      setRuntimes((prev) =>
        prev.map((r) => (r.type === type ? { ...r, active: res.active } : r))
      )

      if (res.restarted) {
        setMessage({
          text: `Versi ${type} diubah ke "${res.active.folderId}". Service terkait telah di-restart otomatis.`,
          type: 'success'
        })
      } else if (res.restartRequired && window.confirm(
        `${res.message ?? `Restart ${res.restartRequired}?`}\n\nRestart sekarang?`
      )) {
        await restartService(res.restartRequired)
        setMessage({
          text: `Versi ${type} diubah dan ${res.restartRequired} berhasil direstart.`,
          type: 'success'
        })
      } else if (res.message) {
        setMessage({ text: res.message, type: 'info' })
      } else {
        setMessage({
          text: `Versi aktif ${type} berhasil diubah ke "${res.active.folderId}"`,
          type: 'success'
        })
      }
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' })
    }
  }

  const handleAutoRestartChange = async (enabled: boolean) => {
    try {
      const preferences = await setRuntimeAutoRestart(enabled)
      setAutoRestart(preferences.autoRestartOnRuntimeChange)
      setMessage({
        text: enabled
          ? 'Service terkait akan direstart otomatis saat versi berubah.'
          : 'Astra akan menanyakan konfirmasi sebelum merestart service.',
        type: 'info'
      })
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' })
    }
  }

  const handleOpenFolder = async (type: string, folderId?: string) => {
    try {
      await openRuntimeFolder(type, folderId)
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header bar tab */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Runtime Versions</h2>
          <p className="text-xs text-gray-500">
            Kelola multi-versi komponen lokal di folder <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">bin/</code> ala Laragon.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? 'Scanning...' : '🔄 Scan Ulang'}
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={autoRestart}
          onChange={(event) => handleAutoRestartChange(event.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Restart service otomatis saat versi runtime berubah (default: tanya dulu)
      </label>

      {/* Message notification */}
      {message && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            message.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="font-bold ml-4 hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid Kartu Runtime */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {runtimes.map((group) => {
          const validVersions = group.versions.filter((v) => v.isValid)
          const invalidVersions = group.versions.filter((v) => !v.isValid)
          const hasVersions = group.versions.length > 0

          return (
            <div
              key={group.type}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 text-base">{group.name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                    bin/{group.folderName}/
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-4">
                  {validVersions.length} versi valid terdeteksi
                </p>

                {/* Dropdown pemilih versi */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Versi Aktif:
                  </label>
                  {hasVersions ? (
                    <select
                      value={group.active?.folderId || ''}
                      onChange={(e) => handleSelectVersion(group.type, e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:ring-1 focus:ring-blue-500"
                    >
                      {validVersions.map((v) => (
                        <option
                          key={v.folderId}
                          value={v.folderId}
                          disabled={group.type === 'php' && v.isThreadSafe !== true}
                        >
                          {v.label}
                          {v.folderId === group.active?.folderId ? ' [AKTIF]' : ''}
                          {v.isLegacy ? ' [legacy]' : ''}
                          {v.isThreadSafe === false ? ' [NTS - tidak untuk Apache]' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-gray-400 italic bg-gray-50 p-2 rounded border border-dashed border-gray-200">
                      Belum ada versi di folder ini.
                    </div>
                  )}
                  {group.type === 'php' && validVersions.some((version) => !version.isThreadSafe) && (
                    <p className="mt-1 text-[11px] text-amber-800">
                      Build tanpa php8/7apache2_4.dll ditandai NTS dan tidak dapat dipilih untuk Apache.
                    </p>
                  )}
                </div>

                {/* Info status versi aktif */}
                {group.active && (
                  <div className="p-2.5 bg-gray-50 rounded-lg text-xs space-y-1 mb-4 border border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                        AKTIF
                      </span>
                      <span className="font-semibold text-gray-800">
                        {group.active.folderId}
                      </span>
                    </div>

                    <div className="text-gray-500 text-[11px] font-mono truncate" title={group.active.path}>
                      {group.active.path}
                    </div>

                    {group.active.selectionWarning && (
                      <div className="text-amber-800 bg-amber-50 p-1.5 rounded">
                        {group.active.selectionWarning}
                      </div>
                    )}

                    {group.type === 'php' && (
                      <div className="pt-1 text-[11px]">
                        {group.active.isThreadSafe ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            ✓ Thread Safe (Cocok untuk Apache)
                          </span>
                        ) : (
                          <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            ⚠ NTS (Hanya untuk Nginx / PHP-CGI)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Daftar folder invalid jika ada */}
                {invalidVersions.length > 0 && (
                  <div className="mb-4 space-y-1">
                    <span className="text-[11px] font-semibold text-rose-600 block">
                      Folder Invalid ({invalidVersions.length}):
                    </span>
                    {invalidVersions.map((inv) => (
                      <div
                        key={inv.folderId}
                        className="text-[11px] bg-rose-50 border border-rose-100 text-rose-700 p-1.5 rounded"
                      >
                        <span className="font-mono font-medium">{inv.folderId}</span>: {inv.invalidReason}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tombol aksi folder */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => handleOpenFolder(group.type)}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  📁 Buka folder bin/{group.folderName}
                </button>
                {group.active && (
                  <button
                    type="button"
                    onClick={() => handleOpenFolder(group.type, group.active?.folderId)}
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Buka versi aktif
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VersionsPage
