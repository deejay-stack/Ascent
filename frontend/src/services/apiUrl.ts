export function apiUrl(path: string, configuredOrigin = ''): string {
  if (!configuredOrigin.trim()) return path
  const url = new URL(configuredOrigin.trim())
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash)
    throw new Error('VITE_API_URL must be the backend origin without /api or a path.')
  if (!path.startsWith('/api/')) throw new Error('Expected an API path.')
  return url.origin + path
}
