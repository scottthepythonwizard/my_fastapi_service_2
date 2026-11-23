-- Mirrors the pre-migration favorites, catalog and admin permissions.
ALTER TABLE sole.sneakers ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE public.sole_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.sole_admins(user_id) VALUES ('33333333-3333-4333-8333-333333333333');
ALTER TABLE public.sole_admins ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sole_admins TO authenticated;
CREATE POLICY sole_admins_read_self ON public.sole_admins FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

GRANT USAGE ON SCHEMA sole TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sole.sneakers TO authenticated;
GRANT USAGE ON SEQUENCE sole.sneakers_id_seq TO authenticated;
CREATE POLICY catalog_read_signed_in ON sole.sneakers FOR SELECT TO authenticated USING (true);
CREATE POLICY signed_in_catalog_admin ON sole.sneakers TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sole_admins WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sole_admins WHERE user_id = (SELECT auth.uid())));

CREATE TABLE public.favorites (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sneaker_id integer NOT NULL REFERENCES sole.sneakers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, sneaker_id)
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
CREATE POLICY favorites_read_own ON public.favorites FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY favorites_add_own ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY favorites_remove_own ON public.favorites FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE FUNCTION public.sole_favorites()
RETURNS TABLE(sneaker_id integer, created_at timestamptz, sneaker jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT f.sneaker_id, f.created_at, to_jsonb(s)
  FROM public.favorites f JOIN sole.sneakers s ON s.id = f.sneaker_id
  WHERE f.user_id = (SELECT auth.uid()) ORDER BY f.created_at DESC, f.sneaker_id
$$;
REVOKE ALL ON FUNCTION public.sole_favorites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sole_favorites() TO authenticated;
