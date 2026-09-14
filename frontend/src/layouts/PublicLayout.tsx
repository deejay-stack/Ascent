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
import { request } from '../services/api'

export function PublicLayout() {
  const location = useLocation()
  const showLoader = useInitialLoader(location.pathname === '/')
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [newsletterError, setNewsletterError] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newsletterEmail.includes('@')) return
    setSubscribing(true)
    setNewsletterError('')
    try {
      await request('/api/newsletter', {method:'POST',body:JSON.stringify({email:newsletterEmail})})
      setIsSubscribed(true)
      setNewsletterEmail('')
    } catch(error) { setNewsletterError(error instanceof Error?error.message:'Subscription could not be saved.') }
    finally { setSubscribing(false) }
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
                <button disabled={subscribing} type="submit">{subscribing?'Saving…':'Join'} <ArrowUpRight size={16} /></button>
              </form>
            )}
            {newsletterError&&<p className="form-error" role="alert">{newsletterError}</p>}
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
