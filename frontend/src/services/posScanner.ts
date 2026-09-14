export function createScanGuard(delay = 350) {
  let previous = '',
    timestamp = -Infinity
  return (barcode: string, now = Date.now()) => {
    if (barcode === previous && now - timestamp < delay) return false
    previous = barcode
    timestamp = now
    return true
  }
}
