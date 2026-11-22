BEGIN; SET LOCAL timezone='UTC'; LOCK TABLE sole.sneakers,public.favorites,public.sole_admins IN EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS((SELECT to_jsonb(s) FROM sole.sneakers s EXCEPT SELECT record FROM sole_recovery_20261122.merged_before) UNION ALL(SELECT record FROM sole_recovery_20261122.merged_before EXCEPT SELECT to_jsonb(s) FROM sole.sneakers s)) THEN RAISE EXCEPTION 'Catalog changed since migration; reconcile before rollback'; END IF;
END $$;
DROP FUNCTION public.sole_favorites() RESTRICT; DROP POLICY catalog_read_signed_in ON sole.sneakers;
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_23";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_24";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_25";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_26";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_27";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_28";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_29";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_30";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_31";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_32";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_33";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_34";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_35";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_36";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_37";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_38";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_39";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_40";
ALTER TABLE sole.sneakers DROP CONSTRAINT "sneakers_detail_41";
ALTER TABLE sole.sneakers DROP COLUMN "brand" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "name" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "year" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "descriptive_overview" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "gender_target" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "retail_price" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "colorway" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "description" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "details_specifications" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "review_stars" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "materials" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "country_of_origin" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "closure_type" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "cut" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "sole_material" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "cushioning" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "weight_g" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "release_month" RESTRICT;
ALTER TABLE sole.sneakers DROP COLUMN "image_url" RESTRICT;
CREATE TABLE sole."basketball" ("id" integer NOT NULL,
"brand" text NOT NULL,
"name" text NOT NULL,
"year" integer,
"descriptive_overview" text NOT NULL,
"gender_target" text NOT NULL,
"retail_price" text NOT NULL,
"colorway" text NOT NULL,
"description" text NOT NULL,
"details_specifications" text NOT NULL,
"review_stars" double precision NOT NULL,
"materials" text NOT NULL,
"country_of_origin" text NOT NULL,
"closure_type" text NOT NULL,
"cut" text NOT NULL,
"sole_material" text NOT NULL,
"cushioning" text NOT NULL,
"weight_g" double precision,
"release_month" integer,
"image_url" text NOT NULL);
ALTER TABLE sole."basketball" ADD CONSTRAINT "Basketball_pkey" PRIMARY KEY (id);
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_brand_check" CHECK ((btrim(brand) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_closure_type_check" CHECK ((closure_type = ANY (ARRAY['Lace-up'::text, 'Laceless'::text, 'Slip-on'::text, 'Hook-and-loop'::text, 'Not documented'::text])));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_colorway_check" CHECK ((btrim(colorway) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_country_of_origin_check" CHECK ((btrim(country_of_origin) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_cushioning_check" CHECK ((btrim(cushioning) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_cut_check" CHECK ((cut = ANY (ARRAY['Low'::text, 'Mid'::text, 'High'::text, 'Not documented'::text])));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_description_check" CHECK ((btrim(description) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_descriptive_overview_check" CHECK ((btrim(descriptive_overview) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_details_specifications_check" CHECK ((btrim(details_specifications) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_gender_target_check" CHECK ((gender_target = ANY (ARRAY['Men'::text, 'Women'::text, 'Both'::text])));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_image_url_check" CHECK ((btrim(image_url) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_materials_check" CHECK ((btrim(materials) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_name_check" CHECK ((btrim(name) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_release_month_check" CHECK (((release_month >= 1) AND (release_month <= 12)));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_retail_price_check" CHECK ((btrim(retail_price) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_review_stars_check" CHECK (((review_stars >= (0)::double precision) AND (review_stars <= (5)::double precision)));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_sole_material_check" CHECK ((btrim(sole_material) <> ''::text));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_weight_g_check" CHECK (((weight_g > (0)::double precision) AND (weight_g < 'Infinity'::double precision)));
ALTER TABLE sole."basketball" ADD CONSTRAINT "basketball_year_check" CHECK (((year >= 1800) AND (year <= 2200)));
ALTER TABLE sole."basketball" ADD CONSTRAINT "Basketball_id_fkey" FOREIGN KEY (id) REFERENCES sole.sneakers(id);
INSERT INTO sole."basketball" SELECT * FROM sole_recovery_20261122.basketball_before;
ALTER TABLE sole."basketball" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_api_access" ON sole."basketball" AS PERMISSIVE FOR ALL TO sole_catalog_api USING (true) WITH CHECK (true);
CREATE POLICY "signed_in_catalog_admin" ON sole."basketball" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM sole_admins
  WHERE (sole_admins.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM sole_admins
  WHERE (sole_admins.user_id = ( SELECT auth.uid() AS uid)))));
GRANT INSERT ON sole."basketball" TO "postgres";
GRANT SELECT ON sole."basketball" TO "postgres";
GRANT UPDATE ON sole."basketball" TO "postgres";
GRANT DELETE ON sole."basketball" TO "postgres";
GRANT TRUNCATE ON sole."basketball" TO "postgres";
GRANT REFERENCES ON sole."basketball" TO "postgres";
GRANT TRIGGER ON sole."basketball" TO "postgres";
GRANT INSERT ON sole."basketball" TO "sole_catalog_api";
GRANT SELECT ON sole."basketball" TO "sole_catalog_api";
GRANT UPDATE ON sole."basketball" TO "sole_catalog_api";
GRANT DELETE ON sole."basketball" TO "sole_catalog_api";
GRANT INSERT ON sole."basketball" TO "authenticated";
GRANT SELECT ON sole."basketball" TO "authenticated";
GRANT UPDATE ON sole."basketball" TO "authenticated";
GRANT DELETE ON sole."basketball" TO "authenticated";
CREATE TABLE sole."running" ("id" integer NOT NULL,
"brand" text NOT NULL,
"name" text NOT NULL,
"year" integer,
"descriptive_overview" text NOT NULL,
"gender_target" text NOT NULL,
"retail_price" text NOT NULL,
"colorway" text NOT NULL,
"description" text NOT NULL,
"details_specifications" text NOT NULL,
"review_stars" double precision NOT NULL,
"materials" text NOT NULL,
"country_of_origin" text NOT NULL,
"closure_type" text NOT NULL,
"cut" text NOT NULL,
"sole_material" text NOT NULL,
"cushioning" text NOT NULL,
"weight_g" double precision,
"release_month" integer,
"image_url" text NOT NULL);
ALTER TABLE sole."running" ADD CONSTRAINT "Running_pkey" PRIMARY KEY (id);
ALTER TABLE sole."running" ADD CONSTRAINT "running_brand_check" CHECK ((btrim(brand) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_closure_type_check" CHECK ((closure_type = ANY (ARRAY['Lace-up'::text, 'Laceless'::text, 'Slip-on'::text, 'Hook-and-loop'::text, 'Not documented'::text])));
ALTER TABLE sole."running" ADD CONSTRAINT "running_colorway_check" CHECK ((btrim(colorway) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_country_of_origin_check" CHECK ((btrim(country_of_origin) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_cushioning_check" CHECK ((btrim(cushioning) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_cut_check" CHECK ((cut = ANY (ARRAY['Low'::text, 'Mid'::text, 'High'::text, 'Not documented'::text])));
ALTER TABLE sole."running" ADD CONSTRAINT "running_description_check" CHECK ((btrim(description) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_descriptive_overview_check" CHECK ((btrim(descriptive_overview) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_details_specifications_check" CHECK ((btrim(details_specifications) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_gender_target_check" CHECK ((gender_target = ANY (ARRAY['Men'::text, 'Women'::text, 'Both'::text])));
ALTER TABLE sole."running" ADD CONSTRAINT "running_image_url_check" CHECK ((btrim(image_url) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_materials_check" CHECK ((btrim(materials) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_name_check" CHECK ((btrim(name) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_release_month_check" CHECK (((release_month >= 1) AND (release_month <= 12)));
ALTER TABLE sole."running" ADD CONSTRAINT "running_retail_price_check" CHECK ((btrim(retail_price) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_review_stars_check" CHECK (((review_stars >= (0)::double precision) AND (review_stars <= (5)::double precision)));
ALTER TABLE sole."running" ADD CONSTRAINT "running_sole_material_check" CHECK ((btrim(sole_material) <> ''::text));
ALTER TABLE sole."running" ADD CONSTRAINT "running_weight_g_check" CHECK (((weight_g > (0)::double precision) AND (weight_g < 'Infinity'::double precision)));
ALTER TABLE sole."running" ADD CONSTRAINT "running_year_check" CHECK (((year >= 1800) AND (year <= 2200)));
ALTER TABLE sole."running" ADD CONSTRAINT "Running_id_fkey" FOREIGN KEY (id) REFERENCES sole.sneakers(id);
INSERT INTO sole."running" SELECT * FROM sole_recovery_20261122.running_before;
ALTER TABLE sole."running" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_api_access" ON sole."running" AS PERMISSIVE FOR ALL TO sole_catalog_api USING (true) WITH CHECK (true);
CREATE POLICY "signed_in_catalog_admin" ON sole."running" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM sole_admins
  WHERE (sole_admins.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM sole_admins
  WHERE (sole_admins.user_id = ( SELECT auth.uid() AS uid)))));
GRANT INSERT ON sole."running" TO "postgres";
GRANT SELECT ON sole."running" TO "postgres";
GRANT UPDATE ON sole."running" TO "postgres";
GRANT DELETE ON sole."running" TO "postgres";
GRANT TRUNCATE ON sole."running" TO "postgres";
GRANT REFERENCES ON sole."running" TO "postgres";
GRANT TRIGGER ON sole."running" TO "postgres";
GRANT INSERT ON sole."running" TO "sole_catalog_api";
GRANT SELECT ON sole."running" TO "sole_catalog_api";
GRANT UPDATE ON sole."running" TO "sole_catalog_api";
GRANT DELETE ON sole."running" TO "sole_catalog_api";
GRANT INSERT ON sole."running" TO "authenticated";
GRANT SELECT ON sole."running" TO "authenticated";
GRANT UPDATE ON sole."running" TO "authenticated";
GRANT DELETE ON sole."running" TO "authenticated";
CREATE TABLE sole."lifestyle" ("id" integer NOT NULL,
"brand" text NOT NULL,
"name" text NOT NULL,
"year" integer,
"descriptive_overview" text NOT NULL,
"gender_target" text NOT NULL,
"retail_price" text NOT NULL,
"colorway" text NOT NULL,
"description" text NOT NULL,
"details_specifications" text NOT NULL,
"review_stars" double precision NOT NULL,
"materials" text NOT NULL,
"country_of_origin" text NOT NULL,
"closure_type" text NOT NULL,
"cut" text NOT NULL,
"sole_material" text NOT NULL,
"cushioning" text NOT NULL,
"weight_g" double precision,
"release_month" integer,
"image_url" text NOT NULL);
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "LIfestyle_pkey" PRIMARY KEY (id);
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_brand_check" CHECK ((btrim(brand) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_closure_type_check" CHECK ((closure_type = ANY (ARRAY['Lace-up'::text, 'Laceless'::text, 'Slip-on'::text, 'Hook-and-loop'::text, 'Not documented'::text])));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_colorway_check" CHECK ((btrim(colorway) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_country_of_origin_check" CHECK ((btrim(country_of_origin) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_cushioning_check" CHECK ((btrim(cushioning) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_cut_check" CHECK ((cut = ANY (ARRAY['Low'::text, 'Mid'::text, 'High'::text, 'Not documented'::text])));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_description_check" CHECK ((btrim(description) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_descriptive_overview_check" CHECK ((btrim(descriptive_overview) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_details_specifications_check" CHECK ((btrim(details_specifications) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_gender_target_check" CHECK ((gender_target = ANY (ARRAY['Men'::text, 'Women'::text, 'Both'::text])));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_image_url_check" CHECK ((btrim(image_url) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_materials_check" CHECK ((btrim(materials) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_name_check" CHECK ((btrim(name) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_release_month_check" CHECK (((release_month >= 1) AND (release_month <= 12)));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_retail_price_check" CHECK ((btrim(retail_price) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_review_stars_check" CHECK (((review_stars >= (0)::double precision) AND (review_stars <= (5)::double precision)));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_sole_material_check" CHECK ((btrim(sole_material) <> ''::text));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_weight_g_check" CHECK (((weight_g > (0)::double precision) AND (weight_g < 'Infinity'::double precision)));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "lifestyle_year_check" CHECK (((year >= 1800) AND (year <= 2200)));
ALTER TABLE sole."lifestyle" ADD CONSTRAINT "LIfestyle_id_fkey" FOREIGN KEY (id) REFERENCES sole.sneakers(id);
INSERT INTO sole."lifestyle" SELECT * FROM sole_recovery_20261122.lifestyle_before;
ALTER TABLE sole."lifestyle" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_api_access" ON sole."lifestyle" AS PERMISSIVE FOR ALL TO sole_catalog_api USING (true) WITH CHECK (true);
CREATE POLICY "signed_in_catalog_admin" ON sole."lifestyle" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM sole_admins
  WHERE (sole_admins.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM sole_admins
  WHERE (sole_admins.user_id = ( SELECT auth.uid() AS uid)))));
GRANT INSERT ON sole."lifestyle" TO "postgres";
GRANT SELECT ON sole."lifestyle" TO "postgres";
GRANT UPDATE ON sole."lifestyle" TO "postgres";
GRANT DELETE ON sole."lifestyle" TO "postgres";
GRANT TRUNCATE ON sole."lifestyle" TO "postgres";
GRANT REFERENCES ON sole."lifestyle" TO "postgres";
GRANT TRIGGER ON sole."lifestyle" TO "postgres";
GRANT INSERT ON sole."lifestyle" TO "sole_catalog_api";
GRANT SELECT ON sole."lifestyle" TO "sole_catalog_api";
GRANT UPDATE ON sole."lifestyle" TO "sole_catalog_api";
GRANT DELETE ON sole."lifestyle" TO "sole_catalog_api";
GRANT INSERT ON sole."lifestyle" TO "authenticated";
GRANT SELECT ON sole."lifestyle" TO "authenticated";
GRANT UPDATE ON sole."lifestyle" TO "authenticated";
GRANT DELETE ON sole."lifestyle" TO "authenticated";
CREATE TABLE sole."football" ("id" integer NOT NULL,
"brand" text NOT NULL,
"name" text NOT NULL,
"year" integer,
"descriptive_overview" text NOT NULL,
"gender_target" text NOT NULL,
"retail_price" text NOT NULL,
"colorway" text NOT NULL,
"description" text NOT NULL,
"details_specifications" text NOT NULL,
"review_stars" double precision NOT NULL,
"materials" text NOT NULL,
"country_of_origin" text NOT NULL,
"closure_type" text NOT NULL,
"cut" text NOT NULL,
"sole_material" text NOT NULL,
"cushioning" text NOT NULL,
"weight_g" double precision,
"release_month" integer,
"image_url" text NOT NULL);
ALTER TABLE sole."football" ADD CONSTRAINT "Football_pkey" PRIMARY KEY (id);
ALTER TABLE sole."football" ADD CONSTRAINT "football_brand_check" CHECK ((btrim(brand) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_closure_type_check" CHECK ((closure_type = ANY (ARRAY['Lace-up'::text, 'Laceless'::text, 'Slip-on'::text, 'Hook-and-loop'::text, 'Not documented'::text])));
ALTER TABLE sole."football" ADD CONSTRAINT "football_colorway_check" CHECK ((btrim(colorway) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_country_of_origin_check" CHECK ((btrim(country_of_origin) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_cushioning_check" CHECK ((btrim(cushioning) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_cut_check" CHECK ((cut = ANY (ARRAY['Low'::text, 'Mid'::text, 'High'::text, 'Not documented'::text])));
ALTER TABLE sole."football" ADD CONSTRAINT "football_description_check" CHECK ((btrim(description) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_descriptive_overview_check" CHECK ((btrim(descriptive_overview) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_details_specifications_check" CHECK ((btrim(details_specifications) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_gender_target_check" CHECK ((gender_target = ANY (ARRAY['Men'::text, 'Women'::text, 'Both'::text])));
ALTER TABLE sole."football" ADD CONSTRAINT "football_image_url_check" CHECK ((btrim(image_url) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_materials_check" CHECK ((btrim(materials) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_name_check" CHECK ((btrim(name) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_release_month_check" CHECK (((release_month >= 1) AND (release_month <= 12)));
ALTER TABLE sole."football" ADD CONSTRAINT "football_retail_price_check" CHECK ((btrim(retail_price) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_review_stars_check" CHECK (((review_stars >= (0)::double precision) AND (review_stars <= (5)::double precision)));
ALTER TABLE sole."football" ADD CONSTRAINT "football_sole_material_check" CHECK ((btrim(sole_material) <> ''::text));
ALTER TABLE sole."football" ADD CONSTRAINT "football_weight_g_check" CHECK (((weight_g > (0)::double precision) AND (weight_g < 'Infinity'::double precision)));
ALTER TABLE sole."football" ADD CONSTRAINT "football_year_check" CHECK (((year >= 1800) AND (year <= 2200)));
ALTER TABLE sole."football" ADD CONSTRAINT "Football_id_fkey" FOREIGN KEY (id) REFERENCES sole.sneakers(id);
INSERT INTO sole."football" SELECT * FROM sole_recovery_20261122.football_before;
ALTER TABLE sole."football" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_api_access" ON sole."football" AS PERMISSIVE FOR ALL TO sole_catalog_api USING (true) WITH CHECK (true);
CREATE POLICY "signed_in_catalog_admin" ON sole."football" AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM sole_admins
  WHERE (sole_admins.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM sole_admins
  WHERE (sole_admins.user_id = ( SELECT auth.uid() AS uid)))));
GRANT INSERT ON sole."football" TO "postgres";
GRANT SELECT ON sole."football" TO "postgres";
GRANT UPDATE ON sole."football" TO "postgres";
GRANT DELETE ON sole."football" TO "postgres";
GRANT TRUNCATE ON sole."football" TO "postgres";
GRANT REFERENCES ON sole."football" TO "postgres";
GRANT TRIGGER ON sole."football" TO "postgres";
GRANT INSERT ON sole."football" TO "sole_catalog_api";
GRANT SELECT ON sole."football" TO "sole_catalog_api";
GRANT UPDATE ON sole."football" TO "sole_catalog_api";
GRANT DELETE ON sole."football" TO "sole_catalog_api";
GRANT INSERT ON sole."football" TO "authenticated";
GRANT SELECT ON sole."football" TO "authenticated";
GRANT UPDATE ON sole."football" TO "authenticated";
GRANT DELETE ON sole."football" TO "authenticated";
CREATE OR REPLACE FUNCTION sole.check_sneaker_category_record()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 affected integer[];
 sneaker_id integer;
 expected_category text;
 actual_category text;
 detail_count integer;
begin
 if TG_OP='INSERT' then affected:=array[NEW.id];
 elsif TG_OP='DELETE' then affected:=array[OLD.id];
 else affected:=array[OLD.id,NEW.id]; end if;
 foreach sneaker_id in array affected loop
  select category into expected_category from sole.sneakers where id=sneaker_id for update;
  if not found then continue; end if;
  select count(*),min(kind) into detail_count,actual_category from (
   select 'Lifestyle'::text as kind from sole.lifestyle where id=sneaker_id
   union all select 'Basketball' from sole.basketball where id=sneaker_id
   union all select 'Football' from sole.football where id=sneaker_id
   union all select 'Running' from sole.running where id=sneaker_id
  ) details;
  if detail_count<>1 or actual_category is distinct from expected_category then
   raise exception 'Sneaker % must have exactly one % detail record',sneaker_id,expected_category using errcode='23514';
  end if;
 end loop;
 return null;
end $function$
;
CREATE OR REPLACE FUNCTION public.sole_admin_catalog()
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT to_jsonb(s) || to_jsonb(d) FROM sole.sneakers s JOIN (
    SELECT * FROM sole.lifestyle UNION ALL SELECT * FROM sole.basketball
    UNION ALL SELECT * FROM sole.running UNION ALL SELECT * FROM sole.football
  ) d USING(id) ORDER BY s.id;
$function$
;
CREATE OR REPLACE FUNCTION public.sole_admin_delete_sneaker(p_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE OR REPLACE FUNCTION public.sole_admin_update_sneaker(p_id integer, p_name text, p_retail_price text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
END $function$
;
CREATE CONSTRAINT TRIGGER sneaker_category_record_check AFTER INSERT OR DELETE OR UPDATE ON sole.sneakers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sole.check_sneaker_category_record();
CREATE CONSTRAINT TRIGGER sneaker_category_record_check AFTER INSERT OR DELETE OR UPDATE ON sole.lifestyle DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sole.check_sneaker_category_record();
CREATE CONSTRAINT TRIGGER sneaker_category_record_check AFTER INSERT OR DELETE OR UPDATE ON sole.basketball DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sole.check_sneaker_category_record();
CREATE CONSTRAINT TRIGGER sneaker_category_record_check AFTER INSERT OR DELETE OR UPDATE ON sole.football DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sole.check_sneaker_category_record();
CREATE CONSTRAINT TRIGGER sneaker_category_record_check AFTER INSERT OR DELETE OR UPDATE ON sole.running DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sole.check_sneaker_category_record();
REVOKE ALL ON FUNCTION sole.check_sneaker_category_record() FROM PUBLIC; GRANT EXECUTE ON FUNCTION sole.check_sneaker_category_record() TO sole_catalog_api;
NOTIFY pgrst,'reload schema'; COMMIT;