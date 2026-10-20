import net from 'node:net'

export class PortChecker {
  /**
   * Menguji apakah suatu port bebas didengarkan pada 127.0.0.1
   */
  public static async isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer()

      server.once('error', () => {
        resolve(false)
      })

      server.once('listening', () => {
        server.close(() => {
          resolve(true)
        })
      })

      server.listen(port, '127.0.0.1')
    })
  }

  /**
   * Menunggu port merespons koneksi TCP (misalnya menunggu MariaDB siap melayani)
   */
  public static async waitForPort(
    port: number,
    timeoutMs = 30000,
    intervalMs = 500
  ): Promise<boolean> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const isOpen = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket()

        socket.setTimeout(intervalMs)

        socket.once('connect', () => {
          socket.destroy()
          resolve(true)
        })

        socket.once('error', () => {
          socket.destroy()
          resolve(false)
        })

        socket.once('timeout', () => {
          socket.destroy()
          resolve(false)
        })

        socket.connect(port, '127.0.0.1')
      })

      if (isOpen) {
        return true
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    return false
  }
}
