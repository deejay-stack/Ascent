-- Preserve historical actor IDs while freeing emails when Auth accounts are deleted.
ALTER TABLE public.profiles ADD COLUMN auth_deleted_at TIMESTAMP(3);
UPDATE public.profiles p
SET auth_deleted_at = now(), is_active = false, requested_role = NULL, updated_at = now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND u.deleted_at IS NULL);

DROP INDEX public.profiles_email_key;
CREATE INDEX profiles_email_idx ON public.profiles(email);
-- Prisma cannot model this partial uniqueness constraint. Keep it in migration SQL.
CREATE UNIQUE INDEX profiles_current_email_key ON public.profiles(lower(email))
WHERE auth_deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.ascent_auth_user_deleted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles SET auth_deleted_at = now(), is_active = false,
    requested_role = NULL, updated_at = now() WHERE id = OLD.id AND auth_deleted_at IS NULL;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.ascent_auth_user_deleted() FROM PUBLIC;
CREATE TRIGGER ascent_auth_user_deleted AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ascent_auth_user_deleted();
CREATE TRIGGER ascent_auth_user_soft_deleted AFTER UPDATE OF deleted_at ON auth.users
FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.ascent_auth_user_deleted();

CREATE OR REPLACE FUNCTION public.ascent_new_auth_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Recover old orphan rows too, including rows made before the deletion trigger existed.
  UPDATE public.profiles p SET auth_deleted_at = now(), is_active = false,
    requested_role = NULL, updated_at = now()
  WHERE lower(p.email) = lower(NEW.email) AND p.id <> NEW.id AND p.auth_deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p.id AND u.deleted_at IS NULL);
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
