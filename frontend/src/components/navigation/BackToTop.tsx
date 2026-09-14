import { ArrowUp } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsVisible(window.scrollY > 650)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          aria-label="Back to top"
          className="back-to-top"
          exit={{ opacity: 0, y: 8 }}
          initial={{ opacity: 0, y: 8 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          type="button"
          whileTap={{ scale: 0.94 }}
        >
          <ArrowUp size={19} />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
