// Install Playwright locally or set NODE_PATH to an existing Playwright installation.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.SOLE_TEST_URL || "http://127.0.0.1:8000";
const output = path.resolve(__dirname, "../screenshots");

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.SOLE_BROWSER || "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/archive`);
    await page.waitForFunction(() => document.querySelectorAll(".sneaker-card").length === 20);
    assert.equal(await page.locator("#archiveCount").innerText(), "20");
    assert.equal(await page.locator("#resultCount").innerText(), "20 PAIRS");
    assert.equal(await page.locator(".header-note").innerText(), "Archive");
    assert.equal(await page.locator(".editorial-line span").last().innerText(), "Archive");
    const api = await (await page.request.get(`${base}/catalog`)).json();
    assert.equal(api.items.length, 20);
    for (const item of api.items) {
      assert.equal(Object.keys(item.attributes).length, 14);
      assert.equal((await page.request.get(`${base}/${item.image_url}`)).status(), 200);
    }
    await page.locator(".sneaker-card").last().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll(".card-image img")].every((img) => img.complete && img.naturalWidth > 0));
    await page.evaluate(() => Promise.all([...document.querySelectorAll(".card-image img")].map((img) => img.decode())));
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, "catalog-desktop.png"), fullPage: true });
    await page.locator(".sneaker-card").first().hover();
    assert.notEqual(await page.locator(".sneaker-card").first().evaluate((node) => getComputedStyle(node).transform), "none");

    await page.locator("#searchInput").fill(" CHUCK ");
    assert.equal(await page.locator(".sneaker-card").count(), 2);
    await page.locator("#brandFilter").selectOption("Converse");
    assert.equal(await page.locator(".sneaker-card").count(), 2);
    await page.locator("#searchInput").fill("no-such-sneaker");
    assert.equal(await page.locator("#resultCount").innerText(), "00 PAIRS");
    await page.getByRole("button", { name: "Show all pairs" }).click();
    assert.equal(await page.locator(".sneaker-card").count(), 20);
    await page.locator("#sortOrder").selectOption("price-low");
    assert.match(await page.locator(".sneaker-card").first().innerText(), /Chuck Taylor All Star/);
    await page.locator("#sortOrder").selectOption("price-high");
    assert.match(await page.locator(".sneaker-card").first().innerText(), /F50 Elite FG/);
    await page.locator("#sortOrder").selectOption("year");
    assert.match(await page.locator(".sneaker-card").first().innerText(), /Adizero EVO SL/);
    await page.locator("#resetFilters").click();
    for (let i = 0; i < api.items.length; i++) {
      const card = page.locator(".sneaker-card").nth(i);
      await card.click();
      assert.equal(await page.locator("#detailName").innerText(), api.items[i].attributes.name);
      assert.equal(await page.locator("#detailSpecs .spec-row").count(), 9);
      const item = api.items[i];
      assert.match(await page.locator("#detailRating").innerText(), new RegExp(`${item.attributes.review_stars}/5`));
      assert.equal(await page.locator("#detailRating .data-badge").count(), item.provenance.review_stars.status === "mock" ? 1 : 0);
      assert.equal(await page.locator("#detailOverview").innerText(), item.attributes.descriptive_overview);
      assert.equal(await page.locator('.spec-row[data-attribute="country_of_origin"] dt').innerText(), "Country of Origin");
      assert.equal(await page.locator('.spec-row[data-attribute="country_of_origin"] dd').innerText(), item.attributes.country_of_origin);
      assert.equal(await page.locator('.spec-row[data-attribute="description"]').count(), 0);
      assert.equal(await page.locator("#detailPrice").innerText(), item.attributes.retail_price);
      assert.equal(await page.locator('.spec-row[data-attribute="category"] dd').innerText(), item.attributes.category);
      assert.equal(await page.locator('.spec-row[data-attribute="gender_target"] dd').innerText(), item.attributes.gender_target);
      assert.equal(await page.locator(".detail-visual > p").innerText(), "SOLE / A CLOSER LOOK");
      assert.ok(await page.locator(".spec-row dd").first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize)) >= 15);
      assert.doesNotMatch(await page.locator("#sneakerDialog").innerText(), /resell|resale|historical significance|Not specified/i);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#sneakerDialog").evaluate((node) => node.open), false);
      assert.equal(await card.evaluate((node) => node === document.activeElement), true);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator("#featuredSneaker").click();
    await page.locator("#detailImage").evaluate((img) => img.decode());
    await page.screenshot({ path: path.join(output, "sneaker-detail.png") });
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.querySelector("#sneakerDialog").contains(document.activeElement)), true);
    await page.locator("#closeDialog").click();

    await page.getByRole("button", { name: "View New Balance Furon V7" }).click();
    assert.equal(await page.locator('.spec-row[data-attribute="shoe_reference_number"] .data-badge').innerText(), "Mock SKU");
    await page.locator("#closeDialog").click();

    await page.route("**/catalog", (route) => route.abort());
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll(".sneaker-card").length === 20);
    assert.match(await page.locator("#catalogNote").innerText(), /bundled archive/);
    await page.getByRole("button", { name: "View New Balance Furon V7" }).click();
    assert.equal(await page.locator("#detailRating .data-badge").innerText(), "Mock rating");
    await page.locator("#closeDialog").click();
    await page.route("**/data/*.json", (route) => route.abort());
    await page.reload();
    await page.getByText("The archive couldn’t load.").waitFor();
    assert.equal(await page.locator("#resultCount").innerText(), "UNAVAILABLE");
    await page.unroute("**/catalog");
    await page.unroute("**/data/*.json");
    await page.getByRole("button", { name: "Try again" }).click();
    await page.waitForFunction(() => document.querySelectorAll(".sneaker-card").length === 20);
    assert.deepEqual(errors, []);

    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    await mobile.goto(`${base}/archive`);
    await mobile.waitForFunction(() => document.querySelectorAll(".sneaker-card").length === 20);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await mobile.locator(".hero-copy").evaluate((node) => node.scrollHeight <= node.clientHeight), true);
    await mobile.locator(".sneaker-card").last().scrollIntoViewIfNeeded();
    await mobile.waitForFunction(() => [...document.querySelectorAll(".card-image img")].every((img) => img.complete && img.naturalWidth > 0));
    await mobile.evaluate(() => Promise.all([...document.querySelectorAll(".card-image img")].map((img) => img.decode())));
    await mobile.evaluate(() => scrollTo(0, 0));
    await mobile.screenshot({ path: path.join(output, "catalog-mobile.png"), fullPage: true });
    await mobile.locator(".sneaker-card").first().click();
    const bounds = await mobile.locator("#sneakerDialog").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 375);
    await mobile.locator("#detailSpecs .spec-row").last().scrollIntoViewIfNeeded();
    await mobile.locator("#closeDialog").click();
    assert.equal(await mobile.locator("#sneakerDialog").evaluate((node) => node.open), false);
    console.log("PASS: 20 images and modals, search, filters, sorting, keyboard/focus, fallback/retry, and mobile layout.");
    console.log(`Screenshots saved to ${output}`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
