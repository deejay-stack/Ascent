import { PageTransition } from '../../animations/PageTransition'
import { CategorySection } from '../../components/landing/CategorySection'
import { FaqSection } from '../../components/landing/FaqSection'
import { FeatureTabs } from '../../components/landing/FeatureTabs'
import { FeaturedProducts } from '../../components/landing/FeaturedProducts'
import { HomeHero } from '../../components/landing/HomeHero'
import { EditorialIntro } from '../../components/landing/EditorialIntro'
import { StickyStory } from '../../components/landing/StickyStory'
import {
  CheckoutTrustSection,
  FinalCtaSection,
  RoleBenefitsSection,
} from '../../components/landing/LandingStorySections'

export function HomePage() {
  return (
    <PageTransition className="home-page">
      <HomeHero />
      <EditorialIntro />
      <CategorySection />
      <StickyStory />
      <FeaturedProducts />
      <FeatureTabs />
      <RoleBenefitsSection />
      <CheckoutTrustSection />
      <FaqSection />
      <FinalCtaSection />
    </PageTransition>
  )
}
