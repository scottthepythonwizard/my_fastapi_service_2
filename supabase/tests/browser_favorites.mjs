// Browser integration against isolated PostgreSQL. The test gateway implements
// only the Auth/PostgREST requests used here; production never loads this file.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { asUser, fixtureDatabase, userA, userB } from "./test_favorite_sizes.mjs";

const { db, admin } = await fixtureDatabase();
const loginFixtures = new Map([["a@example.test", userA], ["b@example.test", userB], ["admin@example.test", admin]]);
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const select = async (tx, sql, params = []) => (await tx.query(sql, params)).rows;
const testKey = "public-test-key";
const mockURL = "http://127.0.0.1:19630";
const appURL = "http://127.0.0.1:19631";
const pages = ["/archive", "/compare/", "/fit/"];

function apiItem(record) {
  const { id, image_url, image_note, provenance, created_at, ...attributes } = record;
  attributes.year ??= "Not documented";
  return { id, image_url, image_note, provenance, attributes };
}

const gateway = createServer(async (req, res) => {
  try {
    const id = Number(req.url.match(/^\/api\/v1\/catalog\/(\d+)$/)?.[1]);
    const rows = await query(id ? "SELECT * FROM sole.sneakers WHERE id=$1" : "SELECT * FROM sole.sneakers ORDER BY id", id ? [id] : []);
    const items = rows.map(apiItem);
    res.writeHead(id && !items.length ? 404 : 200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(id ? items[0] || {} : { items, count: items.length }));
  } catch { res.writeHead(500).end(); }
});
await new Promise((resolve, reject) => gateway.once("error", reject).listen(19630, "127.0.0.1", resolve));
const env = { ...process.env, SOLE_HOSTED_CATALOG_ORIGIN: mockURL, SOLE_SUPABASE_URL: mockURL, SOLE_SUPABASE_PUBLISHABLE_KEY: testKey };
delete env.SOLE_DATABASE_URL;
delete env.SOLE_ADMIN_TOKEN;
const root = fileURLToPath(new URL("../../", import.meta.url));
const python = process.env.SOLE_TEST_PYTHON || fileURLToPath(new URL("../../my_fastapi_service_sole_list/.venv/Scripts/python.exe", import.meta.url));
const processHandle = spawn(python, ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "19631"],
  { cwd: root, env, windowsHide: true, stdio: "ignore" });
const nativeFields = Object.keys((await query("SELECT * FROM sole.sneakers LIMIT 1"))[0]).filter((name) => !["id", "created_at"].includes(name));
const pageErrors = [];
let failNextSave = false;
let browser;

