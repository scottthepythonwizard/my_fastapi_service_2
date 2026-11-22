-- Run in the project owner's SQL editor. All fixtures roll back.
BEGIN;
SET LOCAL timezone='UTC';
INSERT INTO auth.users(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
CREATE TEMP TABLE sole_test_results(name text,status text);
GRANT SELECT,INSERT ON sole_test_results TO authenticated,anon;
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.sole_admins LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x integer; BEGIN
 INSERT INTO sole.sneakers(category,shoe_reference_number,image_note,provenance,brand,name,year,descriptive_overview,gender_target,retail_price,colorway,description,details_specifications,review_stars,materials,country_of_origin,closure_type,cut,sole_material,cushioning,weight_g,release_month,image_url)
 SELECT category,'SOLE-LIVE-MIGRATION-TEST','',jsonb_build_object('test_record',true),'SOLE Test','Temporary live policy test',year,descriptive_overview,gender_target,retail_price,colorway,description,details_specifications,review_stars,materials,country_of_origin,closure_type,cut,sole_material,cushioning,weight_g,release_month,image_url FROM sole.sneakers WHERE id=1 RETURNING id INTO x;
 IF x<=20 THEN RAISE EXCEPTION 'Identity not advanced'; END IF;
 PERFORM public.sole_admin_update_sneaker(x,'Updated live policy test','123');
 IF NOT EXISTS(SELECT 1 FROM sole.sneakers WHERE id=x AND name='Updated live policy test') THEN RAISE EXCEPTION 'Update not persisted'; END IF;
 INSERT INTO sole_test_results VALUES('Admin create/read/update; generated ID','PASS');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x integer; n integer; BEGIN
 SELECT id INTO x FROM sole.sneakers WHERE shoe_reference_number='SOLE-LIVE-MIGRATION-TEST';
 IF x IS NULL THEN RAISE EXCEPTION 'Ordinary catalog read failed'; END IF;
 BEGIN INSERT INTO public.sole_admins(user_id) VALUES(auth.uid()); RAISE EXCEPTION 'Self admin succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.sole_admin_update_sneaker(x,'Forbidden','123'); RAISE EXCEPTION 'Unauthorized RPC succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE sole.sneakers SET name='Forbidden' WHERE id=x; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Unauthorized update'; END IF;
 DELETE FROM sole.sneakers WHERE id=x; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Unauthorized delete'; END IF;
 BEGIN INSERT INTO sole.sneakers(category,shoe_reference_number) VALUES('Lifestyle','DENIED'); RAISE EXCEPTION 'Unauthorized insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO public.favorites(sneaker_id) VALUES(x);
 INSERT INTO public.favorites(sneaker_id) VALUES(x) ON CONFLICT DO NOTHING;
 BEGIN INSERT INTO public.favorites(sneaker_id) VALUES(x); RAISE EXCEPTION 'Duplicate allowed'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN INSERT INTO public.favorites(user_id,sneaker_id) VALUES('22222222-2222-4222-8222-222222222222',x); RAISE EXCEPTION 'Forged owner allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF NOT EXISTS(SELECT 1 FROM public.sole_favorites() WHERE sneaker_id=x AND sneaker->>'name'='Updated live policy test') THEN RAISE EXCEPTION 'Favorite details wrong'; END IF;
 INSERT INTO sole_test_results VALUES('User A read; favorite add/status/details/duplicates; forged ownership denied','PASS'),('Ordinary CRUD and self-admin denied','PASS');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x integer; n integer; BEGIN
 SELECT id INTO x FROM sole.sneakers WHERE shoe_reference_number='SOLE-LIVE-MIGRATION-TEST';
 IF EXISTS(SELECT 1 FROM public.favorites) THEN RAISE EXCEPTION 'Cross-user read'; END IF;
 DELETE FROM public.favorites WHERE user_id='11111111-1111-4111-8111-111111111111'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-user delete'; END IF;
 INSERT INTO public.favorites(sneaker_id) VALUES(x);
 DELETE FROM public.favorites WHERE sneaker_id=x; GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Remove failed'; END IF;
 DELETE FROM public.favorites WHERE sneaker_id=x; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Repeated remove failed'; END IF;
 INSERT INTO public.favorites(sneaker_id) VALUES(x);
 INSERT INTO sole_test_results VALUES('User B isolated; own remove and repeated remove','PASS');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.sole_admins LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE x integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.favorites) THEN RAISE EXCEPTION 'Admin sees private favorites'; END IF;
 SELECT id INTO x FROM sole.sneakers WHERE shoe_reference_number='SOLE-LIVE-MIGRATION-TEST';
 PERFORM public.sole_admin_delete_sneaker(x);
 INSERT INTO sole_test_results VALUES('Admin delete; private favorites stay private','PASS');
END $$;
RESET ROLE;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.favorites f JOIN sole.sneakers s ON s.id=f.sneaker_id WHERE s.shoe_reference_number='SOLE-LIVE-MIGRATION-TEST') OR EXISTS(SELECT 1 FROM public.favorites WHERE user_id IN('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')) THEN RAISE EXCEPTION 'Cascade failed'; END IF; INSERT INTO sole_test_results VALUES('Sneaker delete cascades related favorites','PASS'); END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM 1 FROM public.favorites; RAISE EXCEPTION 'Anon favorite read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM 1 FROM sole.sneakers; RAISE EXCEPTION 'Anon direct catalog read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 INSERT INTO sole_test_results VALUES('Unauthenticated direct database access denied','PASS');
END $$;
RESET ROLE;
SELECT jsonb_agg(to_jsonb(r)) AS live_access_results FROM sole_test_results r;
ROLLBACK;
