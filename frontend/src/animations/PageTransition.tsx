import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { fadeUp } from './variants'

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      animate="visible"
      className={className}
      exit="exit"
      initial="hidden"
      variants={fadeUp}
    >
      {children}
    </motion.div>
  )
}
