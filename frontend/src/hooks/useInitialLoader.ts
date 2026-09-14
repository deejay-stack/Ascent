import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

const loaderKey = 'ascent-initial-loader-seen'

function shouldShowLoader(enabled: boolean) {
  if (!enabled) return false
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return sessionStorage.getItem(loaderKey) !== 'true' || navigation?.type === 'reload'
}

export function useInitialLoader(enabled: boolean) {
  const reduceMotion = useReducedMotion()
  const [isVisible, setIsVisible] = useState(() => shouldShowLoader(enabled))

  useEffect(() => {
    if (!isVisible) return
    sessionStorage.setItem(loaderKey, 'true')
    const duration = reduceMotion ? 420 : 1450
    const timer = window.setTimeout(() => setIsVisible(false), duration)
    const fallback = window.setTimeout(() => setIsVisible(false), 2400)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(fallback)
    }
  }, [isVisible, reduceMotion])

  return isVisible
}
