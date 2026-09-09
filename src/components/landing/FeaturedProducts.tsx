import { Check, Plus, ShoppingBag } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StaggerContainer, StaggerItem } from '../../animations/StaggerContainer'
import { useProducts } from '../../hooks/useProducts'
import { ProductImage } from '../catalog/ProductImage'
import { useCart } from '../../hooks/useCart'
import { SectionHeading } from './SectionHeading'

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

export function FeaturedProducts() {
  const { addItem, items } = useCart()
  const featuredProducts = useProducts({ featured: true })
  const [lastAdded, setLastAdded] = useState<string | null>(null)

  const handleAdd = (productId: string) => {
    addItem(productId)
    setLastAdded(productId)
    window.setTimeout(() => setLastAdded((current) => (current === productId ? null : current)), 1200)
  }

  return (
    <section className="landing-section featured-section" id="shop">
      <div className="section-heading-row">
        <SectionHeading
          description="The essentials you reach for, ready for your next grocery run."
          eyebrow="Featured groceries"
          title="Familiar items, thoughtfully presented."
        />
        <Link className="text-link" to="/products">View the catalog <ShoppingBag size={17} /></Link>
      </div>
      <StaggerContainer className="product-grid">
        {featuredProducts.map((product) => (
          <StaggerItem key={product.id}>
            <motion.article className="product-card" whileHover={{ y: -4 }}>
              <Link aria-label={`View ${product.name}`} className="product-placeholder" to={`/products/${product.id}`}>
                <ProductImage product={product} />
              </Link>
              <div className="product-card-body">
                <p>{product.category}</p>
                <h3>{product.name}</h3>
                <div className="product-card-footer">
                  <span><strong>{peso.format(product.price)}</strong><small>{product.unit}</small></span>
                  <motion.button
                    disabled={!product.isAvailable || (items.find(l => l.productId === product.id)?.quantity ?? 0) >= product.stock}
                    aria-label={`Add ${product.name} to cart`}
                    className={lastAdded === product.id ? 'is-added' : ''}
                    onClick={() => handleAdd(product.id)}
                    type="button"
                    whileTap={{ scale: 0.92 }}
                  >
                    {lastAdded === product.id ? <Check size={18} /> : <Plus size={18} />}
                  </motion.button>
                </div>
              </div>
            </motion.article>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  )
}
