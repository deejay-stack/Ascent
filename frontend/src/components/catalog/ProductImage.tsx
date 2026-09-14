import { useState } from 'react'
import { productImagePlaceholder, resolveProductImage } from '../../services/productImages'

export function ProductImage({
  product,
  className = '',
}: {
  product: { name: string; imageUrl: string }
  className?: string
}) {
  const source = resolveProductImage(product.imageUrl)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const src = failedSource === source ? productImagePlaceholder : source
  return (
    <img
      key={source}
      className={`product-image ${className}`}
      src={src}
      alt={src === productImagePlaceholder ? `${product.name} — photo unavailable` : product.name}
      width={320}
      height={320}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (src !== productImagePlaceholder) setFailedSource(source)
      }}
    />
  )
}
