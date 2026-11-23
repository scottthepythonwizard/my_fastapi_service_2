ALTER TABLE public.favorites
  ADD COLUMN size numeric,
  ADD COLUMN size_system text,
  ADD CONSTRAINT favorites_valid_size CHECK (
    (size IS NULL OR (size > 0 AND size <= 100 AND scale(size) <= 3))
    AND (size_system IS NULL OR (size IS NOT NULL AND size_system IN ('us_men', 'us_women', 'us', 'uk', 'eu')))
  );

CREATE POLICY favorites_update_own ON public.favorites
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT UPDATE (size, size_system) ON public.favorites TO authenticated;

-- One atomic write handles both first saves and concurrent size changes.
CREATE FUNCTION public.sole_save_favorite(
  p_sneaker_id integer, p_size numeric DEFAULT NULL, p_size_system text DEFAULT NULL
) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$
  INSERT INTO public.favorites AS favorite (sneaker_id, size, size_system)
  VALUES (p_sneaker_id, p_size, p_size_system)
  ON CONFLICT (user_id, sneaker_id) DO UPDATE
  SET size = EXCLUDED.size, size_system = EXCLUDED.size_system
  WHERE EXCLUDED.size IS NOT NULL
    AND (favorite.size, favorite.size_system) IS DISTINCT FROM (EXCLUDED.size, EXCLUDED.size_system);
$$;

REVOKE ALL ON FUNCTION public.sole_save_favorite(integer, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sole_save_favorite(integer, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
