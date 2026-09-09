import { ScrollReveal } from '../../animations/ScrollReveal'
import { MaskedText } from '../motion/MaskedText'

export function EditorialIntro() {
  return (
    <section className="editorial-intro">
      <div className="section-index"><span>01</span><p>The connected store</p></div>
      <h2>
        <MaskedText>One inventory.</MaskedText>
        <MaskedText delay={0.08}>Every sale.</MaskedText>
        <MaskedText delay={0.16}>No blind spots.</MaskedText>
      </h2>
      <ScrollReveal className="editorial-intro-copy">
        <p>
          ASCENT brings the customer storefront and the store’s daily operation into the same
          reliable system—without making a small business feel like an enterprise maze.
        </p>
      </ScrollReveal>
    </section>
  )
}
