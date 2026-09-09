import { authHighlights, landingMetrics } from '../../data/authContent'
import { BrandMark } from '../../components/BrandMark'

export function ProductStory() {
  return (
    <section className="landing-story" aria-labelledby="landing-title">
      <div className="flex items-center justify-between gap-4">
        <BrandMark />
        <span className="rounded-full border border-ink-200 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-600 shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-ink-200">
          SME Platform
        </span>
      </div>

      <div className="relative mt-14 max-w-3xl">
        <div className="glow-grid" aria-hidden="true" />
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-500">
          Grocery and mini-mart operations
        </p>
        <h1 id="landing-title" className="max-w-3xl text-5xl font-extrabold leading-[1.02] text-ink-950 dark:text-white md:text-7xl">
          Run every shelf, sale, and receipt from one place.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-ink-600 dark:text-ink-200 md:text-lg">
          Ascent starts with secure access, then grows into storefront, POS, inventory, orders,
          invoices, and reporting without making a small store feel like an enterprise maze.
        </p>
      </div>

      <div className="mt-9 grid gap-3 md:grid-cols-3">
        {landingMetrics.map((metric) => (
          <article className="metric-tile" key={metric.label}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-300">
              {metric.label}
            </p>
            <p className="mt-3 font-mono text-3xl font-bold text-ink-950 dark:text-white">{metric.value}</p>
            <p className="mt-2 text-sm leading-6 text-ink-600 dark:text-ink-300">{metric.detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 grid gap-3">
        {authHighlights.map((highlight) => (
          <div className="highlight-row" key={highlight}>
            <span aria-hidden="true" />
            <p>{highlight}</p>
          </div>
        ))}
      </div>

    </section>
  )
}
