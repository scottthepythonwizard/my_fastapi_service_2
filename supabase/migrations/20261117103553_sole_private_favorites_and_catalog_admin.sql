BEGIN;
CREATE TABLE public.favorites (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sneaker_id integer NOT NULL REFERENCES sole.sneakers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sneaker_id)
);
CREATE INDEX favorites_sneaker_id_idx ON public.favorites(sneaker_id);
COMMENT ON TABLE public.favorites IS 'Each signed-in user can list, add and remove only their own favorite sneakers. One favorite per user and sneaker.';
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.favorites FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
CREATE POLICY favorites_read_own ON public.favorites FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY favorites_add_own ON public.favorites FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY favorites_remove_own ON public.favorites FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.sole_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.sole_admins IS 'Administrator membership. Only the database owner or trusted server may grant/revoke membership; users cannot promote themselves.';
ALTER TABLE public.sole_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sole_admins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sole_admins TO authenticated;
GRANT ALL ON public.sole_admins TO service_role;
CREATE POLICY sole_admins_read_self ON public.sole_admins FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
GRANT USAGE ON SCHEMA sole TO authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['sneakers','lifestyle','basketball','running','football'] LOOP
    EXECUTE format('GRANT SELECT, UPDATE, DELETE ON sole.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY signed_in_catalog_admin ON sole.%I FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.sole_admins WHERE user_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.sole_admins WHERE user_id = (SELECT auth.uid())))',t);
  END LOOP;
END $$;

CREATE FUNCTION public.sole_admin_catalog()
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT to_jsonb(s) || to_jsonb(d) FROM sole.sneakers s JOIN (
    SELECT * FROM sole.lifestyle UNION ALL SELECT * FROM sole.basketball
    UNION ALL SELECT * FROM sole.running UNION ALL SELECT * FROM sole.football
  ) d USING(id) ORDER BY s.id;
$$;

CREATE FUNCTION public.sole_admin_update_sneaker(p_id integer, p_name text, p_retail_price text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE detail_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sole_admins WHERE user_id=(SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
  END IF;
  IF p_name IS NULL OR btrim(p_name)='' OR p_retail_price IS NULL OR btrim(p_retail_price)='' THEN
    RAISE EXCEPTION 'Name and retail price are required' USING ERRCODE='22023';
  END IF;
  SELECT lower(category) INTO detail_table FROM sole.sneakers WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sneaker not found' USING ERRCODE='P0002'; END IF;
  IF detail_table NOT IN ('lifestyle','basketball','running','football') THEN RAISE EXCEPTION 'Invalid category'; END IF;
  EXECUTE format('UPDATE sole.%I SET name=$1, retail_price=$2 WHERE id=$3',detail_table)
    USING btrim(p_name),btrim(p_retail_price),p_id;
END $$;

CREATE FUNCTION public.sole_admin_delete_sneaker(p_id integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sole_admins WHERE user_id=(SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM sole.sneakers WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sneaker not found' USING ERRCODE='P0002'; END IF;
  DELETE FROM sole.lifestyle WHERE id=p_id;
  DELETE FROM sole.basketball WHERE id=p_id;
  DELETE FROM sole.running WHERE id=p_id;
  DELETE FROM sole.football WHERE id=p_id;
  DELETE FROM sole.sneakers WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.sole_admin_catalog() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sole_admin_update_sneaker(integer,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sole_admin_delete_sneaker(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sole_admin_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sole_admin_update_sneaker(integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sole_admin_delete_sneaker(integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
