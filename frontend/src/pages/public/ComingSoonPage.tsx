import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

type ComingSoonPageProps = {
  title: string
  description: string
}

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <section className="centered-state">
      <p className="eyebrow">ASCENT workspace</p>
      <h1>{title}</h1>
      <p>{description}</p>
      <Link className="secondary-link" to="/">
        <ArrowLeft size={18} /> Back home
      </Link>
    </section>
  )
}
