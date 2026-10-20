import { useState, useEffect } from 'react'
import type { ServiceInfo, RuntimeGroupInfo } from '../types.d.ts'
import {
  listServices,
  startService,
  stopService,
  restartService,
  startAllServices,
  stopAllServices,
  getLogs,
  listRuntimes,
  setRuntimeActive,
  openExternal,
  openPath,
  onServiceStatus,
  onServiceLog,
  ping
} from '../lib/ipc.ts'
import { ServiceCard } from '../components/ServiceCard.tsx'
import { LogViewer } from '../components/LogViewer.tsx'
import { VersionsPage } from './VersionsPage.tsx'

export function Dashboard() {
  const [currentTab, setCurrentTab] = useState<'services' | 'versions'>('services')

  const [services, setServices] = useState<ServiceInfo[]>([])
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [runtimes, setRuntimes] = useState<RuntimeGroupInfo[]>([])
  const [pingMessage, setPingMessage] = useState<string | null>(null)
  const [isPinging, setIsPinging] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Inisialisasi daftar service dan runtimes dari main process
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
        if (isMounted) setErrorMessage((err as Error).message)
      })

    listRuntimes()
      .then((rts) => {
        if (!isMounted) return
        setRuntimes(rts)
      })
      .catch((err) => {
        if (isMounted) setErrorMessage((err as Error).message)
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
        prev.map((s) =>
          s.name === event.service
            ? { ...s, status: event.status, lastError: event.lastError }
            : s
        )
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
    listServices().then(setServices).catch((err) => setErrorMessage((err as Error).message))
    listRuntimes().then(setRuntimes).catch(() => {})
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

  const handleStartAll = async () => {
    setErrorMessage(null)
    try {
      await startAllServices()
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  const handleStopAll = async () => {
    setErrorMessage(null)
    try {
      await stopAllServices()
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  const handlePhpChange = async (folderId: string) => {
    setErrorMessage(null)
    try {
      const res = await setRuntimeActive('php', folderId)
      if (res.restartRequired && window.confirm(`${res.message}\n\nRestart sekarang?`)) {
        await restartService(res.restartRequired)
      }
      // Refresh runtimes
      const updated = await listRuntimes()
      setRuntimes(updated)
      if (res.message) {
        setErrorMessage(res.message)
      }
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  const handleOpenLocalhost = async () => {
    const apache = services.find((s) => s.name === 'apache')
    const port = apache ? apache.port : 80
    try {
      await openExternal(`http://localhost:${port}`)
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  const handleOpenPhpMyAdmin = async () => {
    const apache = services.find((s) => s.name === 'apache')
    const port = apache ? apache.port : 80
    try {
      await openExternal(`http://localhost:${port}/phpmyadmin`)
    } catch (err) {
      setErrorMessage((err as Error).message)
    }
  }

  const handleOpenWwwFolder = async () => {
    try {
      await openPath('www')
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

  const phpGroup = runtimes.find((r) => r.type === 'php')
  const phpValidVersions = phpGroup ? phpGroup.versions.filter((v) => v.isValid) : []

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              A
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Astra Control Panel</h1>
              <p className="text-xs text-gray-500">Local Development Environment</p>
            </div>
          </div>

          {/* Navigasi Tab */}
          <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCurrentTab('services')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                currentTab === 'services'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Control Panel
            </button>
            <button
              type="button"
              onClick={() => setCurrentTab('versions')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                currentTab === 'versions'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Runtime Versions
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {currentTab === 'services' && (
            <>
              <button
                type="button"
                onClick={handleStartAll}
                className="text-xs font-semibold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
              >
                Start All
              </button>
              <button
                type="button"
                onClick={handleStopAll}
                className="text-xs font-semibold px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md transition-colors"
              >
                Stop All
              </button>
              <div className="h-5 w-px bg-gray-200 mx-1" />
            </>
          )}

          {pingMessage && (
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-md font-mono">
              {pingMessage}
            </span>
          )}
          <button
            type="button"
            onClick={handlePing}
            disabled={isPinging}
            className="text-xs font-medium px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50"
          >
            {isPinging ? '...' : 'Ping'}
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-6 py-2.5 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quick Launch Bar */}
      {currentTab === 'services' && (
        <div className="bg-gray-100/80 border-b border-gray-200 px-6 py-2 flex items-center gap-2 text-xs">
          <span className="text-gray-500 font-medium">Quick Open:</span>
          <button
            type="button"
            onClick={handleOpenLocalhost}
            className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded text-gray-700 font-medium transition-colors"
          >
            🌐 Buka localhost
          </button>
          <button
            type="button"
            onClick={handleOpenPhpMyAdmin}
            className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded text-gray-700 font-medium transition-colors"
          >
            🐬 Buka phpMyAdmin
          </button>
          <button
            type="button"
            onClick={handleOpenWwwFolder}
            className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded text-gray-700 font-medium transition-colors"
          >
            📁 Buka folder www
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {currentTab === 'versions' ? (
          <VersionsPage />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
                {services.map((service) => {
                  const isApache = service.name === 'apache'

                  const phpSelector = isApache ? (
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-600 font-medium">PHP Version:</span>
                      {phpValidVersions.length > 0 ? (
                        <select
                          value={phpGroup?.active?.folderId || ''}
                          onChange={(e) => handlePhpChange(e.target.value)}
                          className="bg-white border border-gray-300 rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                        >
                          {phpValidVersions.map((v) => (
                            <option
                              key={v.folderId}
                              value={v.folderId}
                              disabled={!v.isThreadSafe}
                            >
                              {v.folderId} {!v.isThreadSafe ? '(NTS - Nginx only)' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-rose-600 italic">PHP belum terpasang</span>
                      )}
                    </div>
                  ) : null

                  return (
                    <ServiceCard
                      key={service.name}
                      service={service}
                      isSelected={selectedService === service.name}
                      extraControls={phpSelector}
                      onSelect={() => handleSelectService(service.name)}
                      onStart={handleStart}
                      onStop={handleStop}
                      onRestart={handleRestart}
                    />
                  )
                })}

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
          </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard
