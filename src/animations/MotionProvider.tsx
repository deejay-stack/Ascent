import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'
import { smoothTransition } from './transitions'

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={smoothTransition}>
      {children}
    </MotionConfig>
  )
}
