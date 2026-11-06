ALTER TABLE public.sales ALTER COLUMN cashier_id DROP NOT NULL;
ALTER TABLE public.sales ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
UPDATE public.sales s SET is_demo = p.is_demo FROM public.payments p WHERE p.id = s.payment_id;
ALTER TABLE public.payments DROP CONSTRAINT payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check CHECK (method IN ('cash','gcash','maya','card','paypal','qrph'));
ALTER TABLE public.payments ADD COLUMN provider TEXT, ADD COLUMN provider_session_id TEXT,
  ADD COLUMN provider_payment_id TEXT, ADD COLUMN checkout_url TEXT,
  ADD COLUMN checkout_started_at TIMESTAMP(3), ADD COLUMN currency TEXT NOT NULL DEFAULT 'PHP';
CREATE UNIQUE INDEX payments_provider_provider_session_id_key ON public.payments(provider, provider_session_id);
CREATE UNIQUE INDEX payments_provider_provider_payment_id_key ON public.payments(provider, provider_payment_id);
ALTER TABLE public.orders ADD COLUMN payment_id TEXT UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash', ADD COLUMN contact_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '', ADD COLUMN delivery_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN request_hash TEXT, ADD COLUMN updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE public.orders o SET payment_id = s.payment_id, payment_method = s.payment_method FROM public.sales s WHERE s.order_id = o.id;
CREATE TABLE public.order_events (
  id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL, actor TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX order_events_order_id_created_at_idx ON public.order_events(order_id, created_at);
CREATE TABLE public.notifications (
  id TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, message TEXT NOT NULL,
  read_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX notifications_user_id_created_at_idx ON public.notifications(user_id, created_at);
CREATE TABLE public.payment_webhooks (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, event_type TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_events, public.notifications, public.payment_webhooks FROM anon, authenticated;
