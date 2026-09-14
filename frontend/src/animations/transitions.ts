import type { Transition } from 'motion/react'

export const swiftTransition: Transition = {
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
}

export const smoothTransition: Transition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1],
}
