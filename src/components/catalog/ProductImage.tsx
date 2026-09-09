export function ProductImage({product, className=''}: {product:{name:string;imageUrl:string};className?:string}) {
  return <img className={`product-image ${className}`} src={product.imageUrl} alt={`${product.name} — sample product packaging`} width={320} height={320} loading="lazy" onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src='/images/placeholders/product.svg'}} />
}

