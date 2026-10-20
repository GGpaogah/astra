import type { ServiceInfo } from '../types.d.ts'

interface ServiceCardProps {
  service: ServiceInfo
  isSelected: boolean
  onSelect: () => void
  onStart: (name: string) => void
  onStop: (name: string) => void
  onRestart: (name: string) => void
}

export function ServiceCard({
  service,
  isSelected,
  onSelect,
  onStart,
  onStop,
  onRestart
}: ServiceCardProps) {
  const isRunning = service.status === 'running'
  const isStopped = service.status === 'stopped'
  const isBusy = service.status === 'starting' || service.status === 'stopping'

  const statusBadgeColor = {
    stopped: 'bg-gray-100 text-gray-700 border-gray-300',
    starting: 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse',
    running: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    stopping: 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse',
    error: 'bg-rose-100 text-rose-800 border-rose-300'
  }[service.status]

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-xs ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg capitalize">{service.name}</h3>
          <span className="text-xs font-mono text-gray-500">Port: {service.port}</span>
        </div>
        <span
          className={`px-2.5 py-1 text-xs font-medium rounded-full border uppercase tracking-wider ${statusBadgeColor}`}
        >
          {service.status}
        </span>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={!isStopped || isBusy}
          onClick={() => onStart(service.name)}
          className="flex-1 py-1.5 px-3 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:cursor-not-allowed transition-colors"
        >
          Start
        </button>

        <button
          type="button"
          disabled={!isRunning || isBusy}
          onClick={() => onStop(service.name)}
          className="flex-1 py-1.5 px-3 text-xs font-medium rounded-md bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 disabled:hover:bg-rose-600 disabled:cursor-not-allowed transition-colors"
        >
          Stop
        </button>

        <button
          type="button"
          disabled={!isRunning || isBusy}
          onClick={() => onRestart(service.name)}
          className="flex-1 py-1.5 px-3 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 disabled:hover:bg-amber-600 disabled:cursor-not-allowed transition-colors"
        >
          Restart
        </button>
      </div>
    </div>
  )
}
