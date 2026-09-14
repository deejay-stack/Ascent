CREATE TABLE public.carts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at TIMESTAMP(3) NOT NULL
);
CREATE TABLE public.cart_items (
  user_id UUID NOT NULL REFERENCES public.carts(user_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  PRIMARY KEY (user_id, product_id)
);
CREATE TABLE public.cart_mutations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX cart_mutations_user_id_created_at_idx ON public.cart_mutations(user_id, created_at);
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_mutations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.carts, public.cart_items, public.cart_mutations FROM anon, authenticated;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('Awaiting payment','Completed','Cancelled'));
ALTER TABLE public.orders ADD CONSTRAINT orders_fulfillment_check CHECK (fulfillment IN ('Delivery','Store pickup'));
ALTER TABLE public.orders ADD CONSTRAINT orders_totals_check CHECK (subtotal >= 0 AND total >= 0);
ALTER TABLE public.payments ADD CONSTRAINT payments_total_check CHECK (total >= 0);
ALTER TABLE public.sales ADD CONSTRAINT sales_source_check CHECK (source IN ('pos','online'));
ALTER TABLE public.inventory_movements ADD CONSTRAINT movements_type_check CHECK (type IN ('sale','stock-in','stock-out','adjustment','order'));

-- Every business actor is an authenticated profile. Auth users remain managed by Supabase.
ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.sales ADD CONSTRAINT sales_cashier_id_fkey FOREIGN KEY (cashier_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD CONSTRAINT payments_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
