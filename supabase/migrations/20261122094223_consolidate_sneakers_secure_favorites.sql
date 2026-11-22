-- Tested against a private snapshot before production. Apply atomically.
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SET LOCAL timezone='UTC';

LOCK TABLE sole.sneakers,sole.basketball,sole.running,sole.lifestyle,sole.football,public.favorites,public.sole_admins IN EXCLUSIVE MODE;

DO $$ DECLARE bad integer[]; BEGIN
 IF to_regnamespace('sole_recovery_20261122') IS NOT NULL THEN RAISE EXCEPTION 'Recovery archive already exists'; END IF;
 WITH d AS (SELECT 'Basketball' AS source_category,to_jsonb(d) AS detail,d.id FROM sole.basketball d UNION ALL SELECT 'Running' AS source_category,to_jsonb(d) AS detail,d.id FROM sole.running d UNION ALL SELECT 'Lifestyle' AS source_category,to_jsonb(d) AS detail,d.id FROM sole.lifestyle d UNION ALL SELECT 'Football' AS source_category,to_jsonb(d) AS detail,d.id FROM sole.football d) SELECT array_agg(id) INTO bad FROM (
 SELECT s.id FROM sole.sneakers s LEFT JOIN d USING(id) GROUP BY s.id,s.category HAVING count(d.id)<>1 OR min(d.source_category)<>s.category
 UNION SELECT d.id FROM d LEFT JOIN sole.sneakers s USING(id) WHERE s.id IS NULL) q;
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Ambiguous or missing sneaker detail IDs: %',bad; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sole' AND NOT t.tgisinternal AND t.tgname<>'sneaker_category_record_check') THEN RAISE EXCEPTION 'Unexpected trigger; review dependencies'; END IF;
END $$;

CREATE SCHEMA sole_recovery_20261122; REVOKE ALL ON SCHEMA sole_recovery_20261122 FROM PUBLIC,anon,authenticated,sole_catalog_api;

CREATE TABLE sole_recovery_20261122."sneakers_before" AS TABLE sole."sneakers";

CREATE TABLE sole_recovery_20261122."basketball_before" AS TABLE sole."basketball";

CREATE TABLE sole_recovery_20261122."running_before" AS TABLE sole."running";

CREATE TABLE sole_recovery_20261122."lifestyle_before" AS TABLE sole."lifestyle";

CREATE TABLE sole_recovery_20261122."football_before" AS TABLE sole."football";

CREATE TABLE sole_recovery_20261122."favorites_before" AS TABLE public."favorites";

CREATE TABLE sole_recovery_20261122."sole_admins_before" AS TABLE public."sole_admins";

CREATE TABLE sole_recovery_20261122.merged_before AS SELECT s.id,to_jsonb(s)||d.detail AS record FROM sole.sneakers s JOIN (SELECT 'Basketball' AS source_category,to_jsonb(d) AS detail,d.id FROM sole.basketball d UNION ALL SELECT 'Running' AS source_category,to_jsonb(d) AS detail,d.id FROM sole.running d UNION ALL SELECT 'Lifestyle' AS source_category,to_jsonb(d) AS detail,d.id FROM sole.lifestyle d UNION ALL SELECT 'Football' AS source_category,to_jsonb(d) AS detail,d.id FROM sole.football d) d USING(id);

DROP TRIGGER "sneaker_category_record_check" ON sole."sneakers";

DROP TRIGGER "sneaker_category_record_check" ON sole."lifestyle";

DROP TRIGGER "sneaker_category_record_check" ON sole."basketball";

DROP TRIGGER "sneaker_category_record_check" ON sole."football";

DROP TRIGGER "sneaker_category_record_check" ON sole."running";

DROP FUNCTION sole.check_sneaker_category_record() RESTRICT;

ALTER TABLE sole.sneakers ADD COLUMN "brand" text;

ALTER TABLE sole.sneakers ADD COLUMN "name" text;

ALTER TABLE sole.sneakers ADD COLUMN "year" integer;

ALTER TABLE sole.sneakers ADD COLUMN "descriptive_overview" text;

ALTER TABLE sole.sneakers ADD COLUMN "gender_target" text;

ALTER TABLE sole.sneakers ADD COLUMN "retail_price" text;

ALTER TABLE sole.sneakers ADD COLUMN "colorway" text;

ALTER TABLE sole.sneakers ADD COLUMN "description" text;

ALTER TABLE sole.sneakers ADD COLUMN "details_specifications" text;

ALTER TABLE sole.sneakers ADD COLUMN "review_stars" double precision;

ALTER TABLE sole.sneakers ADD COLUMN "materials" text;

ALTER TABLE sole.sneakers ADD COLUMN "country_of_origin" text;

ALTER TABLE sole.sneakers ADD COLUMN "closure_type" text;

ALTER TABLE sole.sneakers ADD COLUMN "cut" text;

ALTER TABLE sole.sneakers ADD COLUMN "sole_material" text;

ALTER TABLE sole.sneakers ADD COLUMN "cushioning" text;

ALTER TABLE sole.sneakers ADD COLUMN "weight_g" double precision;

ALTER TABLE sole.sneakers ADD COLUMN "release_month" integer;

ALTER TABLE sole.sneakers ADD COLUMN "image_url" text;

