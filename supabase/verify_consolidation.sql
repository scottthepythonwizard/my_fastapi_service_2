-- Read-only owner verification. No private identifiers are returned.
SELECT tablename FROM pg_tables WHERE schemaname='sole';
SELECT category,count(*) FROM sole.sneakers GROUP BY category ORDER BY category;
SELECT count(*) AS complete_records FROM sole.sneakers WHERE brand IS NOT NULL AND name IS NOT NULL AND image_url IS NOT NULL;
SELECT NOT EXISTS(
 (SELECT to_jsonb(s) FROM sole.sneakers s EXCEPT SELECT record FROM sole_recovery_20261122.merged_before)
 UNION ALL
 (SELECT record FROM sole_recovery_20261122.merged_before EXCEPT SELECT to_jsonb(s) FROM sole.sneakers s)
) AS all_original_values_preserved;
-- After intentional edits/new records, compare original IDs selectively instead.
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN('sole.sneakers'::regclass,'public.favorites'::regclass,'public.sole_admins'::regclass);
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE (schemaname,tablename) IN(('sole','sneakers'),('public','favorites'),('public','sole_admins'));
SELECT rolconfig FROM pg_roles WHERE rolname='authenticator';
SELECT count(*) AS dangling_favorites FROM public.favorites f LEFT JOIN sole.sneakers s ON s.id=f.sneaker_id LEFT JOIN auth.users u ON u.id=f.user_id WHERE s.id IS NULL OR u.id IS NULL;
