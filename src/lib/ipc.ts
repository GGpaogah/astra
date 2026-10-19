export async function ping(): Promise<string> {
  return window.api.ping()
}