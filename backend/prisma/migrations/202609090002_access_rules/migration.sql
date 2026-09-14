-- All application mutations pass through the authenticated Express service.
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('owner','staff','customer'));
ALTER TABLE public.products ADD CONSTRAINT products_stock_check CHECK (stock_quantity >= 0 AND low_stock_threshold >= 0);
ALTER TABLE public.products ADD CONSTRAINT products_prices_check CHECK (cost_price >= 0 AND selling_price >= 0);
ALTER TABLE public.inventory_movements ADD CONSTRAINT movements_quantity_check CHECK ("before" >= 0 AND "after" >= 0 AND quantity = "after" - "before");
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_quantity_check CHECK (quantity > 0 AND unit_price >= 0 AND total >= 0);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0 AND price >= 0 AND line_total >= 0);
ALTER TABLE public.sales ADD CONSTRAINT sales_totals_check CHECK (subtotal >= 0 AND discount >= 0 AND discount <= subtotal AND tax >= 0 AND total = subtotal - discount + tax AND amount_received >= total AND change = amount_received - total);
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending','succeeded','failed','cancelled'));
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check CHECK (method IN ('cash','gcash','maya','card'));
ALTER TABLE public.store_events ADD CONSTRAINT events_scope_check CHECK (scope IN ('catalog','operations','customer'));
ALTER TABLE public.store_settings ADD CONSTRAINT settings_tax_check CHECK (tax_rate >= 0 AND tax_rate <= 100);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles, public.categories, public.products, public.sales, public.sale_items, public.payments, public.inventory_movements, public.orders, public.order_items, public.store_settings, public.newsletter_subscriptions, public.store_events FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.store_events TO anon, authenticated;
CREATE POLICY ascent_profile_self_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY ascent_public_catalog_events ON public.store_events FOR SELECT TO anon, authenticated USING (scope = 'catalog');
CREATE POLICY ascent_authorized_events ON public.store_events FOR SELECT TO authenticated USING (
  (scope = 'customer' AND audience_id = auth.uid()) OR
  (scope = 'operations' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active AND role IN ('owner','staff')))
);

CREATE FUNCTION public.ascent_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id, name, email, role, is_active, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',''),split_part(NEW.email,'@',1)),NEW.email,'customer',true,now(),now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ascent_new_auth_user() FROM PUBLIC;
CREATE TRIGGER ascent_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.ascent_new_auth_user();

-- Publish only small invalidation records, never sensitive product cost or payment rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='store_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_events;
  END IF;
END $$;

