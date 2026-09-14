import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { fadeUp } from './variants'

type ScrollRevealProps = {
  children: ReactNode
  className?: string
  delay?: number
}

export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      transition={{ delay }}
      variants={fadeUp}
      viewport={{ amount: 0.18, once: true }}
      whileInView="visible"
    >
      {children}
    </motion.div>
  )
}
