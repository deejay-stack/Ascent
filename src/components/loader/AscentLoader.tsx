import { motion, useReducedMotion } from 'motion/react'
import { loaderCurtain } from '../../animations/loaderVariants'
import { LogoReveal } from './LogoReveal'

export function AscentLoader() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      animate="visible"
      aria-label="Loading ASCENT"
      className="ascent-loader"
      exit={reduceMotion ? { opacity: 0, transition: { duration: 0.16 } } : 'exit'}
      initial="visible"
      role="status"
      variants={reduceMotion ? undefined : loaderCurtain}
    >
      {!reduceMotion && (
        <div className="loader-shutters" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <motion.span
              animate={{ scaleY: 1 }}
              initial={{ scaleY: index % 2 === 0 ? 0.18 : 0.42 }}
              key={index}
              transition={{ delay: index * 0.035, duration: 0.65 }}
            />
          ))}
        </div>
      )}
      <LogoReveal staticReveal={Boolean(reduceMotion)} />
      <div className="loader-progress"><motion.span animate={{ scaleX: 1 }} initial={{ scaleX: 0 }} transition={{ duration: reduceMotion ? 0.3 : 1.2 }} /></div>
      <p>Commerce · Inventory · Point of sale</p>
    </motion.div>
  )
}
