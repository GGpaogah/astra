import { useState, useEffect, useCallback } from 'react'
import type { RuntimeGroupInfo, DownloadJob, DownloadProgressEvent } from '../types.d.ts'
import {
  listRuntimes,
  setRuntimeActive,
  refreshRuntimes,
  openRuntimeFolder,
  getRuntimePreferences,
  setRuntimeAutoRestart,
  restartService,
  startDownload,
  cancelDownload,
  getDownloadStatus,
  deleteRuntimeVersion,
  onDownloadProgress
} from '../lib/ipc.ts'

function formatBytes(b: number): string {
  if (b <= 0) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const STATUS_LABEL: Record<string, string> = {
  resolving: 'Memeriksa versi…',
  downloading: 'Mengunduh…',
  verifying: 'Memverifikasi…',
  extracting: 'Mengekstrak…',
  done: 'Selesai',
  error: 'Gagal',
  cancelled: 'Dibatalkan'
}

export function VersionsPage() {
  const [runtimes, setRuntimes] = useState<RuntimeGroupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRestart, setAutoRestart] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)
  /** type → DownloadJob aktif di sesi ini */
  const [downloads, setDownloads] = useState<Map<string, DownloadJob>>(new Map())

  // ── load runtimes + preferences + download status aktif ───────────────────
  useEffect(() => {
    let isMounted = true
    Promise.all([listRuntimes(), getRuntimePreferences(), getDownloadStatus()])
      .then(([data, preferences, jobs]) => {
        if (!isMounted) return
        setRuntimes(data)
        setAutoRestart(preferences.autoRestartOnRuntimeChange)
        // Restore job state dari sesi yang mungkin masih berjalan
        const map = new Map<string, DownloadJob>()
        for (const job of jobs) {
          if (!['done', 'error', 'cancelled'].includes(job.status)) {
            map.set(job.type, job)
          }
        }
        setDownloads(map)
      })
      .catch((err) => {
        if (isMounted) setMessage({ text: (err as Error).message, type: 'error' })
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => { isMounted = false }
  }, [])

  // ── subscribe download:progress ───────────────────────────────────────────
  useEffect(() => {
    const unsub = onDownloadProgress((event: DownloadProgressEvent) => {
      setDownloads((prev) => {
        const next = new Map(prev)
        const existing = next.get(event.type)
        const merged: DownloadJob = {
          id: event.id,
          type: event.type,
          channel: existing?.channel ?? 'stable',
          version: event.version,
          status: event.status,
          progressPercent: event.progressPercent,
          bytesReceived: event.bytesReceived,
          totalBytes: event.totalBytes,
          error: event.error,
          warnings: event.warnings,
          destFolder: event.destFolder,
          startedAt: existing?.startedAt ?? new Date().toISOString(),
          finishedAt: ['done', 'error', 'cancelled'].includes(event.status)
            ? new Date().toISOString()
            : undefined
        }
        next.set(event.type, merged)
        return next
      })

      // Refresh daftar runtime setelah install selesai
      if (event.status === 'done') {
        refreshRuntimes()
          .then((data) => setRuntimes(data))
          .catch(() => {})
        setMessage({ text: `Runtime ${event.type} berhasil diinstall ke bin/.`, type: 'success' })
      }
      if (event.status === 'error') {
        setMessage({ text: `Download ${event.type} gagal: ${event.error ?? ''}`, type: 'error' })
      }
    })
    return unsub
  }, [])

  // ── handlers ──────────────────────────────────────────────────────────────

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
    const group = runtimes.find((r) => r.type === type)
    const selected = group?.versions.find((v) => v.folderId === folderId)
    if (!group || !selected) return

    if (type === 'mariadb' && group.active && group.active.folderId !== folderId) {
      const oldMajor = group.active.versionNumber.split('.')[0]
      const newMajor = selected.versionNumber.split('.')[0]
      if (oldMajor !== newMajor || group.active.versionNumber === 'unknown' || selected.versionNumber === 'unknown') {
        const warn =
          `MariaDB major version berubah dari ${oldMajor} ke ${newMajor}. ` +
          'Keduanya memakai data dir data/mysql yang sama dan mungkin tidak kompatibel. ' +
          'Astra tidak akan menginisialisasi ulang data. Lanjutkan?'
        if (!window.confirm(warn)) return
      }
    }

    try {
      const res = await setRuntimeActive(type, folderId)
      setRuntimes((prev) => prev.map((r) => r.type === type ? { ...r, active: res.active } : r))

      if (res.restarted) {
        setMessage({ text: `Versi ${type} diubah ke "${res.active.folderId}". Service direstart otomatis.`, type: 'success' })
      } else if (res.restartRequired && window.confirm(`${res.message ?? `Restart ${res.restartRequired}?`}\n\nRestart sekarang?`)) {
        await restartService(res.restartRequired)
        setMessage({ text: `Versi ${type} diubah dan ${res.restartRequired} berhasil direstart.`, type: 'success' })
      } else if (res.message) {
        setMessage({ text: res.message, type: 'info' })
      } else {
        setMessage({ text: `Versi aktif ${type} berhasil diubah ke "${res.active.folderId}"`, type: 'success' })
      }
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' })
    }
  }

  const handleAutoRestartChange = async (enabled: boolean) => {
    try {
      const prefs = await setRuntimeAutoRestart(enabled)
      setAutoRestart(prefs.autoRestartOnRuntimeChange)
      setMessage({
        text: enabled ? 'Service terkait akan direstart otomatis saat versi berubah.' : 'Astra akan menanyakan konfirmasi sebelum merestart service.',
        type: 'info'
      })
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' })
    }
  }

  const handleOpenFolder = async (type: string, folderId?: string) => {
    try { await openRuntimeFolder(type, folderId) }
    catch (err) { setMessage({ text: (err as Error).message, type: 'error' }) }
  }

  const handleInstall = async (type: string) => {
    setMessage(null)
    try {
      await startDownload(type, 'stable', false)
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' })
    }
  }

  const handleCancelDownload = async (type: string) => {
    try { await cancelDownload(type) }
    catch (err) { setMessage({ text: (err as Error).message, type: 'error' }) }
  }

  const handleDeleteVersion = useCallback(async (type: string, folderId: string) => {
    if (!window.confirm(`Hapus versi "${folderId}" dari bin/${type}/?\nTindakan ini tidak dapat dibatalkan.`)) return
    setMessage(null)
    try {
      await deleteRuntimeVersion(type, folderId)
      const updated = await refreshRuntimes()
      setRuntimes(updated)
      setMessage({ text: `Versi "${folderId}" berhasil dihapus.`, type: 'success' })
    } catch (err) {
      setMessage({ text: (err as Error).message, type: 'error' })
    }
  }, [])

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Runtime Versions</h2>
          <p className="text-xs text-gray-500">
            Kelola multi-versi komponen lokal di folder{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">bin/</code> ala Laragon.
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
          onChange={(e) => handleAutoRestartChange(e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Restart service otomatis saat versi runtime berubah (default: tanya dulu)
      </label>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-xs flex items-center justify-between ${
          message.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200'
          : message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="font-bold ml-4 hover:opacity-75">✕</button>
        </div>
      )}

      {/* Grid Kartu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {runtimes.map((group) => {
          const validVersions = group.versions.filter((v) => v.isValid)
          const invalidVersions = group.versions.filter((v) => !v.isValid)
          const hasVersions = group.versions.length > 0
          const activeJob = downloads.get(group.type)
          const isDownloading = activeJob && !['done', 'error', 'cancelled'].includes(activeJob.status)

          return (
            <div key={group.type} className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 text-base">{group.name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                    bin/{group.folderName}/
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {validVersions.length} versi valid terdeteksi
                </p>

                {/* Dropdown versi */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Versi Aktif:</label>
                  {hasVersions ? (
                    <select
                      value={group.active?.folderId ?? ''}
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
                          {v.isThreadSafe === false ? ' [NTS]' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-gray-400 italic bg-gray-50 p-2 rounded border border-dashed border-gray-200">
                      Belum ada versi di folder ini.
                    </div>
                  )}
                  {group.type === 'php' && validVersions.some((v) => !v.isThreadSafe) && (
                    <p className="mt-1 text-[11px] text-amber-800">
                      Build tanpa php8/7apache2_4.dll ditandai NTS dan tidak dapat dipilih untuk Apache.
                    </p>
                  )}
                </div>

                {/* Info versi aktif */}
                {group.active && (
                  <div className="p-2.5 bg-gray-50 rounded-lg text-xs space-y-1 mb-4 border border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">AKTIF</span>
                      <span className="font-semibold text-gray-800">{group.active.folderId}</span>
                    </div>
                    <div className="text-gray-500 text-[11px] font-mono truncate" title={group.active.path}>
                      {group.active.path}
                    </div>
                    {group.active.selectionWarning && (
                      <div className="text-amber-800 bg-amber-50 p-1.5 rounded">{group.active.selectionWarning}</div>
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

                {/* Versi valid — tombol hapus */}
                {validVersions.length > 1 && (
                  <div className="mb-3 space-y-1">
                    <span className="text-[11px] font-semibold text-gray-600 block">Hapus versi:</span>
                    {validVersions
                      .filter((v) => v.folderId !== group.active?.folderId)
                      .map((v) => (
                        <div key={v.folderId} className="flex items-center justify-between text-[11px] bg-gray-50 border border-gray-100 rounded px-2 py-1">
                          <span className="font-mono text-gray-700 truncate">{v.folderId}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteVersion(group.type, v.folderId)}
                            className="text-rose-600 hover:text-rose-800 font-semibold ml-2 shrink-0"
                            title={`Hapus ${v.folderId}`}
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                {/* Folder invalid */}
                {invalidVersions.length > 0 && (
                  <div className="mb-4 space-y-1">
                    <span className="text-[11px] font-semibold text-rose-600 block">Folder Invalid ({invalidVersions.length}):</span>
                    {invalidVersions.map((inv) => (
                      <div key={inv.folderId} className="text-[11px] bg-rose-50 border border-rose-100 text-rose-700 p-1.5 rounded">
                        <span className="font-mono font-medium">{inv.folderId}</span>: {inv.invalidReason}
                      </div>
                    ))}
                  </div>
                )}

                {/* Progress download */}
                {activeJob && (
                  <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-blue-800 font-semibold">
                        {STATUS_LABEL[activeJob.status] ?? activeJob.status}
                        {activeJob.version ? ` v${activeJob.version}` : ''}
                      </span>
                      {isDownloading && (
                        <button
                          type="button"
                          onClick={() => handleCancelDownload(group.type)}
                          className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]"
                        >
                          Batalkan
                        </button>
                      )}
                    </div>

                    {/* Progress bar */}
                    {['downloading', 'verifying', 'extracting'].includes(activeJob.status) && (
                      <>
                        <div className="w-full bg-blue-200 rounded-full h-1.5 mb-1">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                            style={{ width: `${activeJob.progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-blue-700">
                          <span>{activeJob.progressPercent}%</span>
                          <span>
                            {formatBytes(activeJob.bytesReceived)}
                            {activeJob.totalBytes > 0 ? ` / ${formatBytes(activeJob.totalBytes)}` : ''}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Error */}
                    {activeJob.status === 'error' && activeJob.error && (
                      <div className="text-rose-700 bg-rose-50 p-1.5 rounded mt-1 text-[11px] break-words">
                        {activeJob.error}
                      </div>
                    )}

                    {/* Warnings */}
                    {activeJob.warnings.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {activeJob.warnings.map((w, i) => (
                          <div key={i} className="text-amber-800 bg-amber-50 p-1 rounded text-[11px]">{w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tombol bawah kartu */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenFolder(group.type)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    📁 Buka bin/{group.folderName}
                  </button>
                  {group.active && (
                    <button
                      type="button"
                      onClick={() => handleOpenFolder(group.type, group.active?.folderId)}
                      className="text-gray-600 hover:text-gray-900 font-medium"
                    >
                      Buka aktif
                    </button>
                  )}
                </div>

                {/* Tombol Install */}
                {!isDownloading && (
                  <button
                    type="button"
                    onClick={() => handleInstall(group.type)}
                    className="text-xs font-semibold px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors shrink-0"
                    title={`Unduh dan install versi terbaru ${group.name}`}
                  >
                    ⬇ Install
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
