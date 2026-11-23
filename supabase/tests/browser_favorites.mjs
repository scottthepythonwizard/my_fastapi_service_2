// Browser integration against isolated PostgreSQL. The test gateway implements
// only the Auth/PostgREST requests used here; production never loads this file.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const chrome = process.env.SOLE_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

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
const pageErrors = [];
let failNextSave = false;
let browser;

async function setupContext(context = null) {
  context ||= await browser.newContext();
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
          case "/rest/v1/rpc/sole_favorites":
            return select(tx, "SELECT * FROM public.sole_favorites()");
          case "/rest/v1/rpc/sole_save_favorite": {
            const { p_sneaker_id, p_size, p_size_system } = args();
            await tx.query("SELECT public.sole_save_favorite($1,$2,$3)", [p_sneaker_id, p_size, p_size_system]);
            return [];
          }
          default: throw new Error("Unexpected test route: " + url.pathname);
        }
      });
      return answer(200, rows);
    } catch (error) {
      if (!error.code) console.error(error.message);
      return answer(error.code === "42501" ? 403 : 400, { code: error.code || "fixture", message: error.message });
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
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

async function checkNavbar(page) {
  const controls = nav(page).locator("a, button");
  assert.equal(await controls.count(), 2);
  const styles = await controls.evaluateAll((nodes) => nodes.map((node) => {
    const s = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      type: [s.fontFamily, s.fontSize, s.fontWeight, s.letterSpacing, s.padding, s.textTransform],
      fits: rect.left >= 0 && rect.right <= window.innerWidth && rect.height >= 44,
    };
  }));
  assert.deepEqual(styles[0], styles[1]);
  assert.ok(styles[0].fits);
  await controls.first().focus();
  assert.equal(await controls.first().evaluate((node) => getComputedStyle(node).outlineStyle), "solid");
  await page.keyboard.press("Tab");
  assert.ok(await controls.last().evaluate((node) => document.activeElement === node));
  await page.keyboard.press("Enter");
  await modal(page).getByRole("heading", { name: "Account" }).waitFor();
  await page.keyboard.press("Escape");
  await modal(page).waitFor({ state: "hidden" });
}

async function checkCaretBrowsing(enabled) {
  const profile = await mkdtemp(join(tmpdir(), "sole-caret-test-"));
  await mkdir(join(profile, "Default"));
  await writeFile(join(profile, "Default", "Preferences"), JSON.stringify({
    settings: { a11y: { caretbrowsing: { enabled, show_dialog: false } } },
  }));
  const context = await chromium.launchPersistentContext(profile, { executablePath: chrome, headless: true });
  try {
    const page = await setupContext(context);
    await page.goto(appURL + "/archive?panel=favorites");
    await signIn(page, "b@example.test");
    const text = modal(page).getByText("You haven’t saved any sneakers yet.");
    await text.click({ position: { x: 6, y: 8 } });
    const position = () => text.evaluate((node) => {
      const selection = getSelection();
      return selection.isCollapsed && selection.focusNode?.parentElement === node ? selection.focusOffset : null;
    });
    const before = await position();
    await page.keyboard.press("ArrowRight");
    const after = await position();
    assert.equal(before !== null && after === before + 1, enabled, `Caret browsing: ${enabled}, ${before} → ${after}`);
  } finally {
    await context.close();
  }
}

