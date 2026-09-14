import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { editorialEase } from '../../animations/easing'

export function MaskedText({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return (
      <span className={`masked-text ${className ?? ''}`}>
        <span>{children}</span>
      </span>
    )
  }

  return (
    <span className={`masked-text ${className ?? ''}`}>
      <motion.span
        initial={{ y: '112%' }}
        transition={{ delay, duration: 0.72, ease: editorialEase }}
        viewport={{ once: true }}
        whileInView={{ y: 0 }}
      >
        {children}
      </motion.span>
    </span>
  )
}