async function setupContext() {
  const context = await browser.newContext();
  await context.route(mockURL + "/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const args = () => request.postDataJSON();
    const answer = (status, json) => route.fulfill({
      status, ...(json === undefined ? {} : { json }),
      headers: { "access-control-allow-origin": "*" },
    });
    try {
      if (url.pathname === "/auth/v1/token" && method === "POST") {
        const email = args().email;
        const id = loginFixtures.get(email);
        if (!id || args().password !== "local fixture password") return answer(400, { message: "Invalid credentials" });
        const user = { id, email, aud: "authenticated", app_metadata: {}, user_metadata: {} };
        return answer(200, { access_token: "fixture-" + id, refresh_token: "fixture-refresh-" + id,
          token_type: "bearer", expires_in: 3600, user });
      }
      const bearer = request.headers().authorization || "";
      const id = [...loginFixtures.values()].find((uid) => bearer === "Bearer fixture-" + uid);
      if (url.pathname === "/auth/v1/logout") return answer(204);
      if (url.pathname === "/rest/v1/rpc/sole_save_favorite" && failNextSave) {
        failNextSave = false;
        return answer(503, { message: "Fixture temporarily unavailable" });
      }
      if (url.pathname === "/auth/v1/user") {
        const email = [...loginFixtures].find(([, uid]) => uid === id)?.[0];
        return id ? answer(200, { id, email }) : answer(401, { message: "No session" });
      }
      const rows = await asUser(db, id, async (tx) => {
        const eq = (name) => url.searchParams.get(name)?.replace(/^eq\./, "");
        switch (url.pathname) {
          case "/rest/v1/favorites":
            if (method === "DELETE") return select(tx, "DELETE FROM public.favorites WHERE sneaker_id=$1", [eq("sneaker_id")]);
            return select(tx, "SELECT sneaker_id,size::float AS size,size_system FROM public.favorites ORDER BY created_at DESC");
          case "/rest/v1/sole_admins":
            return select(tx, "SELECT user_id FROM public.sole_admins WHERE user_id=$1", [eq("user_id")]);
          case "/rest/v1/rpc/sole_favorites":
            return select(tx, "SELECT * FROM public.sole_favorites()");
          case "/rest/v1/rpc/sole_save_favorite": {
            const { p_sneaker_id, p_size, p_size_system } = args();
            await tx.query("SELECT public.sole_save_favorite($1,$2,$3)", [p_sneaker_id, p_size, p_size_system]);
            return [];
          }
          case "/rest/v1/sneakers": {
            if (method === "GET") return select(tx, "SELECT * FROM sole.sneakers ORDER BY id");
            if (method === "DELETE") return select(tx, "DELETE FROM sole.sneakers WHERE id=$1 RETURNING id", [eq("id")]);
            const data = args();
            const fields = nativeFields.filter((field) => Object.hasOwn(data, field));
            const values = fields.map((field) => data[field]);
            if (method === "POST") {
              const placeholders = fields.map((_, index) => "$" + (index + 1));
              return select(tx, `INSERT INTO sole.sneakers (${fields.join(",")}) VALUES (${placeholders.join(",")}) RETURNING id`, values);
            }
            const assignments = fields.map((field, index) => `${field}=$${index + 1}`);
            return select(tx, `UPDATE sole.sneakers SET ${assignments.join(",")} WHERE id=$${values.length + 1} RETURNING id`, [...values, eq("id")]);
          }
          default: throw new Error("Unexpected test route: " + url.pathname);
        }
      });
      if (request.headers().accept?.includes("vnd.pgrst.object")) {
        if (rows.length !== 1) return answer(406, { code: "PGRST116", message: "Expected one row" });
        return answer(200, rows[0]);
      }
      return answer(200, rows);
    } catch (error) {
      if (!error.code) console.error(error.message);
      return answer(error.code === "42501" ? 403 : 400, { code: error.code || "fixture", message: error.message });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return page;
}

const favorite = (page, id, selector = "main") => page.locator(`${selector} button[data-sole-favorite="${id}"]`).first();
const modal = (page) => page.locator("dialog.sole-account[open]");
const nav = (page) => page.getByRole("navigation", { name: "SOLE account" });
const checkText = async (locator, value) => {
  await locator.filter({ hasText: value }).first().waitFor();
};

async function signIn(page, email) {
  await modal(page).getByLabel("Email").fill(email);
  await modal(page).getByLabel("Password").fill("local fixture password");
  await modal(page).getByRole("button", { name: "Sign in", exact: true }).click();
  await nav(page).getByRole("button", { name: "Account" }).waitFor();
}

async function favoritesList(page) {
  await nav(page).getByRole("link", { name: "Favorites" }).click();
  return modal(page).locator(".sole-favorites-list");
}

async function verifyCatalog(name, present) {
  const page = await setupContext();
  for (const path of pages) {
    await page.goto(appURL + path);
    await favorite(page, 1).waitFor();
    const title = page.locator("main h3").filter({ hasText: name });
    if (present) await title.waitFor();
    else assert.equal(await title.count(), 0, path);
  }
  await page.context().close();
}

try {
  for (let i = 0; ; i++) {
    if (i === 50) throw new Error("FastAPI test server failed to start");
    const ready = await fetch(appURL + "/health").catch(() => null);
    if (ready?.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ executablePath: process.env.SOLE_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true });
  const a = await setupContext();
  await a.goto(appURL + "/fit/?reference=1&target=2");
  await favorite(a, 1).click();
  await checkText(modal(a).getByRole("status"), "Sign in to save");
  await signIn(a, "a@example.test");
  await modal(a).waitFor({ state: "hidden" });
  failNextSave = true;
  await favorite(a, 5).click();
  await a.getByText("Couldn’t change this favorite. Try again.").waitFor();
  await a.locator("#sizeSystem").selectOption("eu");
  await a.locator("#referenceSize").selectOption("42.5");
  await favorite(a, 1, "#referencePreview").click();
  await checkText(a.locator("#referencePreview [role=status]"), "Saved size EU 42.5");
  for (const path of pages) {
    await a.goto(appURL + path);
    await a.reload();
    const list = await favoritesList(a);
    await checkText(list.locator("li"), "EU 42.5");
    await modal(a).getByRole("button", { name: "Close" }).click();
    await a.locator('button[data-sole-favorite="1"][data-saved="true"]').first().waitFor();
  }
  console.log("PASS: Fit selected size appears across all three sites after reload; signed-out save opens sign-in.");

  await a.goto(appURL + "/fit/?reference=1&target=2");
  await a.locator("#referenceSize").selectOption("9.5");
  await favorite(a, 1, "#referencePreview").click();
  await checkText(a.locator("#referencePreview [role=status]"), "Saved size US men 9.5");
  await a.locator("#recommendButton").click();
  const resultText = await a.locator(".recommended-size").innerText();
  await favorite(a, 2, "#result").click();
  await checkText(a.locator("#result [role=status]"), "Saved size");
  assert.equal((await query("SELECT count(*)::int AS n FROM public.favorites WHERE user_id=$1 AND sneaker_id=1", [userA]))[0].n, 1);
  const rec = (await query("SELECT size::float AS size,size_system FROM public.favorites WHERE user_id=$1 AND sneaker_id=2", [userA]))[0];
  assert.equal(rec.size_system, "us_men");
  assert.equal(rec.size, Number(resultText.split(" ").at(-1)));
  await a.goto(appURL + "/archive");
  await favorite(a, 4).click();
  await checkText(favorite(a, 4), "Remove favorite");
  const unsized = await query("SELECT size FROM public.favorites WHERE user_id=$1 AND sneaker_id=4", [userA]);
  assert.deepEqual(unsized, [{ size: null }]);
  await a.goto(appURL + "/compare/");
  await a.locator("#pairOne").selectOption("1");
  await a.locator("#pairTwo").selectOption("2");
  await a.locator("#compareButton").click();
  assert.equal(await a.locator(".comparison-table .shoe-heading button[data-sole-favorite]").count(), 2);
  const list = await favoritesList(a);
  await checkText(list.locator("li").filter({ hasText: "US men 9.5" }), "US men 9.5");
  const archiveShoe = (await query("SELECT brand,name FROM sole.sneakers WHERE id=4"))[0];
  await list.getByRole("button", { name: `Remove ${archiveShoe.brand} ${archiveShoe.name} from favorites` }).click();
  await checkText(modal(a).getByRole("status"), "Removed");
  assert.equal((await query("SELECT 1 FROM public.favorites WHERE user_id=$1 AND sneaker_id=4", [userA])).length, 0);
  console.log("PASS: Fit updates one row and saves the displayed recommendation; Archive no-size save removed from Compare.");

  const b = await setupContext();
  await b.setViewportSize({ width: 375, height: 812 });
  await b.goto(appURL + "/compare/?panel=favorites");
  await signIn(b, "b@example.test");
  await modal(b).getByText("You haven’t saved any sneakers yet.").waitFor();
  assert.ok(await modal(b).evaluate((node) => node.scrollWidth <= node.clientWidth));
  assert.equal(await nav(b).getByRole("link", { name: "Admin" }).count(), 0);
  const forbidden = await b.evaluate(async ({ mockURL, userB }) => {
    const response = await fetch(mockURL + "/rest/v1/sneakers", {
      method: "POST", headers: { Authorization: "Bearer fixture-" + userB,
        "Content-Profile": "sole", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Forbidden test row" }),
    });
    return response.status;
  }, { mockURL, userB });
  assert.equal(forbidden, 403);
  console.log("PASS: Separate account sees an empty Favorites list, has no admin controls, and PostgreSQL denies its catalog write.");

  const ap = await setupContext();
  await ap.goto(appURL + "/archive");
  await nav(ap).getByRole("button", { name: "Sign in" }).click();
  await signIn(ap, "admin@example.test");
  await modal(ap).waitFor({ state: "hidden" });
  await nav(ap).getByRole("link", { name: "Admin" }).click();
  await modal(ap).getByRole("button", { name: "New sneaker" }).click();
  const form = modal(ap).locator("form");
  const record = (await query("SELECT * FROM sole.sneakers WHERE id=1"))[0];
  const testName = "SOLE Browser Test Sneaker";
  const draft = { ...record, shoe_reference_number: "SOLE-BROWSER-FIXTURE", name: testName, provenance: {} };
  for (const name of nativeFields) {
    const field = form.locator(`[name="${name}"]`);
    if (await field.evaluate((node) => node.tagName === "SELECT")) await field.selectOption(draft[name]);
    else await field.fill(draft[name] === null ? "" : name === "provenance" ? "{}" : String(draft[name]));
  }
  await form.getByRole("button", { name: "Add sneaker", exact: true }).click();
  await checkText(modal(ap).getByRole("status"), "Sneaker saved.");
  const id = (await query("SELECT id FROM sole.sneakers WHERE shoe_reference_number='SOLE-BROWSER-FIXTURE'"))[0].id;
  await verifyCatalog(testName, true);
  await form.getByLabel("Sneaker name").fill(testName + " Revised");
  await form.getByRole("button", { name: "Save changes" }).click();
  await checkText(modal(ap).getByRole("status"), "Sneaker saved.");
  await verifyCatalog(testName + " Revised", true);
  await asUser(db, userA, (tx) => tx.query("SELECT public.sole_save_favorite($1,9,'us_men')", [id]));
  ap.once("dialog", (dialog) => dialog.dismiss());
  await form.getByRole("button", { name: "Delete sneaker" }).click();
  assert.equal((await query("SELECT id FROM sole.sneakers WHERE id=$1", [id])).length, 1);
  ap.once("dialog", (dialog) => dialog.accept());
  await form.getByRole("button", { name: "Delete sneaker" }).click();
  await checkText(modal(ap).getByRole("status"), "Sneaker deleted.");
  await verifyCatalog(testName, false);
  assert.equal((await query("SELECT 1 FROM public.favorites WHERE sneaker_id=$1", [id])).length, 0);
  assert.deepEqual(pageErrors, []);
  console.log("PASS: Admin add, view, edit, cancel delete, confirm delete, cascade and refreshed catalogs on all three sites.");
} finally {
  await browser?.close();
  processHandle.kill();
  await new Promise((resolve) => gateway.close(resolve));
  await db.close();
}
