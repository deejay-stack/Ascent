import type { CatalogProduct } from "../../types/product";
import { ProductImage } from "./ProductImage";
export function ProductVisual({
  product,
  compact = false,
}: {
  product: CatalogProduct;
  compact?: boolean;
}) {
  return (
    <div className={`catalog-product-visual ${compact ? "is-compact" : ""}`}>
      <ProductImage product={product} />
    </div>
  );
}
