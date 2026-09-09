import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { faqs } from '../../data/landingContent'
import { SectionHeading } from './SectionHeading'

export function FaqSection() {
  const [openQuestion, setOpenQuestion] = useState(faqs[0].question)

  return (
    <section className="landing-section faq-section" id="faq">
      <SectionHeading eyebrow="Frequently asked" title="Straight answers about ASCENT." />
      <div className="faq-list">
        {faqs.map((faq) => {
          const isOpen = openQuestion === faq.question
          return (
            <article key={faq.question}>
              <button
                aria-expanded={isOpen}
                onClick={() => setOpenQuestion(isOpen ? '' : faq.question)}
                type="button"
              >
                <span>{faq.question}</span>
                <motion.span animate={{ rotate: isOpen ? 180 : 0 }}><ChevronDown size={19} /></motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                  >
                    <p>{faq.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          )
        })}
      </div>
    </section>
  )
}
