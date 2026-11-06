import type { ProxyOptions } from 'vite'

export function apiProxy(target = 'http://127.0.0.1:4174'): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    proxyTimeout: 40000,
    configure(proxy) {
      proxy.on('error', (_error, _request, response) => {
        if (!('writeHead' in response) || response.headersSent || response.writableEnded) return
        response.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        response.end(
          JSON.stringify({
            message: 'The connection to the store was interrupted. Please try again shortly.',
          }),
        )
      })
    },
  }
}
