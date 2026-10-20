import { useEffect, useRef } from 'react'

interface LogViewerProps {
  serviceName: string | null
  logs: string[]
  onClear: () => void
}

export function LogViewer({ serviceName, logs, onClear }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 rounded-xl overflow-hidden border border-gray-800 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-950 border-b border-gray-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-300">Live Logs</span>
          {serviceName && (
            <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-mono">
              {serviceName}
            </span>
          )}
          <span className="text-gray-500">({logs.length} lines)</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="px-2.5 py-1 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        >
          Clear
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed space-y-1 select-text"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 italic text-center py-8">
            Belum ada log {serviceName ? `untuk "${serviceName}"` : ''}.
          </div>
        ) : (
          logs.map((line, index) => (
            <div key={`${index}-${line.slice(0, 20)}`} className="break-all whitespace-pre-wrap">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
