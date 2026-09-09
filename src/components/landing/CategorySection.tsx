import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StaggerContainer, StaggerItem } from '../../animations/StaggerContainer'
import { landingCategories } from '../../data/landingContent'
import { SectionHeading } from './SectionHeading'

export function CategorySection() {
  return (
    <section className="landing-section" id="categories">
      <SectionHeading
        description="Start with the aisle you know. Each shortcut will connect to the filterable catalog in the product phase."
        eyebrow="Shop by category"
        title="Everyday essentials, easier to find."
      />
      <StaggerContainer className="category-grid">
        {landingCategories.map(({ name, description, icon: Icon, tone }) => (
          <StaggerItem key={name}>
            <Link className="category-card" to={`/products?category=${encodeURIComponent(name)}`}>
              <span className={`category-icon tone-${tone}`}><Icon size={24} /></span>
              <span><strong>{name}</strong><small>{description}</small></span>
              <ArrowUpRight size={17} />
            </Link>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  )
}
