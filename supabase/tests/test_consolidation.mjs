import {PGlite} from '../../.local/sole-migration-test/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const fixture=fs.readFileSync('.local/consolidation-backup/fixture.sql','utf8');
const migrationPath=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('consolidate_sneakers_secure_favorites.sql'));
const migration=fs.readFileSync('supabase/migrations/'+migrationPath,'utf8');
const recovery=fs.readFileSync('supabase/recovery/restore_category_tables.sql','utf8');
const snapshot=JSON.parse(fs.readFileSync('.local/consolidation-backup/snapshot.json','utf8'));
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const admin=snapshot.data.sole_admins[0].user_id;
const results=[];
const db=new PGlite();
async function test(name,action){await action();results.push({name,status:'PASS'});console.log('PASS',name);}
async function query(sql,params=[]){return (await db.query(sql,params)).rows;}
async function as(user,fn,role='authenticated'){return db.transaction(async tx=>{await tx.exec('SET LOCAL ROLE '+role);await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user||'']);return fn(tx);});}
async function denied(action,code='42501'){try{await action();assert.fail('Request unexpectedly succeeded');}catch(e){assert.equal(e.code,code,e.message);}}
const expected=snapshot.data.sneakers.map(p=>({...p,...['basketball','running','lifestyle','football'].flatMap(k=>snapshot.data[k]).find(d=>d.id===p.id)})).sort((a,b)=>a.id-b.id);
await db.exec('BEGIN; SET LOCAL timezone=\'UTC\';'+fixture+'COMMIT;');
await test('RED: original split schema cannot satisfy flat catalog query',()=>denied(()=>query('SELECT brand FROM sole.sneakers'),'42703'));
await db.query('INSERT INTO public.favorites(user_id,sneaker_id) VALUES($1,1)',[A]);
await db.exec('BEGIN;'+migration+'COMMIT;');
await test('All 20 complete rows exactly preserved, including timestamps and provenance',async()=>assert.deepEqual((await query('SELECT to_jsonb(s) record FROM sole.sneakers s ORDER BY id')).map(x=>x.record),expected));
await test('Category tables removed from sole',async()=>assert.equal((await query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='sole' AND tablename<>'sneakers'"))[0].n,0));
await test('Categories preserved and filterable',async()=>assert.deepEqual(await query('SELECT category,count(*)::int n FROM sole.sneakers GROUP BY category ORDER BY category'),[{category:'Basketball',n:4},{category:'Football',n:3},{category:'Lifestyle',n:10},{category:'Running',n:3}]));
await test('Existing favorite and administrator preserved',async()=>{assert.equal((await query('SELECT count(*)::int n FROM public.favorites'))[0].n,1);assert.equal((await query('SELECT count(*)::int n FROM public.sole_admins'))[0].n,1);});
await test('Ordinary signed-in user reads complete catalog',async()=>assert.equal((await as(A,t=>t.query('SELECT brand FROM sole.sneakers'))).rows.length,20));
await test('Unauthenticated catalog and favorites denied',async()=>{for(const t of ['sole.sneakers','public.favorites']) await denied(()=>as(null,q=>q.query('SELECT * FROM '+t),'anon'));});
let id;
const draft={...expected[0],name:'Isolated migration test',shoe_reference_number:'SOLE-MIGRATION-TEST'};delete draft.id;delete draft.created_at;
const insert="INSERT INTO sole.sneakers("+Object.keys(draft).join(',')+") SELECT "+Object.keys(draft).join(',')+" FROM jsonb_populate_record(NULL::sole.sneakers,$1::jsonb) RETURNING id";
await test('Administrator creates new sneaker; identity exceeds previous IDs',async()=>{id=(await as(admin,t=>t.query(insert,[JSON.stringify(draft)]))).rows[0].id;assert.ok(id>Math.max(20,snapshot.sequence.last_value));});
await test('Ordinary insert and administrator self-assignment denied',async()=>{await denied(()=>as(A,t=>t.query(insert,[JSON.stringify({...draft,shoe_reference_number:'DENIED'})])));await denied(()=>as(A,t=>t.query('INSERT INTO public.sole_admins(user_id) VALUES($1)',[A])));});
await test('Ordinary update and delete affect zero records',async()=>{assert.equal((await as(A,t=>t.query('UPDATE sole.sneakers SET name=\'Denied\' WHERE id=$1 RETURNING id',[id]))).rows.length,0);assert.equal((await as(A,t=>t.query('DELETE FROM sole.sneakers WHERE id=$1 RETURNING id',[id]))).rows.length,0);});
await test('Admin catalog RPC retains administrator restriction',async()=>{assert.equal((await as(A,t=>t.query('SELECT * FROM public.sole_admin_catalog()'))).rows.length,0);assert.equal((await as(admin,t=>t.query('SELECT * FROM public.sole_admin_catalog()'))).rows.length,21);});
await test('Ordinary admin RPC calls denied',async()=>{await denied(()=>as(A,t=>t.query('SELECT public.sole_admin_update_sneaker($1,\'Denied\',\'123\')',[id])));await denied(()=>as(A,t=>t.query('SELECT public.sole_admin_delete_sneaker($1)',[id])));});
await test('Favorite uses signed-in ownership default',async()=>{const r=(await as(A,t=>t.query('INSERT INTO public.favorites(sneaker_id) VALUES($1) RETURNING user_id',[id]))).rows;assert.equal(r[0].user_id,A);});
await test('Repeated favorite add is idempotent, plain duplicate prevented',async()=>{assert.equal((await as(A,t=>t.query('INSERT INTO public.favorites(sneaker_id) VALUES($1) ON CONFLICT DO NOTHING RETURNING sneaker_id',[id]))).rows.length,0);await denied(()=>as(A,t=>t.query('INSERT INTO public.favorites(sneaker_id) VALUES($1)',[id])),'23505');});
await test('Favorite listing returns complete matching sneaker details',async()=>{const r=(await as(A,t=>t.query('SELECT * FROM public.sole_favorites() WHERE sneaker_id=$1',[id]))).rows[0];assert.equal(r.sneaker.name,draft.name);assert.equal(r.sneaker.shoe_reference_number,draft.shoe_reference_number);});
await test('Second user can independently favorite same sneaker',async()=>{await as(B,t=>t.query('INSERT INTO public.favorites(sneaker_id) VALUES($1)',[id]));assert.equal((await query('SELECT count(*)::int n FROM public.favorites WHERE sneaker_id=$1',[id]))[0].n,2);});
await test('Cross-user read and delete return no records',async()=>{for(const statement of ['SELECT * FROM public.favorites WHERE user_id=$1','DELETE FROM public.favorites WHERE user_id=$1 RETURNING *']) assert.equal((await as(A,t=>t.query(statement,[B]))).rows.length,0);});
await test('Forged user ID rejected',()=>denied(()=>as(A,t=>t.query('INSERT INTO public.favorites(user_id,sneaker_id) VALUES($1,2)',[B]))));
await test('Administrator does not read other users favorites',async()=>assert.equal((await as(admin,t=>t.query('SELECT * FROM public.favorites'))).rows.length,0));
await test('Favorite to missing sneaker rejected',()=>denied(()=>as(A,t=>t.query('INSERT INTO public.favorites(sneaker_id) VALUES(2147483647)')),'23503'));
await test('Favorite remove repeated safely',async()=>{for(const n of [1,0])assert.equal((await as(A,t=>t.query('DELETE FROM public.favorites WHERE sneaker_id=$1 RETURNING *',[id]))).rows.length,n);});
await test('Administrator update RPC changes consolidated row',async()=>{await as(admin,t=>t.query("SELECT public.sole_admin_update_sneaker($1,'Updated test','456')",[id]));assert.equal((await query('SELECT name FROM sole.sneakers WHERE id=$1',[id]))[0].name,'Updated test');});
await test('Database validation and uniqueness retained',async()=>{await denied(()=>as(admin,t=>t.query('UPDATE sole.sneakers SET review_stars=6 WHERE id=$1',[id])),'23514');await denied(()=>as(admin,t=>t.query(insert,[JSON.stringify(draft)])),'23505');});
await test('Sneaker deletion cascades only its favorites',async()=>{await as(admin,t=>t.query('SELECT public.sole_admin_delete_sneaker($1)',[id]));assert.equal((await query('SELECT count(*)::int n FROM public.favorites WHERE sneaker_id=$1',[id]))[0].n,0);assert.equal((await query('SELECT count(*)::int n FROM public.favorites WHERE sneaker_id=1'))[0].n,1);});
await test('User deletion cascades that users favorites',async()=>{await as(B,t=>t.query('INSERT INTO public.favorites(sneaker_id) VALUES(2)'));await query('DELETE FROM auth.users WHERE id=$1',[B]);assert.equal((await query('SELECT count(*)::int n FROM public.favorites WHERE user_id=$1',[B]))[0].n,0);});
await test('All original rows unchanged after CRUD',async()=>assert.deepEqual((await query('SELECT to_jsonb(s) record FROM sole.sneakers s ORDER BY id')).map(x=>x.record),expected));
await test('Recovery refuses to discard edits',async()=>{await query("UPDATE sole.sneakers SET name='Later edit' WHERE id=1");await denied(()=>db.exec(recovery),'P0001');await db.exec('ROLLBACK');await query('UPDATE sole.sneakers SET name=$1 WHERE id=1',[expected[0].name]);});
await test('Recovery restores original category rows and enforcement',async()=>{await db.exec(recovery);for(const c of ['basketball','running','lifestyle','football'])assert.deepEqual((await query('SELECT to_jsonb(t) record FROM sole.'+c+' t ORDER BY id')).map(x=>x.record),snapshot.data[c].sort((a,b)=>a.id-b.id));});
await db.close();
for(const [label,mutation] of [['missing detail','DELETE FROM sole.basketball WHERE id=7'],['multiple details','INSERT INTO sole.lifestyle SELECT * FROM sole.basketball WHERE id=7'],['category mismatch',"UPDATE sole.sneakers SET category='Running' WHERE id=7"]]){
 const d=new PGlite(); await d.exec('BEGIN;'+fixture+'COMMIT;');for(const t of snapshot.triggers)await d.exec('DROP TRIGGER '+t.name+' ON sole.'+t.table);await d.exec(mutation);
 await test('Preflight rejects '+label+' atomically',async()=>{try{await d.exec('BEGIN;'+migration+'COMMIT;');assert.fail('Expected migration rejection');}catch(e){assert.equal(e.code,'P0001');await d.exec('ROLLBACK');}assert.equal((await d.query("SELECT to_regnamespace('sole_recovery_20261122') IS NULL absent")).rows[0].absent,true);});await d.close();
}
fs.mkdirSync('output/consolidation',{recursive:true});fs.writeFileSync('output/consolidation/isolated-tests.json',JSON.stringify({engine:'PGlite 0.5.17 PostgreSQL; JWT transport not simulated',migration:migrationPath,results},null,2));
console.log(results.length+' checks passed');