UPDATE sole.sneakers s SET "brand"=d."brand","name"=d."name","year"=d."year","descriptive_overview"=d."descriptive_overview","gender_target"=d."gender_target","retail_price"=d."retail_price","colorway"=d."colorway","description"=d."description","details_specifications"=d."details_specifications","review_stars"=d."review_stars","materials"=d."materials","country_of_origin"=d."country_of_origin","closure_type"=d."closure_type","cut"=d."cut","sole_material"=d."sole_material","cushioning"=d."cushioning","weight_g"=d."weight_g","release_month"=d."release_month","image_url"=d."image_url" FROM jsonb_populate_recordset(NULL::sole.sneakers,(SELECT jsonb_agg(record) FROM sole_recovery_20261122.merged_before)) d WHERE s.id=d.id;

ALTER TABLE sole.sneakers ALTER COLUMN "brand" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "descriptive_overview" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "gender_target" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "retail_price" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "colorway" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "description" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "details_specifications" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "review_stars" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "materials" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "country_of_origin" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "closure_type" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "cut" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "sole_material" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "cushioning" SET NOT NULL;

ALTER TABLE sole.sneakers ALTER COLUMN "image_url" SET NOT NULL;

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_23" CHECK ((btrim(brand) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_24" CHECK ((closure_type = ANY (ARRAY['Lace-up'::text, 'Laceless'::text, 'Slip-on'::text, 'Hook-and-loop'::text, 'Not documented'::text])));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_25" CHECK ((btrim(colorway) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_26" CHECK ((btrim(country_of_origin) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_27" CHECK ((btrim(cushioning) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_28" CHECK ((cut = ANY (ARRAY['Low'::text, 'Mid'::text, 'High'::text, 'Not documented'::text])));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_29" CHECK ((btrim(description) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_30" CHECK ((btrim(descriptive_overview) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_31" CHECK ((btrim(details_specifications) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_32" CHECK ((gender_target = ANY (ARRAY['Men'::text, 'Women'::text, 'Both'::text])));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_33" CHECK ((btrim(image_url) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_34" CHECK ((btrim(materials) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_35" CHECK ((btrim(name) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_36" CHECK (((release_month >= 1) AND (release_month <= 12)));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_37" CHECK ((btrim(retail_price) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_38" CHECK (((review_stars >= (0)::double precision) AND (review_stars <= (5)::double precision)));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_39" CHECK ((btrim(sole_material) <> ''::text));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_40" CHECK (((weight_g > (0)::double precision) AND (weight_g < 'Infinity'::double precision)));

ALTER TABLE sole.sneakers ADD CONSTRAINT "sneakers_detail_41" CHECK (((year >= 1800) AND (year <= 2200)));

DO $$ BEGIN
 IF EXISTS((SELECT to_jsonb(s) FROM sole.sneakers s EXCEPT SELECT record FROM sole_recovery_20261122.merged_before) UNION ALL (SELECT record FROM sole_recovery_20261122.merged_before EXCEPT SELECT to_jsonb(s) FROM sole.sneakers s)) THEN RAISE EXCEPTION 'Field preservation verification failed'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sole_admin_catalog() RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT to_jsonb(s) FROM sole.sneakers s WHERE EXISTS(SELECT 1 FROM public.sole_admins WHERE user_id=(SELECT auth.uid())) ORDER BY s.id $$;
CREATE OR REPLACE FUNCTION public.sole_admin_update_sneaker(p_id integer,p_name text,p_retail_price text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.sole_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR btrim(p_name)='' OR p_retail_price IS NULL OR btrim(p_retail_price)='' THEN RAISE EXCEPTION 'Name and retail price are required' USING ERRCODE='22023'; END IF;
 UPDATE sole.sneakers SET name=btrim(p_name),retail_price=btrim(p_retail_price) WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sneaker not found' USING ERRCODE='P0002'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.sole_admin_delete_sneaker(p_id integer) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.sole_admins WHERE user_id=(SELECT auth.uid())) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 DELETE FROM sole.sneakers WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sneaker not found' USING ERRCODE='P0002'; END IF;
END $$;

DROP TABLE sole.basketball RESTRICT;

DROP TABLE sole.running RESTRICT;

DROP TABLE sole.lifestyle RESTRICT;

DROP TABLE sole.football RESTRICT;

ALTER TABLE sole.sneakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_read_signed_in ON sole.sneakers FOR SELECT TO authenticated USING (true);
GRANT USAGE ON SCHEMA sole TO authenticated,sole_catalog_api;
REVOKE ALL ON sole.sneakers FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON sole.sneakers TO authenticated,sole_catalog_api;
GRANT USAGE ON SEQUENCE sole.sneakers_id_seq TO authenticated,sole_catalog_api;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sole_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.favorites,public.sole_admins FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.favorites TO authenticated;
GRANT SELECT ON public.sole_admins TO authenticated;
CREATE INDEX IF NOT EXISTS favorites_sneaker_id_idx ON public.favorites(sneaker_id);
CREATE FUNCTION public.sole_favorites() RETURNS TABLE(sneaker_id integer,created_at timestamptz,sneaker jsonb) LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT f.sneaker_id,f.created_at,to_jsonb(s) FROM public.favorites f JOIN sole.sneakers s ON s.id=f.sneaker_id WHERE f.user_id=(SELECT auth.uid()) ORDER BY f.created_at DESC,f.sneaker_id $$;
REVOKE ALL ON FUNCTION public.sole_favorites() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sole_favorites() TO authenticated;
NOTIFY pgrst,'reload schema';
