ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('Awaiting payment', 'Paid', 'Preparing', 'Ready for pickup', 'Out for delivery', 'Completed', 'Cancelled'));
