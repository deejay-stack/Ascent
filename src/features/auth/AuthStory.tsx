import { ShieldCheck, ShoppingBasket, Store } from 'lucide-react'
import { BrandMark } from '../../components/BrandMark'
import { SplitTextReveal } from '../../components/motion/SplitTextReveal'

export function AuthStory() {
  return (
    <section className="auth-story">
      <img alt="Store staff member scanning fresh produce at a grocery checkout" src="/images/story/operate.jpg" />
      <div className="auth-story-shade" />
      <div className="auth-story-content">
        <BrandMark />
        <p>Secure access / role-aware workspace</p>
        <h1><SplitTextReveal lines={['Your store.', 'Your role.', 'One ASCENT.']} /></h1>
        <ul>
          <li><ShoppingBasket size={17} /> Customer shopping</li>
          <li><Store size={17} /> Staff operations</li>
          <li><ShieldCheck size={17} /> Owner control</li>
        </ul>
      </div>
    </section>
  )
}
