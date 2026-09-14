export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    const timeout = AbortSignal.timeout(45000)
    response = await fetch(path, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(
      'The store service is unavailable or took too long to respond. Please try again.',
      503,
    )
  }
  const body = (await response.json().catch(() => null)) as ({ message?: string } & T) | null
  if (!response.ok)
    throw new ApiError(
      body?.message || 'The store service is unavailable. Please try again.',
      response.status,
    )
  if (!body || !response.headers.get('content-type')?.includes('application/json'))
    throw new ApiError('The store service could not be reached. Please try again shortly.', 503)
  return body
}
