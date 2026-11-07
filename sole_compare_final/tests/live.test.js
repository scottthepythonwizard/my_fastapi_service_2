// This suite consumes the actual existing API. It contains no sneaker fixtures.
import assert from "node:assert/strict";
import test from "node:test";
import { FIELDS, fetchCatalog, filterInventory, formatValue, imageUrl, isDifferent } from "../core.js";

const config = { apiOrigin: process.env.SOLE_API_ORIGIN || "http://127.0.0.1:8000",
  apiKey: process.env.SOLE_API_KEY || "student-api-key-123" };
let items;
test.before(async () => { items = await fetchCatalog(config); });

test("real inventory has complete values, estimates and valid API-hosted images", async () => {
  assert.ok(items.length >= 2);
  for (const item of items) {
    for (const [key] of FIELDS) {
      assert.notEqual(formatValue(item, key), "—", `${item.id}: ${key}`);
      assert.notEqual(formatValue(item, key), "undefined");
    }
    assert.match(formatValue(item, "release_month"), /^[A-Z][a-z]+(?: \d{4})?$/);
    const response = await fetch(imageUrl(item, config.apiOrigin), { method: "HEAD" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^image\//);
  }
});

test("formatted comparison is symmetric and identical records have no differences", () => {
  for (const [key] of FIELDS) {
    assert.equal(isDifferent(items[0], items[0], key), false);
    assert.equal(isDifferent(items[0], items[1], key), isDifferent(items[1], items[0], key));
  }
  const estimated = items.find((item) => item.provenance?.weight_g?.status === "estimated");
  assert.ok(estimated, "Existing estimate provenance is retained");
});

test("search filters the real inventory and preserves case-insensitive matching", () => {
  const item = items[0];
  assert.ok(filterInventory(items, item.attributes.name.toUpperCase(), "").some((candidate) => candidate.id === item.id));
  assert.equal(filterInventory(items, "no-such-pair-7b79f", "").length, 0);
  assert.ok(filterInventory(items, "", item.attributes.brand).every((candidate) => candidate.attributes.brand === item.attributes.brand));
});

test("existing CORS policy accepts the separate comparison frontend and API key", async () => {
  const response = await fetch(`${config.apiOrigin}/api/v1/catalog`, { method: "OPTIONS", headers: {
    Origin: "http://127.0.0.1:5173", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-api-key",
  } });
  assert.equal(response.status, 200);
  assert.ok(["*", "http://127.0.0.1:5173"].includes(response.headers.get("access-control-allow-origin")));
  assert.match(response.headers.get("access-control-allow-headers"), /x-api-key/i);
});

test("wrong API keys are rejected by the real backend", async () => {
  await assert.rejects(fetchCatalog({ ...config, apiKey: "sole-compare-invalid-test-key" }), /API key was rejected/);
});