try {
  for (let i = 0; ; i++) {
    if (i === 50) throw new Error("FastAPI test server failed to start");
    const ready = await fetch(appURL + "/health").catch(() => null);
    if (ready?.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ executablePath: chrome, headless: true });
  const a = await setupContext();
  await a.goto(appURL + "/fit/?reference=1&target=2");
  const unsavedStar = favorite(a, 1);
  assert.equal(await unsavedStar.innerText(), "☆");
  await unsavedStar.focus();
  await a.keyboard.press("Enter");
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
    await nav(a).getByRole("button", { name: "Account" }).waitFor();
    await checkNavbar(a);
    const list = await favoritesList(a);
    await checkText(list.locator("li"), "EU 42.5");
    const photo = list.locator("img").first();
    await photo.waitFor();
    await a.waitForFunction(() => document.querySelector(".sole-favorites-list img")?.naturalWidth > 0);
    assert.match(await photo.getAttribute("src"), /\/images\/1\.jpg$/);
    await modal(a).getByRole("button", { name: "Close" }).click();
    const savedStar = a.locator('button[data-sole-favorite="1"][data-saved="true"]').first();
    assert.equal(await savedStar.innerText(), "★");
    assert.match(await savedStar.getAttribute("aria-label"), /^Remove from favorites:/);
  }
  console.log("PASS: Fit selected size appears across all three sites after reload; signed-out save opens sign-in.");

  await a.goto(appURL + "/fit/?reference=1&target=2");
  await a.locator("#referenceSize").selectOption("9.5");
  await a.locator("#referencePreview").getByRole("button", { name: /Update saved size/ }).click();
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
  await a.getByRole("button", { name: /^Remove from favorites:/ }).and(favorite(a, 4)).waitFor();
  const unsized = await query("SELECT size FROM public.favorites WHERE user_id=$1 AND sneaker_id=4", [userA]);
  assert.deepEqual(unsized, [{ size: null }]);
  await a.goto(appURL + "/compare/");
  await a.locator("#pairOne").selectOption("1");
  await a.locator("#pairTwo").selectOption("2");
  await a.locator("#compareButton").click();
  assert.equal(await a.locator(".comparison-table .shoe-heading button[data-sole-favorite]").count(), 2);
  const comparisonStar = (id) => favorite(a, id, ".comparison-table");
  await comparisonStar(2).click();
  await a.locator('.comparison-table button[data-sole-favorite="2"][data-saved="false"]').waitFor();
  assert.equal(await comparisonStar(1).innerText(), "★");
  assert.equal(await comparisonStar(2).innerText(), "☆");
  await comparisonStar(2).click();
  await a.locator('.comparison-table button[data-sole-favorite="2"][data-saved="true"]').waitFor();
  const archiveShoe = (await query("UPDATE sole.sneakers SET image_url='images/favorites-missing-fixture.jpg' WHERE id=4 RETURNING brand,name"))[0];
  const list = await favoritesList(a);
  await checkText(list.locator("li").filter({ hasText: "US men 9.5" }), "US men 9.5");
  const missingPhoto = list.locator("li").filter({ hasText: archiveShoe.name }).locator(".sole-favorite-photo");
  await missingPhoto.getByText("No photo", { exact: true }).waitFor();
  await missingPhoto.locator("img").waitFor({ state: "detached" });
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
  const message = modal(b).getByText("You haven’t saved any sneakers yet.");
  assert.deepEqual(await message.evaluate((node) => [node.isContentEditable, document.designMode]), [false, "off"]);
  assert.equal(await b.locator('[contenteditable="true"]').count(), 0);
  await message.dblclick({ position: { x: 6, y: 8 } });
  assert.ok(await b.evaluate(() => getSelection().toString()), "Ordinary text can still be selected");
  await modal(b).getByRole("button", { name: "Close" }).click();
  for (const path of pages) {
    await b.goto(appURL + path);
    await nav(b).getByRole("button", { name: "Account" }).waitFor();
    await checkNavbar(b);
  }
  console.log("PASS: Mobile navigation and keyboard focus on Archive, Compare and Fit; Favorites text is selectable and noneditable.");

  const ap = await setupContext();
  await ap.goto(appURL + "/archive");
  await nav(ap).getByRole("button", { name: "Sign in" }).click();
  await signIn(ap, "admin@example.test");
  for (const path of pages) {
    await ap.goto(appURL + path + "?panel=admin");
    await nav(ap).getByRole("button", { name: "Account" }).waitFor();
    assert.equal(await nav(ap).getByRole("link", { name: "Admin" }).count(), 0);
    assert.equal(await modal(ap).count(), 0);
    const retired = await ap.request.get(appURL + path.replace(/\/$/, "") + "/admin");
    assert.equal(retired.status(), 404);
  }
  for (const path of ["/admin", "/sole-shared/admin.js", "/sole-account-images", "/fit/sole-account-images"]) {
    assert.equal((await ap.request.get(appURL + path)).status(), 404);
  }
  assert.deepEqual(pageErrors, []);
  console.log("PASS: Admin account can sign in, and retired URLs and assets cannot open the editor.");
  if (process.env.SOLE_TEST_CARET === "1") {
    await checkCaretBrowsing(false);
    await checkCaretBrowsing(true);
    console.log("PASS: Clicking the empty Favorites message produces a movable text caret only when Chrome caret browsing is enabled.");
  }
} finally {
  await browser?.close();
  processHandle.kill();
  await new Promise((resolve) => gateway.close(resolve));
  await db.close();
}
