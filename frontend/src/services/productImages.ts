import replacements from '../data/productImages.json'

export const productImagePlaceholder = '/images/placeholders/product.svg'

// Only replace the retired bundled illustrations; preserve owner-uploaded images.
export function resolveProductImage(imageUrl: string): string {
  return (replacements as Record<string, string>)[imageUrl] ?? (imageUrl || productImagePlaceholder)
}
