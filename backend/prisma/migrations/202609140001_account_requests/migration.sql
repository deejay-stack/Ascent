ALTER TABLE public.profiles ADD COLUMN requested_role TEXT
  CHECK (requested_role IN ('staff', 'owner'));

-- Signup metadata may request access, but can never grant operational permissions.
CREATE OR REPLACE FUNCTION public.ascent_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id, name, email, role, requested_role, is_active, created_at, updated_at)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',''),split_part(NEW.email,'@',1)),
    NEW.email, 'customer',
    CASE WHEN NEW.raw_user_meta_data->>'requested_role' IN ('staff','owner')
      THEN NEW.raw_user_meta_data->>'requested_role' ELSE NULL END,
    true, now(), now())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ascent_new_auth_user() FROM PUBLIC;
