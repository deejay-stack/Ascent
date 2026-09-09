import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { BrandMark } from '../components/BrandMark'
import { BackToTop } from '../components/navigation/BackToTop'
import { PublicNavbar } from '../components/navigation/PublicNavbar'
import { ScrollProgress } from '../components/navigation/ScrollProgress'
import { AscentLoader } from '../components/loader/AscentLoader'
import { useInitialLoader } from '../hooks/useInitialLoader'

export function PublicLayout() {
  const location = useLocation()
  const showLoader = useInitialLoader(location.pathname === '/')
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)

  const handleSubscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newsletterEmail.includes('@')) return
    setIsSubscribed(true)
    setNewsletterEmail('')
  }

  return (
    <div className="public-shell">
      <AnimatePresence>{showLoader && <AscentLoader />}</AnimatePresence>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <ScrollProgress />
      <PublicNavbar />

      <main className="public-content" id="main-content">
        <Outlet />
      </main>

      <footer className="public-footer">
        <div className="footer-wordmark" aria-hidden="true">ASCENT</div>
        <div className="footer-main">
          <div className="footer-brand"><BrandMark /><p>Online grocery shopping and reliable store operations, moving forward together.</p></div>
          <div className="footer-newsletter">
            <h2>Store notes, without the noise.</h2>
            <p>Product updates and practical retail ideas.</p>
            {isSubscribed ? <strong>Thank you. You’re on the list.</strong> : (
              <form onSubmit={handleSubscribe}>
                <label className="sr-only" htmlFor="footer-email">Email address</label>
                <input id="footer-email" onChange={(event) => setNewsletterEmail(event.target.value)} placeholder="Email address" required type="email" value={newsletterEmail} />
                <button type="submit">Join <ArrowUpRight size={16} /></button>
              </form>
            )}
          </div>
          <div><h2>Explore</h2><Link to="/products">Shop</Link><Link to="/#categories">Categories</Link><Link to="/#for-stores">For stores</Link></div>
          <div><h2>Account</h2><Link to="/login">Sign in</Link><Link to="/register">Create account</Link><Link to="/cart">Cart</Link></div>
          <div><h2>Contact</h2><span><Mail size={16} /> hello@ascent.local</span><span><Phone size={16} /> Store contact pending</span><span><MapPin size={16} /> Philippines</span></div>
        </div>
        <div className="footer-bottom"><p>© {new Date().getFullYear()} ASCENT. Development preview.</p><Link to="/about">Platform information <ArrowUpRight size={15} /></Link></div>
      </footer>
      <BackToTop />
    </div>
  )
}
