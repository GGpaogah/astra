import { useState } from 'react'
import ping from './lib/ipc'

function App() {
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePing = async () => {
    setLoading(true)
    try {
      const response = await ping()
      setMessage(response)
    } catch (error) {
      setMessage('Error: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-6">LocalStack Dashboard</h1>
      
      <div className="w-full max-w-md">
        <button
          onClick={handlePing}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Pinging...' : 'Ping'}
        </button>
        
        {message && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Response:</h2>
            <p className="font-mono">{message}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App