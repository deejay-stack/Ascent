import { ArrowUpRight, ShoppingBasket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StaggerContainer, StaggerItem } from '../../animations/StaggerContainer'
import { landingCategories } from '../../data/landingContent'
import { SectionHeading } from './SectionHeading'
import { useProducts } from '../../hooks/useProducts'
import { productService } from '../../services'

export function CategorySection() {
  const products = useProducts()
  const categories = productService
    .categories()
    .filter((category) => products.some((product) => product.categoryId === category.id))
  if (!categories.length) return null
  return (
    <section className="landing-section" id="categories">
      <SectionHeading
        description="Choose an aisle to browse the store's current catalog."
        eyebrow="Shop by category"
        title="Everyday essentials, easier to find."
      />
      <StaggerContainer className="category-grid">
        {categories.map(({ id, name }) => {
          const style = landingCategories.find((category) => category.name === name)
          const Icon = style?.icon ?? ShoppingBasket
          const tone = style?.tone ?? 'sage'
          const count = products.filter((product) => product.categoryId === id).length
          return (
            <StaggerItem key={id}>
              <Link className="category-card" to={`/products?category=${encodeURIComponent(id)}`}>
                <span className={`category-icon tone-${tone}`}>
                  <Icon size={24} />
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>
                    {count} {count === 1 ? 'product' : 'products'}
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </Link>
            </StaggerItem>
          )
        })}
      </StaggerContainer>
    </section>
  )
}
