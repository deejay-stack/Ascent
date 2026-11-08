import type { RequestHandler } from 'express'
// Browser sessions use bearer tokens, so cross-origin cookies are unnecessary.
export function cors(
  allowedOrigins: string[],
  { allowSameOrigin = false } = {},
): RequestHandler {
  const origins = new Set(allowedOrigins)
  return (req, res, next) => {
    const origin = req.headers.origin
    if (!origin) return next()
    res.vary('Origin')
    const sameOrigin =
      allowSameOrigin && origin === `${req.protocol}://${req.get('host')}`
    if (!origins.has(origin) && !sameOrigin)
      return res
        .status(403)
        .json({ message: 'This frontend origin is not allowed.' })
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
    )
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  }
}

export function frontendOrigins(value: string | undefined, deployed = false) {
  if (deployed && !value)
    throw new Error('Set APP_URL to the deployed frontend origin.')
  return (value || 'http://localhost:5173,http://localhost:4174')
    .split(',')
    .map((entry) => {
      const url = new URL(entry.trim())
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        (deployed && url.protocol !== 'https:')
      )
        throw new Error(
          'APP_URL must contain exact frontend origins, separated by commas.',
        )
      return url.origin
    })
}
