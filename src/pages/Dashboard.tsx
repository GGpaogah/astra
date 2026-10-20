import { useState, useEffect } from 'react'
import type { ServiceInfo } from '../types.d.ts'
import {
  listServices,
  startService,
  stopService,
  restartService,
  getLogs,
  onServiceStatus,
  onServiceLog,
  ping
} from '../lib/ipc.ts'
import { ServiceCard } from '../components/ServiceCard.tsx'
import { LogViewer } from '../components/LogViewer.tsx'

export function Dashboard() {
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [pingMessage, setPingMessage] = useState<string | null>(null)
  const [isPinging, setIsPinging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Inisialisasi daftar service dari main process
  useEffect(() => {
    let isMounted = true
    listServices()
      .then((list) => {
        if (!isMounted) return
        setServices(list)
        if (list.length > 0) {
          setSelectedService(list[0].name)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMessage((err as Error).message)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Muat logs ketika service terpilih berganti
  useEffect(() => {
    if (!selectedService) {
      return
    }

    let isMounted = true
    getLogs(selectedService)
      .then((history) => {
        if (isMounted) {
          setLogs(history.slice(-500))
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMessage((err as Error).message)
        }
      })

    return () => {
      isMounted = false
    }
  }, [selectedService])

  // Listener event status dan live log dari main process
  useEffect(() => {
    const unsubscribeStatus = onServiceStatus((event) => {
      setServices((prev) =>
        prev.map((s) => (s.name === event.service ? { ...s, status: event.status } : s))
      )
    })

    const unsubscribeLog = onServiceLog((event) => {
      if (event.service === selectedService) {
        setLogs((prev) => {
          const merged = [...prev, ...event.lines]
          return merged.length > 500 ? merged.slice(-500) : merged
        })
      }
    })

    return () => {
      unsubscribeStatus()
      unsubscribeLog()
    }
  }, [selectedService])

  const handleRefresh = () => {
    listServices()
      .then((list) => {
        setServices(list)
      })
      .catch((err) => {
        setErrorMessage((err as Error).message)
      })
  }

  const handleSelectService = (name: string) => {
    setSelectedService(name)
    setLogs([])
  }

  const handleStart = async (name: string) => {
    setErrorMessage(null)
    try {
      await startService(name)
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  const handleStop = async (name: string) => {
    setErrorMessage(null)
    try {
      await stopService(name)
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  const handleRestart = async (name: string) => {
    setErrorMessage(null)
    try {
      await restartService(name)
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  const handlePing = async () => {
    setIsPinging(true)
    setPingMessage(null)
    try {
      const res = await ping()
      setPingMessage(res)
    } catch (err) {
      setPingMessage(`Error: ${(err as Error).message}`)
    } finally {
      setIsPinging(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Astra Control Panel</h1>
            <p className="text-xs text-gray-500">Fase 2: Paths, BaseService & ServiceManager</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pingMessage && (
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md font-mono">
              Ping: {pingMessage}
            </span>
          )}
          <button
            type="button"
            onClick={handlePing}
            disabled={isPinging}
            className="text-xs font-medium px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50"
          >
            {isPinging ? 'Pinging...' : 'Test Ping'}
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-6 py-2.5 flex items-center justify-between">
          <span>Error: {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl w-full mx-auto">
        {/* Left: Service List */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Services ({services.length})
            </h2>
            <button
              type="button"
              onClick={handleRefresh}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Refresh
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {services.map((service) => (
              <ServiceCard
                key={service.name}
                service={service}
                isSelected={selectedService === service.name}
                onSelect={() => handleSelectService(service.name)}
                onStart={handleStart}
                onStop={handleStop}
                onRestart={handleRestart}
              />
            ))}

            {services.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500 bg-white border border-gray-200 rounded-xl">
                Tidak ada service yang terdaftar.
              </div>
            )}
          </div>
        </section>

        {/* Right: Live Log Viewer */}
        <section className="lg:col-span-7 flex flex-col min-h-[480px]">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
            Output Console
          </h2>
          <div className="flex-1 min-h-[420px]">
            <LogViewer
              serviceName={selectedService}
              logs={logs}
              onClear={() => setLogs([])}
            />
          </div>
        </section>
      </main>
    </div>
  )
}

export default Dashboard
