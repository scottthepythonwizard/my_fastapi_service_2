set local lock_timeout = '10s';
lock table sole.sneakers, sole."LIfestyle", sole."Basketball", sole."Football", sole."Running" in access exclusive mode;
create temporary table sneakers_before_restructure on commit drop as select * from sole.sneakers;
do $guard$
begin
 if exists(select 1 from sole."LIfestyle" union all select 1 from sole."Basketball" union all select 1 from sole."Football" union all select 1 from sole."Running") then
 raise exception 'Category tables are no longer empty; aborting to protect existing records';
 end if;
end $guard$;
alter table sole."LIfestyle" rename to lifestyle;
alter table sole."Basketball" rename to basketball;
alter table sole."Football" rename to football;
alter table sole."Running" rename to running;
alter table sole.sneakers add column created_at timestamptz not null default now();
do $move$
declare
 target text;
 cat text;
 col record;
 chk record;
 moved text;
 kept text[] := array['id','category','shoe_reference_number','created_at','image_note','provenance'];
begin
 select string_agg(format('%I',attname), ', ' order by attnum) into moved
 from pg_attribute where attrelid='sole.sneakers'::regclass and attnum>0 and not attisdropped and not(attname=any(kept));
 foreach target in array array['lifestyle','basketball','football','running'] loop
  cat := initcap(target);
  execute format('alter table sole.%I alter column id drop identity',target);
  execute format('alter table sole.%I drop column created_at',target);
  for col in
   select attname,format_type(atttypid,atttypmod) as typ, attnotnull
   from pg_attribute where attrelid='sole.sneakers'::regclass and attnum>0 and not attisdropped and not(attname=any(kept)) order by attnum
  loop
   execute format('alter table sole.%I add column %I %s %s',target,col.attname,col.typ,case when col.attnotnull then 'not null' else '' end);
  end loop;
  for chk in
   select c.conname, pg_get_constraintdef(c.oid) as def
   from pg_constraint c
   where c.conrelid='sole.sneakers'::regclass and c.contype='c'
   and exists(select 1 from pg_attribute a where a.attrelid=c.conrelid and a.attnum=any(c.conkey) and not(a.attname=any(kept)))
  loop
   execute format('alter table sole.%I add constraint %I %s',target,replace(chk.conname,'sneakers_',target||'_'),chk.def);
  end loop;
  execute format('insert into sole.%I (id, %s) select id, %s from sole.sneakers where category=%L',target,moved,moved,cat);
  execute format('grant select, insert, update, delete on sole.%I to sole_catalog_api',target);
  execute format('create policy catalog_api_access on sole.%I for all to sole_catalog_api using (true) with check (true)',target);
  execute format('comment on table sole.%I is %L',target,cat||' product details. id is both the primary key and the foreign key to sneakers.id; reuse the parent ID.');
 end loop;
 -- Compare every moved value before removing the original columns.
 if exists(
  select 1 from sneakers_before_restructure s
  left join (
   select to_jsonb(l) as doc from sole.lifestyle l
   union all select to_jsonb(b) from sole.basketball b
   union all select to_jsonb(f) from sole.football f
   union all select to_jsonb(r) from sole.running r
  ) d on (d.doc->>'id')::integer=s.id
  where d.doc is null or (to_jsonb(s)-kept) is distinct from (d.doc-'id')
 ) then raise exception 'Product detail verification failed'; end if;
 for col in select attname from pg_attribute where attrelid='sole.sneakers'::regclass and attnum>0 and not attisdropped and not(attname=any(kept))
 loop execute format('alter table sole.sneakers drop column %I',col.attname); end loop;
end $move$;
comment on table sole.sneakers is 'Shared sneaker identity, category, timestamps and source metadata. Product details are stored once in the matching category table.';
comment on column sole.sneakers.created_at is 'Record creation timestamp. For records that predate the restructure, this is the migration timestamp.';

create function sole.check_sneaker_category_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
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
end $fn$;
revoke all on function sole.check_sneaker_category_record() from public;
grant execute on function sole.check_sneaker_category_record() to sole_catalog_api;
do $triggers$
declare target text;
begin
 foreach target in array array['sneakers','lifestyle','basketball','football','running'] loop
  execute format('create constraint trigger sneaker_category_record_check after insert or update or delete on sole.%I deferrable initially deferred for each row execute function sole.check_sneaker_category_record()',target);
 end loop;
end $triggers$;
do $verify$
begin
 if exists(
  select 1 from sneakers_before_restructure old_row
  full join (
   select (to_jsonb(s)-'created_at')||to_jsonb(d) as doc from sole.sneakers s join sole.lifestyle d using(id)
   union all select (to_jsonb(s)-'created_at')||to_jsonb(d) from sole.sneakers s join sole.basketball d using(id)
   union all select (to_jsonb(s)-'created_at')||to_jsonb(d) from sole.sneakers s join sole.football d using(id)
   union all select (to_jsonb(s)-'created_at')||to_jsonb(d) from sole.sneakers s join sole.running d using(id)
  ) reconstructed on (reconstructed.doc->>'id')::integer=old_row.id
  where to_jsonb(old_row) is distinct from reconstructed.doc
 ) then raise exception 'Full record verification failed; rolling back'; end if;
end $verify$;
notify pgrst, 'reload schema';
