import assert from "node:assert/strict";
import test from "node:test";
import { FIELDS, apiOrigin, chooseSlot, fetchCatalog, isPairReady, toggleSelection, validateCatalog } from "../core.js";

test("comparison exposes exactly the 14 requested attributes in order", () => {
  assert.deepEqual(FIELDS.map(([key]) => key), ["brand", "name", "year", "category", "retail_price", "colorway",
    "country_of_origin", "materials", "closure_type", "cut", "sole_material", "cushioning", "weight_g", "release_month"]);
});

test("two slots prevent duplicates and a third selection without losing order", () => {
  const empty = [null, null];
  const first = toggleSelection(empty, 8);
  assert.deepEqual(empty, [null, null]);
  assert.deepEqual(first, [8, null]);
  assert.equal(isPairReady(first), false);
  const pair = toggleSelection(first, 18);
  assert.equal(isPairReady(pair), true);
  assert.deepEqual(toggleSelection(pair, 6), [8, 18]);
  assert.deepEqual(toggleSelection(pair, 8), [null, 18]);
  assert.deepEqual(toggleSelection([null, 18], 6), [6, 18]);
  assert.deepEqual(chooseSlot(pair, 0, 18), pair);
  assert.deepEqual(chooseSlot(pair, 0, 6), [6, 18]);
  assert.deepEqual(chooseSlot(pair, 1, null), [8, null]);
  for (const ids of [[8, 8], [null, 8], [], [8], [-1, 8]]) assert.equal(isPairReady(ids), false);
});

test("API configuration accepts origins and rejects unsafe or ambiguous values", () => {
  assert.equal(apiOrigin("http://127.0.0.1:8000/"), "http://127.0.0.1:8000");
  assert.equal(apiOrigin("https://example.com"), "https://example.com");
  for (const value of ["file:///tmp/api", "https://example.com/api/v1", "https://user:key@example.com", "https://example.com/?key=x"]) {
    assert.throws(() => apiOrigin(value));
  }
});

test("authentication failure sends one API request and logs its status without the API key", async (t) => {
  const calls = [];
  const logger = t.mock.method(console, "error", () => {});
  await assert.rejects(fetchCatalog({ apiOrigin: "http://127.0.0.1:8000", apiKey: "invalid" }, async (url, options) => {
    calls.push({ url, options });
    return { status: 401, ok: false };
  }), /API key was rejected/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:8000/api/v1/catalog");
  assert.equal(calls[0].options.headers["x-api-key"], "invalid");
  assert.equal(calls[0].options.cache, "no-store");
  const diagnostic = logger.mock.calls[0].arguments[1];
  assert.equal(diagnostic.status, 401);
  assert.equal(diagnostic.url, calls[0].url);
  assert.equal(JSON.stringify(diagnostic).includes('"invalid"'), false);
});

test("HTTP, network, timeout, and non-JSON failures retain actionable diagnostics", async (t) => {
  const logger = t.mock.method(console, "error", () => {});
  const config = { apiOrigin: "http://127.0.0.1:8000", apiKey: "do-not-log-this-key" };
  for (const status of [403, 404, 503]) {
    await assert.rejects(fetchCatalog(config, async () => new Response("Unavailable", { status })), new RegExp(`HTTP ${status}`));
    assert.equal(logger.mock.calls.at(-1).arguments[1].status, status);
  }
  const networkError = new TypeError("Failed to fetch");
  await assert.rejects(fetchCatalog(config, async () => { throw networkError; }), (error) => {
    assert.match(error.message, /127\.0\.0\.1:8000\/api\/v1\/catalog/);
    assert.equal(error.cause, networkError);
    return true;
  });
  assert.equal(logger.mock.calls.at(-1).arguments[1].status, null);
  assert.equal(logger.mock.calls.at(-1).arguments[1].error, networkError);
  await assert.rejects(fetchCatalog(config, async () => { throw new DOMException("Timed out", "TimeoutError"); }), /timed out after 10 seconds/);
  await assert.rejects(fetchCatalog(config, async () => new Response("<html>Login</html>", { headers: { "Content-Type": "text/html" } })), /Expected JSON.*HTTP 200/);
  assert.equal(logger.mock.calls.at(-1).arguments[1].contentType, "text/html");
  assert.deepEqual(await fetchCatalog(config, async () => Response.json({ count: 0, items: [] })), []);
  assert.equal(JSON.stringify(logger.mock.calls.map((call) => call.arguments)).includes(config.apiKey), false);
});

test("invalid API envelopes are rejected", () => {
  for (const payload of [null, {}, { count: 1, items: [] }, { count: 1, items: [{}] }]) {
    assert.throws(() => validateCatalog(payload));
  }
});
