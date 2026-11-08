// The Chrome DevTools Protocol subset used by the existing Edge checks.
export type Evaluation = {
  result: { value: unknown }
  exceptionDetails?: { text: string; exception?: { description?: string } }
}
export type ProtocolResults = {
  'DOM.getDocument': { root: { nodeId: number } }
  'DOM.querySelector': { nodeId: number }
  'Runtime.evaluate': Evaluation
  'Page.captureScreenshot': { data: string }
  'Page.printToPDF': { data: string }
  'Target.createBrowserContext': { browserContextId: string }
  'Target.createTarget': { targetId: string }
  'Target.attachToTarget': { sessionId: string }
}
export type ProtocolResult<M extends string> = M extends keyof ProtocolResults
  ? ProtocolResults[M]
  : unknown
export type ProtocolEvent = {
  method: string
  params: {
    requestId: string
    request: { method: string; postData: string; url: string }
    exceptionDetails?: { text: string; exception?: { description?: string } }
    responseStatusCode?: number
    entry: { level: string; text: string }
  }
}
export type PendingCommand = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeout?: ReturnType<typeof setTimeout>
}
