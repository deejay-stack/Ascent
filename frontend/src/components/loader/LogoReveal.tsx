import { motion } from 'motion/react'
import { loaderLetter } from '../../animations/loaderVariants'

export function LogoReveal({ staticReveal = false }: { staticReveal?: boolean }) {
  return (
    <div className="loader-wordmark" aria-label="ASCENT">
      {'ASCENT'.split('').map((letter, index) => (
        <span key={`${letter}-${index}`}>
          {staticReveal ? <i>{letter}</i> : (
            <motion.i animate="visible" custom={index} initial="hidden" variants={loaderLetter}>
              {letter}
            </motion.i>
          )}
        </span>
      ))}
    </div>
  )
}
