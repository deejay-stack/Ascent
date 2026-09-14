import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { fadeUp, staggerChildren } from './variants'

export function StaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      variants={staggerChildren}
      viewport={{ amount: 0.15, once: true }}
      whileInView="visible"
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={fadeUp}>{children}</motion.div>
}
