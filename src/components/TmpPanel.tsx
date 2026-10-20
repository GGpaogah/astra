import { useState, useEffect, useCallback } from 'react'
import type { TmpSizeResult, TmpCleanResult } from '../types.d.ts'
import { getTmpSize, cleanTmp, listBuiltinTemplates, copyBuiltinTemplate } from '../lib/ipc.ts'

export function TmpPanel() {
  const [tmpSize, setTmpSize] = useState<TmpSizeResult | null>(null)
  const [cleanResult, setCleanResult] = useState<TmpCleanResult | null>(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [builtinTemplates, setBuiltinTemplates] = useState<string[]>([])
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshSize = useCallback(() => {
    getTmpSize()
      .then(setTmpSize)
      .catch((err) => setError((err as Error).message))
  }, [])

  useEffect(() => {
    refreshSize()
    listBuiltinTemplates()
      .then(setBuiltinTemplates)
      .catch(() => {/* non-critical */})
  }, [refreshSize])

  const handleClean = async () => {
    setIsCleaning(true)
    setError(null)
    setCleanResult(null)
    try {
      const result = await cleanTmp()
      setCleanResult(result)
      refreshSize()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsCleaning(false)
    }
  }

  const handleCopyTemplate = async (name: string) => {
    setIsCopying(true)
    setCopyStatus(null)
    setError(null)
    try {
      const res = await copyBuiltinTemplate(name)
      if (res.alreadyExists) {
        setCopyStatus(`"${name}" sudah ada di usr/tpl/ — tidak ditimpa.`)
      } else {
        setCopyStatus(`"${name}" berhasil disalin ke usr/tpl/.`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Folder Sementara (tmp/)
        </h3>
        <button
          type="button"
          onClick={refreshSize}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Refresh
        </button>
      </div>

      {/* Ukuran tmp saat ini */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500">Ukuran saat ini:</span>
        <span className="font-mono font-semibold text-gray-900">
          {tmpSize ? tmpSize.formatted : '—'}
        </span>
      </div>

      {/* Tombol Bersihkan */}
      <button
        type="button"
        onClick={handleClean}
        disabled={isCleaning}
        className="self-start text-xs font-semibold px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-md transition-colors"
      >
        {isCleaning ? 'Membersihkan…' : '🧹 Bersihkan tmp'}
      </button>

      {/* Hasil pembersihan */}
      {cleanResult && (
        <div className="text-xs bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-800">
          {cleanResult.totalFiles === 0
            ? 'Tidak ada file lama untuk dihapus.'
            : `${cleanResult.totalFiles} file dihapus (${cleanResult.freedFormatted} dibebaskan)` +
              ` — sesi: ${cleanResult.sessionFiles}, upload: ${cleanResult.uploadFiles}`}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Salin template bawaan ke usr/tpl */}
      {builtinTemplates.length > 0 && (
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
          <p className="text-xs text-gray-500 font-medium">
            Salin template bawaan ke <code className="font-mono bg-gray-100 px-1 rounded">usr/tpl/</code>:
          </p>
          <div className="flex flex-wrap gap-2">
            {builtinTemplates.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => handleCopyTemplate(tpl)}
                disabled={isCopying}
                className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 border border-gray-300 rounded font-mono transition-colors"
              >
                {tpl}
              </button>
            ))}
          </div>
          {copyStatus && (
            <p className="text-xs text-blue-700">{copyStatus}</p>
          )}
        </div>
      )}
    </div>
  )
}
