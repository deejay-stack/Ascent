import { CheckCircle2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { managementTabs } from '../../data/landingContent'
import { SectionHeading } from './SectionHeading'

export function FeatureTabs() {
  const [activeId, setActiveId] = useState(managementTabs[0].id)
  const activeTab = managementTabs.find((tab) => tab.id === activeId) ?? managementTabs[0]
  const ActiveIcon = activeTab.icon

  return (
    <section className="landing-section feature-tabs-section" id="for-stores">
      <SectionHeading
        align="center"
        description="Purpose-built workflows meet in one system, while each role sees only the tools appropriate to their work."
        eyebrow="One reliable platform"
        title="From first scan to final report."
      />
      <div className="feature-tabs" role="tablist" aria-label="ASCENT capabilities">
        {managementTabs.map(({ id, label, icon: Icon }) => (
          <button
            aria-selected={id === activeId}
            className={id === activeId ? 'is-active' : ''}
            key={id}
            onClick={() => setActiveId(id)}
            role="tab"
            type="button"
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="feature-tab-panel"
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 8 }}
          key={activeTab.id}
        >
          <div className="feature-panel-copy">
            <span><ActiveIcon size={24} /></span>
            <h3>{activeTab.title}</h3>
            <p>{activeTab.description}</p>
            <ul>
              {activeTab.points.map((point) => <li key={point}><CheckCircle2 size={17} /> {point}</li>)}
            </ul>
          </div>
          <div className={`feature-panel-visual visual-${activeTab.id}`} aria-hidden="true">
            <div className="visual-toolbar"><span /><span /><span /></div>
            <div className="visual-metric-row"><span /><span /><span /></div>
            <div className="visual-content-row"><span /><span /></div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
