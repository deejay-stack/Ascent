import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'

type ParallaxImageProps = {
  src: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
}

export function ParallaxImage({ src, alt, className, loading = 'lazy' }: ParallaxImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end start'] })
  const scale = useTransform(scrollYProgress, [0, 1], [1.08, reduceMotion ? 1.08 : 1])
  const y = useTransform(scrollYProgress, [0, 1], ['-3%', reduceMotion ? '-3%' : '3%'])

  return (
    <div className={className} ref={containerRef}>
      <motion.img alt={alt} loading={loading} src={src} style={{ scale, y }} />
    </div>
  )
}
