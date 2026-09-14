import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  LockKeyhole,
  PackageSearch,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Store,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ScrollReveal } from '../../animations/ScrollReveal'
import { StaggerContainer, StaggerItem } from '../../animations/StaggerContainer'
import { roleBenefits, shoppingSteps } from '../../data/landingContent'
import { SectionHeading } from './SectionHeading'

export function WhyAscentSection() {
  const benefits = [
    { icon: PackageSearch, title: 'Availability you can trust', copy: 'Shopping and store operations work from the same stock picture.' },
    { icon: ScanLine, title: 'Less repeated work', copy: 'POS, orders, receipts, and inventory share one connected workflow.' },
    { icon: BadgeCheck, title: 'Clear ownership', copy: 'Role-aware workspaces keep responsibility and access understandable.' },
  ]

  return (
    <section className="landing-section why-section" id="about">
      <ScrollReveal>
        <SectionHeading
          description="ASCENT is being built around the practical needs of grocery and minimart teams—not generic enterprise ceremony."
          eyebrow="Why ASCENT"
          title="A calmer way to run a busy store."
        />
      </ScrollReveal>
      <StaggerContainer className="why-grid">
        {benefits.map(({ icon: Icon, title, copy }) => (
          <StaggerItem key={title}>
            <article><span><Icon size={22} /></span><h3>{title}</h3><p>{copy}</p></article>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  )
}

export function ShoppingProcessSection() {
  return (
    <section className="landing-section process-section">
      <SectionHeading
        align="center"
        eyebrow="Simple by design"
        title="From shelf to doorstep in three clear steps."
      />
      <StaggerContainer className="process-grid">
        {shoppingSteps.map((step) => (
          <StaggerItem key={step.number}>
            <article><span>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></article>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  )
}

export function PosInventorySection() {
  return (
    <section className="landing-section split-feature-section">
      <ScrollReveal className="split-feature-visual">
        <div className="mini-pos-window">
          <header><span><Store size={18} /> Counter sale</span><strong>Open</strong></header>
          <div className="mini-pos-items"><span /><span /><span /></div>
          <div className="mini-pos-total"><small>Total</small><strong>₱1,248.00</strong></div>
        </div>
      </ScrollReveal>
      <ScrollReveal className="split-feature-copy">
        <p className="eyebrow">POS meets inventory</p>
        <h2>Every completed sale tells inventory what changed.</h2>
        <p>
          The planned transaction workflow records the sale, payment, receipt, stock movement, and
          responsible staff member together—so speed at the counter does not cost accuracy later.
        </p>
        <ul>
          <li><ShieldCheck size={18} /> No negative inventory</li>
          <li><ScanLine size={18} /> Barcode-ready product lookup</li>
          <li><PackageSearch size={18} /> Traceable stock movement</li>
        </ul>
      </ScrollReveal>
    </section>
  )
}

export function RoleBenefitsSection() {
  return (
    <section className="landing-section roles-section">
      <SectionHeading
        align="center"
        description="One platform, with a workspace shaped around each person’s responsibilities."
        eyebrow="Made for the whole store"
        title="The right tools for every role."
      />
      <StaggerContainer className="role-benefit-grid">
        {roleBenefits.map(({ icon: Icon, label, title, description }) => (
          <StaggerItem key={label}>
            <article><span><Icon size={23} /></span><p>{label}</p><h3>{title}</h3><small>{description}</small></article>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  )
}

export function CheckoutTrustSection() {
  return (
    <section className="landing-section checkout-trust-section">
      <div>
        <p className="eyebrow">Checkout with clarity</p>
        <h2>Know what you are paying for, every step of the way.</h2>
        <p>Review items, fulfillment, fees, and payment status before confirming an order.</p>
        <div className="payment-tags">
          <span><Store size={17} /> Cash on pickup</span>
          <span><CreditCard size={17} /> Provider-ready</span>
          <span><Smartphone size={17} /> E-wallet integration</span>
        </div>
      </div>
      <div className="security-note">
        <LockKeyhole size={28} />
        <div><strong>Payment-safe by design</strong><p>ASCENT will never collect raw card details. Online methods remain clearly marked until a real provider is configured.</p></div>
      </div>
    </section>
  )
}

export function FinalCtaSection() {
  return (
    <section className="landing-section final-cta" id="contact">
      <div>
        <p className="eyebrow">Ready when your store is</p>
        <h2>Bring shopping and store operations into one clear system.</h2>
      </div>
      <div>
        <Link className="button button-primary" to="/products">Shop groceries <ArrowRight size={18} /></Link>
        <Link className="button button-secondary" to="/login">Sign in to ASCENT</Link>
      </div>
    </section>
  )
}
