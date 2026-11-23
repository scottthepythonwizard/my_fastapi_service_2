import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export const userA = "11111111-1111-4111-8111-111111111111";
export const userB = "22222222-2222-4222-8222-222222222222";

export async function fixtureDatabase() {
  const migrations = new URL("../migrations/", import.meta.url);
  const names = await readdir(migrations);
  const migration = (suffix) => readFile(new URL(names.find((name) => name.endsWith(suffix)), migrations), "utf8");
  const db = new PGlite();
  const fixture = (name) => readFile(new URL(name, import.meta.url), "utf8");
  await db.exec(await fixture("favorite_sizes_fixture.sql"));
  await db.exec(await migration("_sole_catalog.sql"));
  await db.exec(await fixture("favorite_sizes_policies.sql"));
  const admin = (await db.query("SELECT user_id FROM public.sole_admins LIMIT 1")).rows[0].user_id;
  await db.query("INSERT INTO public.favorites(user_id,sneaker_id) VALUES($1,3)", [userA]);
  const before = (await db.query("SELECT * FROM public.favorites")).rows[0];
  await db.exec("BEGIN;" + await migration("_favorite_sizes.sql") + "COMMIT;");
  const after = (await db.query("SELECT * FROM public.favorites")).rows[0];
  assert.deepEqual(after, { ...before, size: null, size_system: null });
  await db.query("DELETE FROM public.favorites WHERE user_id=$1", [userA]);
  return { db, admin };
}

export async function asUser(db, user, action) {
  return db.transaction(async (tx) => {
    await tx.exec(user ? "SET LOCAL ROLE authenticated" : "SET LOCAL ROLE anon");
    await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user || ""]);
    return action(tx);
  });
}

async function test() {
  const { db } = await fixtureDatabase();
  const save = (user, id, size, system) => asUser(db, user, (tx) =>
    tx.query("SELECT public.sole_save_favorite($1,$2,$3)", [id, size, system]));
  const rows = (user) => asUser(db, user, async (tx) =>
    (await tx.query("SELECT sneaker_id,size::text,size_system,created_at FROM public.favorites ORDER BY sneaker_id")).rows);
  try {
    await save(userA, 1, 42.5, "eu");
    const original = (await rows(userA))[0];
    assert.equal(original.size, "42.5");
    await save(userA, 1, null, null);
    assert.deepEqual(await rows(userA), [original]);
    await save(userA, 1, 9.5, "us_men");
    assert.deepEqual(await rows(userA), [{ ...original, size: "9.5", size_system: "us_men" }]);
    await save(userB, 1, null, null);
    assert.equal((await rows(userB))[0].size, null);
    await assert.rejects(save(null, 1, 9, "us_men"), { code: "42501" });
    await assert.rejects(save(userA, 1, 0, "us_men"), { code: "23514" });
    await assert.rejects(save(userA, 1, null, "eu"), { code: "23514" });
    await assert.rejects(save(userA, 1, 42, "invalid"), { code: "23514" });
    await assert.rejects(asUser(db, userA, (tx) =>
      tx.query("UPDATE public.favorites SET user_id=$1 WHERE sneaker_id=1", [userB])), { code: "42501" });
    const crossUpdate = await asUser(db, userB, (tx) =>
      tx.query("UPDATE public.favorites SET size=4 WHERE user_id=$1 RETURNING sneaker_id", [userA]));
    assert.equal(crossUpdate.rows.length, 0);
    await db.query("DELETE FROM sole.sneakers WHERE id=1");
    assert.equal((await rows(userA)).length + (await rows(userB)).length, 0);
    console.log("PASS: Existing rows, size/system, update, no-size preservation, validation, two-user RLS, anonymous denial and cascade.");
  } finally {
    await db.close();
  }
}

if (process.argv.includes("--run")) await test();
