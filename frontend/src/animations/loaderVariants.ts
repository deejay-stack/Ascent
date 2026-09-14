import type { Variants } from 'motion/react'
import { curtainEase } from './easing'

export const loaderCurtain: Variants = {
  visible: { y: 0 },
  exit: { y: '-100%', transition: { duration: 0.72, ease: curtainEase } },
}

export const loaderLetter: Variants = {
  hidden: { y: '115%' },
  visible: (index: number) => ({
    y: 0,
    transition: { delay: 0.12 + index * 0.055, duration: 0.48, ease: curtainEase },
  }),
}
