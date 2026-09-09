import { ArrowDown, ArrowUpRight, Play } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Link } from 'react-router-dom'
import { SplitTextReveal } from '../motion/SplitTextReveal'

export function HomeHero() {
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const imageScale = useTransform(scrollYProgress, [0, 0.2], [1.04, reduceMotion ? 1.04 : 1.12])
  const contentY = useTransform(scrollYProgress, [0, 0.18], [0, reduceMotion ? 0 : 70])

  return (
    <section className="cinematic-hero" id="overview">
      <motion.img
        alt="Reusable grocery bag filled with fresh produce, bread, milk, and pantry essentials"
        className="cinematic-hero-image"
        fetchPriority="high"
        src="/images/landing/ascent-grocery-hero.jpg"
        style={{ scale: imageScale }}
      />
      <div className="cinematic-hero-overlay" />

      <motion.div className="cinematic-hero-content" style={{ y: contentY }}>
        <div className="hero-kicker"><span>ASCENT / Grocery commerce</span><span>Built for neighborhood stores</span></div>
        <h1>
          <SplitTextReveal className="hero-headline-left" lines={['Everything', 'You Need.']} />
          <SplitTextReveal className="hero-headline-right" lines={['All in', 'One Store.']} />
        </h1>
        <div className="hero-editorial-copy">
          <p>
            Shop groceries, process orders, control inventory, and run the counter from one
            connected platform.
          </p>
          <div>
            <Link className="editorial-button is-lime" to="/products">Shop groceries <ArrowUpRight size={18} /></Link>
            <a className="editorial-button is-ghost" href="#how-it-works"><Play size={16} /> Explore ASCENT</a>
          </div>
        </div>
      </motion.div>

      <a className="hero-scroll-cue" href="#categories"><span>Scroll to discover</span><ArrowDown size={17} /></a>
    </section>
  )
}
