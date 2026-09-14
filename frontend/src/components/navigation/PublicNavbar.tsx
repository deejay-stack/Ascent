import {
  Home,
  Info,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { roleHomePaths } from '../../types/roles'
import { BrandMark } from '../BrandMark'
import { ThemeToggle } from '../ThemeToggle'
import { useAppTheme } from '../../hooks/useAppTheme'

const links = [
  { label: 'Overview', href: '/#overview', section: 'overview', icon: Home },
  { label: 'Shop', href: '/products', section: 'shop', icon: ShoppingBag },
  { label: 'Categories', href: '/#categories', section: 'categories', icon: LayoutGrid },
  { label: 'How it works', href: '/#how-it-works', section: 'how-it-works', icon: Sparkles },
  { label: 'For stores', href: '/#for-stores', section: 'for-stores', icon: Info },
  { label: 'FAQ', href: '/#faq', section: 'faq', icon: Info },
]

export function PublicNavbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const [query, setQuery] = useState('')
  const { itemCount } = useCart()
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useAppTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const lastScrollY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY
      setIsScrolled(currentY > 18)
      if (Math.abs(currentY - lastScrollY.current) > 8) {
        setIsHidden(currentY > 120 && currentY > lastScrollY.current)
        lastScrollY.current = currentY
      }
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isMobileOpen])

  useEffect(() => {
    if (location.pathname !== '/') return
    const targets = ['overview', 'shop', 'categories', 'how-it-works', 'for-stores', 'faq', 'contact']
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element))

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: [0.1, 0.4] },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [location.pathname])

  useEffect(() => {
    if (!location.hash || location.pathname !== '/') return
    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(location.hash)
      if (!target) return
      const isFullBleed = ['#overview', '#how-it-works'].includes(location.hash)
      window.scrollTo({ top: target.offsetTop - (isFullBleed ? 0 : 68), behavior: 'smooth' })
    })
  }, [location.hash, location.pathname])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    if (query.trim()) navigate(`/products?search=${encodeURIComponent(query.trim())}`)
  }

  const closeMenus = () => {
    setIsMobileOpen(false)
    setIsUserMenuOpen(false)
  }

  return (
    <header className={`public-navbar ${location.pathname === '/' ? 'is-overlay' : ''} ${isScrolled ? 'is-scrolled' : ''} ${isHidden ? 'is-hidden' : ''}`}>
      <div className="public-navbar-inner">
        <Link aria-label="ASCENT home" className="navbar-brand" onClick={closeMenus} to="/">
          <BrandMark />
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map((link) => (
            <Link className={(activeSection === link.section && location.pathname === '/') || (link.section === 'shop' && location.pathname.startsWith('/products')) ? 'is-active' : ''} key={link.label} to={link.href}>
              {link.label}
              {activeSection === link.section && location.pathname === '/' && <motion.span layoutId="public-nav-active" />}
            </Link>
          ))}
        </nav>
        <div className="navbar-actions">
          <form className="nav-search" onSubmit={submitSearch} role="search">
            <Search size={17} />
            <label className="sr-only" htmlFor="nav-product-search">Search products</label>
            <input id="nav-product-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search products" value={query} />
          </form>
          <Link aria-label={`Cart with ${itemCount} items`} className="nav-cart" to="/cart">
            <ShoppingCart size={19} /><span>Cart</span>{itemCount > 0 && <strong>{itemCount}</strong>}
          </Link>
          <ThemeToggle onToggle={toggleTheme} theme={theme} />
          {user ? (
            <div className="user-menu">
              <button aria-expanded={isUserMenuOpen} onClick={() => setIsUserMenuOpen((current) => !current)} type="button">
                <span>{user.name.charAt(0)}</span><small>{user.name.split(' ')[0]}</small>
              </button>
              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div animate={{ opacity: 1, y: 0 }} className="user-menu-popover" exit={{ opacity: 0, y: -5 }} initial={{ opacity: 0, y: -5 }}>
                    <Link onClick={closeMenus} to={roleHomePaths[user.role]}><User size={17} /> My workspace</Link>
                    <button onClick={() => { void signOut(); closeMenus() }} type="button"><LogOut size={17} /> Sign out</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link className="nav-sign-in" to="/login"><LogIn size={17} /> Sign in</Link>
          )}
          <Link className="nav-shop-button" to="/products">Shop <ShoppingBag size={16} /></Link>
          <button aria-expanded={isMobileOpen} aria-label="Open navigation" className="mobile-menu-button" onClick={() => setIsMobileOpen(true)} type="button"><Menu size={21} /></button>
        </div>
      </div>
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.button animate={{ opacity: 1 }} aria-label="Close navigation overlay" className="mobile-nav-overlay" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onClick={closeMenus} type="button" />
            <motion.nav animate={{ x: 0 }} aria-label="Mobile navigation" className="mobile-nav-drawer" exit={{ x: '100%' }} initial={{ x: '100%' }}>
              <div className="mobile-nav-header"><BrandMark /><button aria-label="Close navigation" onClick={closeMenus} type="button"><X size={21} /></button></div>
              <form className="mobile-search" onSubmit={submitSearch}><Search size={18} /><input aria-label="Search products" onChange={(event) => setQuery(event.target.value)} placeholder="Search groceries" value={query} /></form>
              <motion.div
                animate="visible"
                className="mobile-nav-links"
                initial="hidden"
                variants={{ visible: { transition: { delayChildren: 0.16, staggerChildren: 0.055 } } }}
              >
                {links.map(({ label, href, icon: Icon }, index) => (
                  <motion.div key={label} variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}>
                    <Link onClick={closeMenus} to={href}><small>{String(index + 1).padStart(2, '0')}</small><Icon size={19} /> <span>{label}</span></Link>
                  </motion.div>
                ))}
                <motion.div variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}>
                  <Link onClick={closeMenus} to="/#contact"><small>07</small><Info size={19} /> <span>Contact</span></Link>
                </motion.div>
              </motion.div>
              <div className="mobile-menu-actions">
                <Link className="editorial-button is-lime" onClick={closeMenus} to="/products">Shop groceries <ShoppingBag size={18} /></Link>
                {!user && <Link className="editorial-button is-ghost" onClick={closeMenus} to="/login"><LogIn size={18} /> Sign in</Link>}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
