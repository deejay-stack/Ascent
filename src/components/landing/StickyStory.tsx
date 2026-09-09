import { ArrowUpRight, BarChart3, ScanBarcode, ShoppingBasket } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { editorialEase } from '../../animations/easing'

const stories = [
  {
    number: '01',
    title: 'Shop',
    eyebrow: 'Customer commerce',
    description: 'A clear catalog, stock-aware cart, and step-by-step checkout for pickup or delivery.',
    action: 'Browse the store',
    to: '/products',
    image: '/images/landing/ascent-grocery-hero.jpg',
    alt: 'Fresh groceries ready for online ordering',
    icon: ShoppingBasket,
  },
  {
    number: '02',
    title: 'Operate',
    eyebrow: 'Staff operations',
    description: 'Fast barcode POS, order processing, receipts, and inventory movement without operational clutter.',
    action: 'See staff tools',
    to: '/login',
    image: '/images/story/operate.jpg',
    alt: 'Store staff member scanning fresh produce at a checkout counter',
    icon: ScanBarcode,
  },
  {
    number: '03',
    title: 'Grow',
    eyebrow: 'Owner intelligence',
    description: 'Sales trends, stock health, suppliers, purchase orders, and team activity in one accountable view.',
    action: 'Explore ownership',
    to: '/login',
    image: '/images/story/grow.jpg',
    alt: 'Grocery store owner reviewing inventory on a tablet',
    icon: BarChart3,
  },
]

export function StickyStory() {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeStory = stories[activeIndex]

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') setActiveIndex(0)
    else if (event.key === 'End') setActiveIndex(stories.length - 1)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') setActiveIndex((current) => (current + stories.length - 1) % stories.length)
    else setActiveIndex((current) => (current + 1) % stories.length)
  }

  return (
    <section className="story-section" id="how-it-works">
      <div className="story-sticky">
        <AnimatePresence mode="popLayout">
          <motion.img
            alt={activeStory.alt}
            animate={{ opacity: 1, scale: 1.03 }}
            className="story-background"
            exit={{ opacity: 0, scale: 1.07 }}
            initial={{ opacity: 0, scale: 1.08 }}
            key={activeStory.image}
            loading={activeIndex === 0 ? 'eager' : 'lazy'}
            src={activeStory.image}
            transition={{ duration: 0.55, ease: editorialEase }}
          />
        </AnimatePresence>
        <div className="story-shade" />
        <div className="story-heading">
          <p><span>02</span> One platform, three ways forward</p>
          <h2>Shop. Operate. Grow.</h2>
        </div>

        <div className="story-panels" onKeyDown={handleKeyDown} role="tablist" aria-label="ASCENT workflows">
          {stories.map((story, index) => {
            const Icon = story.icon
            const isActive = index === activeIndex
            return (
              <motion.article className={isActive ? 'is-active' : ''} key={story.number} layout>
                <button
                  aria-controls={`story-panel-${index}`}
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(index)}
                  role="tab"
                  tabIndex={isActive ? 0 : -1}
                  type="button"
                >
                  <span>{story.number}</span>
                  <strong>{story.title}</strong>
                  <Icon size={19} />
                </button>
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      animate={{ opacity: 1, height: 'auto' }}
                      className="story-panel-content"
                      exit={{ opacity: 0, height: 0 }}
                      id={`story-panel-${index}`}
                      initial={{ opacity: 0, height: 0 }}
                      role="tabpanel"
                    >
                      <p>{story.eyebrow}</p>
                      <h3>{story.description}</h3>
                      <Link to={story.to}>{story.action} <ArrowUpRight size={17} /></Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
