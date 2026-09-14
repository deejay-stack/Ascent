for (const port of [4174, 5173]) {
  await Promise.all(
    ['/api/health', '/api/snapshot'].map(async (path) => {
      try {
        const started = Date.now()
        const response = await fetch(`http://localhost:${port}${path}`, {
          signal: AbortSignal.timeout(45000),
        })
        const body = await response.json().catch(() => null)
        console.log(
          `localhost:${port}${path}`,
          response.status,
          Date.now() - started,
          body?.database || (Array.isArray(body?.products) ? `${body.products.length} products` : 'Unexpected response'),
        )
        if (!response.ok || !body) process.exitCode = 1
      } catch (error) {
        console.log(`localhost:${port}${path}`, error.cause?.code || error.name)
        process.exitCode = 1
      }
    }),
  )
}
