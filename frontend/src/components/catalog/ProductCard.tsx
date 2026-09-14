import { Check, Eye, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../../hooks/useCart";
import type { CatalogProduct } from "../../types/product";
import { money } from "../../services/money";
import { ProductVisual } from "./ProductVisual";
import { Modal } from "../ui/Modal";
import { QuantityControl } from "../pos/QuantityControl";
export function ProductCard({ product }: { product: CatalogProduct }) {
  const [added, setAdded] = useState(false),
    [quick, setQuick] = useState(false),
    [quantity, setQuantity] = useState(1);
  const { addItem, items } = useCart();
  const remaining =
    product.stock -
    (items.find((l) => l.productId === product.id)?.quantity ?? 0);
  const disabled = !product.isAvailable || remaining <= 0;
  const handleAdd = (n = 1) => {
    for (let i = 0; i < Math.min(n, remaining); i++) addItem(product.id);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1000);
  };
  const status = !product.isAvailable
    ? "Unavailable"
    : product.stock === 0
      ? "Out of stock"
      : product.stock <= product.lowStockThreshold
        ? `Low stock · ${product.stock} left`
        : `${product.stock} in stock`;
  return (
    <article className="catalog-card">
      <Link aria-label={`View ${product.name}`} to={`/products/${product.id}`}>
        <ProductVisual product={product} />
      </Link>
      <div className="catalog-card-body">
        <p className="catalog-category">{product.category}</p>
        <Link to={`/products/${product.id}`}>
          <h2>{product.name}</h2>
        </Link>
        <p className="catalog-description">{product.description}</p>
        <div className="catalog-card-meta">
          <span>
            <strong>{money(product.price)}</strong>
            <small> / {product.unit}</small>
          </span>
          <small
            className={
              product.stock <= product.lowStockThreshold ? "stock-low" : ""
            }
          >
            {status}
          </small>
        </div>
        <button
          className={added ? "catalog-add is-added" : "catalog-add"}
          disabled={disabled}
          onClick={() => handleAdd()}
        >
          {added ? <Check size={18} /> : <Plus size={18} />}{" "}
          {added
            ? "Added to cart"
            : remaining <= 0 && product.stock > 0
              ? "Stock limit reached"
              : "Add to cart"}
        </button>
        <button
          className="quick-view-button"
          onClick={() => {
            setQuick(true);
            setQuantity(1);
          }}
        >
          <Eye size={15} />
          Quick view
        </button>
      </div>
      {quick && (
        <Modal title={product.name} onClose={() => setQuick(false)}>
          <div className="quick-view-content">
            <ProductVisual product={product} />
            <p className="eyebrow">{product.category}</p>
            <p>{product.description}</p>
            <p>
              {product.brand} · {product.sku}
            </p>
            <p>{status}</p>
            <strong>
              {money(product.price)} / {product.unit}
            </strong>
            <QuantityControl
              name={product.name}
              value={Math.min(quantity, Math.max(1, remaining))}
              max={remaining}
              onChange={setQuantity}
            />
            <button
              className="button button-primary"
              disabled={disabled}
              onClick={() => handleAdd(quantity)}
            >
              Add to cart
            </button>
            <Link className="text-action" to={`/products/${product.id}`}>
              Full product details
            </Link>
          </div>
        </Modal>
      )}
    </article>
  );
}
