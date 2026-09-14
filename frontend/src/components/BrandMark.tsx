import { Sprout } from 'lucide-react'

type BrandMarkProps = {
  compact?: boolean
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="brand-mark" aria-hidden="true"><Sprout size={22} strokeWidth={2.2} /></span>
      {!compact && (
        <span className="min-w-0">
          <span className="brand-wordmark">
            ASCENT
          </span>
          <span className="brand-tagline">
            Commerce & operations
          </span>
        </span>
      )}
    </div>
  )
}
